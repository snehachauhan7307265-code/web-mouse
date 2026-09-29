import { useState, useEffect, useRef, useCallback } from 'react';
import { IncomingMessage, OutgoingMessage, Device } from '../types';
import { 
  CHUNK_SIZE, 
  TransferStatus, 
  sanitizeFileName, 
  calculateFileChecksum, 
  validateFileForTransfer,
  recordTransferInHistory,
  loadTransferHistory
} from '../utils/fileTransferEngine';

export interface TransferTask {
  id: string; // unique transferId
  direction: 'upload' | 'download';
  filename: string;
  size: number;
  mimeType: string;
  sourceDevice: string;
  targetDevice: string;
  status: TransferStatus;
  progress: number; // 0–100 strictly based on actual acknowledged bytes
  bytesTransferred: number;
  speedBytesPerSec: number;
  error?: string;
  file?: File;
  totalChunks: number;
  chunkIndex: number;
  offset: number;
  checksum?: string;
  remoteChecksum?: string;
  savedPath?: string;
  startTime?: number;
  lastProgressTime?: number;
  lastProgressOffset?: number;
  receivedChunks?: string[]; // for receiver mode
}

export function useFileTransfer(
  onSendMessage: (msg: OutgoingMessage) => void,
  incomingMessage: IncomingMessage | null,
  activeDevice: Device | null,
  isConnected: boolean,
  deviceName: string,
  vibrate: (type: 'light' | 'medium' | 'heavy' | 'double' | 'error', enabled: boolean) => void,
  vibrationEnabled: boolean
) {
  const [transfers, setTransfers] = useState<TransferTask[]>([]);
  const transfersRef = useRef<TransferTask[]>([]);

  // Keep ref synchronized to avoid stale state in asynchronous event chains
  useEffect(() => {
    transfersRef.current = transfers;
  }, [transfers]);

  const getTransfer = (id: string): TransferTask | undefined => {
    return transfersRef.current.find((t) => t.id === id);
  };

  const updateTransfer = (id: string, updates: Partial<TransferTask>) => {
    setTransfers((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const updated = { ...t, ...updates };

        // Calculate real throughput
        if (typeof updates.bytesTransferred === 'number' && t.lastProgressTime) {
          const now = Date.now();
          const timeDiff = (now - t.lastProgressTime) / 1000;
          if (timeDiff >= 0.4) {
            const bytesDiff = updates.bytesTransferred - (t.lastProgressOffset || 0);
            updated.speedBytesPerSec = Math.max(0, bytesDiff / timeDiff);
            updated.lastProgressTime = now;
            updated.lastProgressOffset = updates.bytesTransferred;
          }
        }

        // If reaching a terminal state, persist in history
        if (
          updates.status === 'COMPLETED' ||
          updates.status === 'FAILED' ||
          updates.status === 'CANCELLED'
        ) {
          recordTransferInHistory({
            id: updated.id,
            filename: updated.filename,
            size: updated.size,
            direction: updated.direction,
            sourceDevice: updated.sourceDevice,
            targetDevice: updated.targetDevice,
            status: updates.status,
            progress: updated.progress,
            timestamp: Date.now(),
            error: updated.error,
            savedPath: updated.savedPath,
            checksum: updated.checksum,
          });
        }

        return updated;
      })
    );
  };

  const readAndSendChunk = (task: TransferTask) => {
    if (!task.file) return;

    const start = task.offset;
    const end = Math.min(task.size, start + CHUNK_SIZE);
    const slice = task.file.slice(start, end);

    const reader = new FileReader();
    reader.onerror = () => {
      updateTransfer(task.id, {
        status: 'FAILED',
        error: 'Failed to read file slice from disk',
      });
      vibrate('error', vibrationEnabled);
    };

    reader.onload = (e) => {
      if (!e.target?.result) return;
      const dataUrl = e.target.result as string;
      const base64Chunk = dataUrl.split(',')[1] || '';

      onSendMessage({
        type: 'file_chunk',
        transfer_id: task.id,
        transferId: task.id,
        chunk_index: task.chunkIndex,
        sequence: task.chunkIndex,
        chunk: base64Chunk,
        data: base64Chunk,
        totalChunks: task.totalChunks,
        total_chunks: task.totalChunks,
      });
    };

    reader.readAsDataURL(slice);
  };

  /**
   * Start an authenticated, chunked file upload
   */
  const startUpload = async (file: File): Promise<string | null> => {
    // 1. Strict validation
    const validation = validateFileForTransfer(file, activeDevice, isConnected);
    if (!validation.valid) {
      const errorMsg = validation.error || 'Transfer validation failed';
      const failedId = 'err_' + Date.now();
      const failedTask: TransferTask = {
        id: failedId,
        direction: 'upload',
        filename: file?.name || 'unknown_file',
        size: file?.size || 0,
        mimeType: file?.type || 'application/octet-stream',
        sourceDevice: deviceName,
        targetDevice: activeDevice?.name || 'Target Device',
        status: 'FAILED',
        progress: 0,
        bytesTransferred: 0,
        speedBytesPerSec: 0,
        error: errorMsg,
        totalChunks: 0,
        chunkIndex: 0,
        offset: 0,
      };
      setTransfers((prev) => [failedTask, ...prev]);
      vibrate('error', vibrationEnabled);
      return null;
    }

    const safeName = sanitizeFileName(file.name);
    const transferId = 'xfer_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const targetName = activeDevice?.name || 'Connected Device';

    // 2. Initial state: VALIDATING
    const task: TransferTask = {
      id: transferId,
      direction: 'upload',
      filename: safeName,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      sourceDevice: deviceName,
      targetDevice: targetName,
      status: 'VALIDATING',
      progress: 0,
      bytesTransferred: 0,
      speedBytesPerSec: 0,
      file,
      totalChunks,
      chunkIndex: 0,
      offset: 0,
      startTime: Date.now(),
      lastProgressTime: Date.now(),
      lastProgressOffset: 0,
    };

    setTransfers((prev) => [task, ...prev]);

    // 3. Compute SHA-256 Checksum before starting transfer
    let checksum = '';
    try {
      checksum = await calculateFileChecksum(file);
      task.checksum = checksum;
      updateTransfer(transferId, { checksum, status: 'WAITING_FOR_RECEIVER' });
    } catch (e: any) {
      updateTransfer(transferId, {
        status: 'FAILED',
        error: 'Failed to calculate file checksum',
      });
      vibrate('error', vibrationEnabled);
      return null;
    }

    // 4. Send metadata to receiver
    onSendMessage({
      type: 'file_transfer_start',
      transfer_id: transferId,
      transferId,
      filename: safeName,
      fileName: safeName,
      size: file.size,
      fileSize: file.size,
      mimeType: task.mimeType,
      sourceDevice: deviceName,
      targetDevice: targetName,
      total_chunks: totalChunks,
      totalChunks,
      checksum,
    });

    return transferId;
  };

  /**
   * Cancel an ongoing transfer
   */
  const cancelTransfer = (id: string) => {
    const task = getTransfer(id);
    if (!task) return;

    updateTransfer(id, {
      status: 'CANCELLED',
      error: 'Transfer cancelled by user',
    });

    onSendMessage({
      type: 'file_transfer_cancel',
      transfer_id: id,
      transferId: id,
      reason: 'Cancelled by user',
    });

    vibrate('medium', vibrationEnabled);
  };

  /**
   * Accept an incoming file request
   */
  const acceptDownload = (id: string) => {
    updateTransfer(id, {
      status: 'TRANSFERRING',
      startTime: Date.now(),
      lastProgressTime: Date.now(),
      lastProgressOffset: 0,
    });

    onSendMessage({
      type: 'incoming_file_accept',
      transfer_id: id,
      transferId: id,
    });

    vibrate('light', vibrationEnabled);
  };

  /**
   * Reject an incoming file request
   */
  const rejectDownload = (id: string) => {
    updateTransfer(id, {
      status: 'CANCELLED',
      error: 'Transfer rejected by receiver',
    });

    onSendMessage({
      type: 'incoming_file_reject',
      transfer_id: id,
      transferId: id,
      reason: 'Rejected by receiver',
    });

    vibrate('light', vibrationEnabled);
  };

  const removeTransfer = (id: string) => {
    setTransfers((prev) => prev.filter((t) => t.id !== id));
  };

  const saveDownloadedFileLocally = (task: TransferTask) => {
    if (!task.receivedChunks || task.receivedChunks.length === 0) {
      updateTransfer(task.id, {
        status: 'FAILED',
        error: 'No file data received',
      });
      return;
    }

    try {
      const byteArrays = task.receivedChunks.map((b64) => {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) {
          bytes[i] = bin.charCodeAt(i);
        }
        return bytes;
      });

      const blob = new Blob(byteArrays, { type: task.mimeType || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = task.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      updateTransfer(task.id, {
        status: 'COMPLETED',
        progress: 100,
        bytesTransferred: task.size,
      });

      vibrate('heavy', vibrationEnabled);
    } catch (err: any) {
      updateTransfer(task.id, {
        status: 'FAILED',
        error: `Failed to save downloaded file: ${err?.message || 'IO Error'}`,
      });
      vibrate('error', vibrationEnabled);
    }
  };

  // Process incoming messages from WebSocket or Receiver BroadcastChannel
  useEffect(() => {
    if (!incomingMessage) return;

    const msgType = incomingMessage.type;
    const transferId = (incomingMessage as any).transfer_id || (incomingMessage as any).transferId;

    // 1. Receiver accepted transfer request -> Begin chunk transmission
    if (msgType === 'file_transfer_accepted' || msgType === 'file_transfer_accept') {
      const task = getTransfer(transferId);
      if (task && (task.status === 'WAITING_FOR_RECEIVER' || task.status === 'VALIDATING' || task.status === 'QUEUED') && task.direction === 'upload') {
        updateTransfer(task.id, {
          status: 'TRANSFERRING',
          startTime: Date.now(),
          lastProgressTime: Date.now(),
          lastProgressOffset: 0,
        });
        readAndSendChunk(task);
      }
    }

    // 2. Receiver acknowledged a chunk -> Update progress and send next chunk
    else if (msgType === 'file_chunk_ack') {
      const task = getTransfer(transferId);
      if (task && task.status === 'TRANSFERRING' && task.direction === 'upload') {
        const ackIndex = typeof (incomingMessage as any).chunk_index === 'number' 
          ? (incomingMessage as any).chunk_index 
          : (incomingMessage as any).sequence ?? task.chunkIndex;

        const nextChunkIndex = ackIndex + 1;
        const newOffset = Math.min(task.size, nextChunkIndex * CHUNK_SIZE);
        const actualProgress = Math.min(99, Math.round((newOffset / task.size) * 100));

        updateTransfer(task.id, {
          offset: newOffset,
          chunkIndex: nextChunkIndex,
          bytesTransferred: newOffset,
          progress: actualProgress,
        });

        if (newOffset < task.size) {
          // Send next chunk
          readAndSendChunk({
            ...task,
            offset: newOffset,
            chunkIndex: nextChunkIndex,
          });
        } else {
          // All chunks acknowledged! Transition to VERIFYING and send end signal
          updateTransfer(task.id, {
            status: 'VERIFYING',
            progress: 99,
            bytesTransferred: task.size,
          });

          onSendMessage({
            type: 'file_transfer_end',
            transfer_id: task.id,
            transferId: task.id,
            checksum: task.checksum,
          });
        }
      }
    }

    // 3. Receiver confirmed successful verification and write to disk
    else if (msgType === 'file_transfer_success' || msgType === 'file_transfer_complete') {
      const task = getTransfer(transferId);
      if (task) {
        const savedPath = (incomingMessage as any).savedPath || (incomingMessage as any).message;
        updateTransfer(task.id, {
          status: 'COMPLETED',
          progress: 100,
          bytesTransferred: task.size,
          savedPath,
        });
        vibrate('heavy', vibrationEnabled);
      }
    }

    // 4. Transfer rejected or failed on receiver
    else if (
      msgType === 'file_transfer_rejected' ||
      msgType === 'file_transfer_reject' ||
      msgType === 'file_transfer_error'
    ) {
      const task = getTransfer(transferId);
      if (task) {
        const errorReason =
          (incomingMessage as any).reason ||
          (incomingMessage as any).message ||
          'Transfer failed on remote device';
        updateTransfer(task.id, {
          status: 'FAILED',
          error: errorReason,
        });
        vibrate('error', vibrationEnabled);
      }
    }

    // 5. Remote device requested incoming file download (PC/TV -> Phone)
    else if (msgType === 'incoming_file_request') {
      const filename = sanitizeFileName((incomingMessage as any).filename || (incomingMessage as any).fileName || 'file');
      const size = (incomingMessage as any).size || (incomingMessage as any).fileSize || 0;
      const totalChunks = (incomingMessage as any).total_chunks || (incomingMessage as any).totalChunks || 1;
      const srcDevice = (incomingMessage as any).sourceDevice || activeDevice?.name || 'Remote Computer';

      const task: TransferTask = {
        id: transferId || 'recv_' + Date.now(),
        direction: 'download',
        filename,
        size,
        mimeType: (incomingMessage as any).mimeType || 'application/octet-stream',
        sourceDevice: srcDevice,
        targetDevice: deviceName,
        status: 'WAITING_FOR_RECEIVER',
        progress: 0,
        bytesTransferred: 0,
        speedBytesPerSec: 0,
        totalChunks,
        chunkIndex: 0,
        offset: 0,
        checksum: (incomingMessage as any).checksum,
        receivedChunks: new Array(totalChunks),
      };

      setTransfers((prev) => [task, ...prev]);
      vibrate('medium', vibrationEnabled);
    }

    // 6. Incoming chunk for download
    else if (msgType === 'file_chunk') {
      const task = getTransfer(transferId);
      if (task && task.direction === 'download' && task.receivedChunks) {
        const chunkIndex = (incomingMessage as any).chunk_index ?? (incomingMessage as any).sequence ?? 0;
        const chunkData = (incomingMessage as any).chunk || (incomingMessage as any).data || '';

        task.receivedChunks[chunkIndex] = chunkData;
        const newOffset = Math.min(task.size, (chunkIndex + 1) * CHUNK_SIZE);
        const progress = Math.min(99, Math.round((newOffset / task.size) * 100));

        updateTransfer(task.id, {
          bytesTransferred: newOffset,
          progress,
          status: 'TRANSFERRING',
        });

        // Acknowledge chunk
        onSendMessage({
          type: 'file_chunk_ack',
          transfer_id: task.id,
          transferId: task.id,
          chunk_index: chunkIndex,
          sequence: chunkIndex,
          bytesReceived: newOffset,
        });
      }
    }

    // 7. Incoming file finished
    else if (msgType === 'file_transfer_end') {
      const task = getTransfer(transferId);
      if (task && task.direction === 'download') {
        updateTransfer(task.id, { status: 'VERIFYING' });
        saveDownloadedFileLocally(task);
      }
    }

    // 8. Remote cancellation
    else if (msgType === 'file_transfer_cancel') {
      const task = getTransfer(transferId);
      if (task) {
        updateTransfer(task.id, {
          status: 'CANCELLED',
          error: (incomingMessage as any).reason || 'Cancelled by remote device',
        });
      }
    }
  }, [incomingMessage]);

  return {
    transfers,
    startUpload,
    cancelTransfer,
    acceptDownload,
    rejectDownload,
    removeTransfer,
  };
}
