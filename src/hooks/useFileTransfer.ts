import { useState, useEffect, useRef, useCallback } from 'react';
import { IncomingMessage, OutgoingMessage } from '../types';

export type TransferDirection = 'upload' | 'download';
export type TransferStatusType = 'pending' | 'uploading' | 'downloading' | 'success' | 'error' | 'cancelled' | 'waiting_for_approval';

export interface TransferTask {
  id: string;
  direction: TransferDirection;
  filename: string;
  size: number;
  mimeType?: string;
  status: TransferStatusType;
  progress: number;
  speedBytesPerSec: number;
  error?: string;
  file?: File;
  totalChunks: number;
  chunkIndex: number;
  offset: number;
  startTime?: number;
  lastProgressTime?: number;
  lastProgressOffset?: number;
  receivedChunks?: string[]; // for download, holding base64 strings
}

export function useFileTransfer(
  onSendMessage: (msg: OutgoingMessage) => void,
  incomingMessage: IncomingMessage | null,
  vibrate: (type: 'light' | 'medium' | 'heavy' | 'error', enabled: boolean) => void,
  vibrationEnabled: boolean
) {
  const [transfers, setTransfers] = useState<TransferTask[]>([]);
  const transfersRef = useRef<TransferTask[]>([]); // To access latest state in async callbacks without dependency loops
  
  // Keep ref in sync
  useEffect(() => {
    transfersRef.current = transfers;
  }, [transfers]);

  const CHUNK_SIZE = 1024 * 512; // 512 KB

  const getTransfer = (id: string) => transfersRef.current.find(t => t.id === id);

  const updateTransfer = (id: string, updates: Partial<TransferTask>) => {
    setTransfers(prev => prev.map(t => {
      if (t.id !== id) return t;
      const updated = { ...t, ...updates };
      // Calculate speed
      if (updates.offset && t.lastProgressTime) {
        const now = Date.now();
        const timeDiff = (now - t.lastProgressTime) / 1000;
        if (timeDiff >= 0.5) { // update speed every 500ms
          const bytesDiff = updates.offset - (t.lastProgressOffset || 0);
          updated.speedBytesPerSec = bytesDiff / timeDiff;
          updated.lastProgressTime = now;
          updated.lastProgressOffset = updates.offset;
        }
      }
      return updated;
    }));
  };

  const startUpload = (file: File) => {
    const id = Math.random().toString(36).substring(2, 10);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    const task: TransferTask = {
      id,
      direction: 'upload',
      filename: file.name,
      size: file.size,
      status: 'pending',
      progress: 0,
      speedBytesPerSec: 0,
      file,
      totalChunks,
      chunkIndex: 0,
      offset: 0,
    };

    setTransfers(prev => [task, ...prev]);
    onSendMessage({
      type: 'file_transfer_start',
      filename: file.name,
      size: file.size,
      transfer_id: id,
      total_chunks: totalChunks
    });
  };

  const cancelTransfer = (id: string) => {
    updateTransfer(id, { status: 'cancelled' });
    onSendMessage({ type: 'file_transfer_cancel', transfer_id: id });
  };

  const acceptDownload = (id: string) => {
    updateTransfer(id, { status: 'downloading', startTime: Date.now(), lastProgressTime: Date.now(), lastProgressOffset: 0 });
    onSendMessage({ type: 'incoming_file_accept', transfer_id: id });
  };

  const rejectDownload = (id: string) => {
    updateTransfer(id, { status: 'cancelled' });
    onSendMessage({ type: 'incoming_file_reject', transfer_id: id });
  };

  const removeTransfer = (id: string) => {
    setTransfers(prev => prev.filter(t => t.id !== id));
  };

  const readAndSendChunk = (task: TransferTask) => {
    if (!task.file) return;
    const slice = task.file.slice(task.offset, task.offset + CHUNK_SIZE);
    const reader = new FileReader();
    reader.onload = (e) => {
      if (!e.target?.result) return;
      const dataUrl = e.target.result as string;
      const base64Chunk = dataUrl.split(',')[1];
      onSendMessage({
        type: 'file_chunk',
        transfer_id: task.id,
        chunk_index: task.chunkIndex,
        chunk: base64Chunk
      });
    };
    reader.readAsDataURL(slice);
  };

  const saveDownloadedFile = (task: TransferTask) => {
    if (!task.receivedChunks) return;
    try {
      const blob = new Blob(task.receivedChunks.map(b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0))), { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = task.filename;
      a.click();
      URL.revokeObjectURL(url);
      updateTransfer(task.id, { status: 'success', progress: 100 });
      vibrate('heavy', vibrationEnabled);
    } catch (err) {
      updateTransfer(task.id, { status: 'error', error: 'Failed to save file locally' });
    }
  };

  useEffect(() => {
    if (!incomingMessage) return;

    if (incomingMessage.type === 'file_transfer_accepted') {
      const task = getTransfer(incomingMessage.transfer_id);
      if (task && task.status === 'pending' && task.direction === 'upload') {
        updateTransfer(task.id, { status: 'uploading', startTime: Date.now(), lastProgressTime: Date.now(), lastProgressOffset: 0 });
        readAndSendChunk(task);
      }
    } else if (incomingMessage.type === 'file_chunk_ack') {
      const task = getTransfer(incomingMessage.transfer_id);
      if (task && task.status === 'uploading') {
        const newOffset = task.offset + CHUNK_SIZE;
        const newChunkIndex = task.chunkIndex + 1;
        const progress = Math.min(99, Math.round((newOffset / task.size) * 100));
        
        updateTransfer(task.id, { offset: newOffset, chunkIndex: newChunkIndex, progress });

        if (newOffset < task.size) {
          readAndSendChunk({ ...task, offset: newOffset, chunkIndex: newChunkIndex });
        } else {
          onSendMessage({ type: 'file_transfer_end', transfer_id: task.id });
        }
      }
    } else if (incomingMessage.type === 'file_transfer_success') {
      const task = getTransfer(incomingMessage.transfer_id);
      if (task) {
        updateTransfer(task.id, { status: 'success', progress: 100 });
        vibrate('heavy', vibrationEnabled);
      }
    } else if (incomingMessage.type === 'file_transfer_rejected' || incomingMessage.type === 'file_transfer_error') {
      const task = getTransfer(incomingMessage.transfer_id);
      if (task) {
        updateTransfer(task.id, { status: 'error', error: (incomingMessage as any).reason || (incomingMessage as any).message });
        vibrate('error', vibrationEnabled);
      }
    } else if (incomingMessage.type === 'incoming_file_request') {
      const task: TransferTask = {
        id: incomingMessage.transfer_id,
        direction: 'download',
        filename: incomingMessage.filename,
        size: incomingMessage.size,
        status: 'waiting_for_approval',
        progress: 0,
        speedBytesPerSec: 0,
        totalChunks: incomingMessage.total_chunks,
        chunkIndex: 0,
        offset: 0,
        receivedChunks: []
      };
      setTransfers(prev => [task, ...prev]);
      vibrate('medium', vibrationEnabled);
    } else if (incomingMessage.type === 'file_chunk') {
      const task = getTransfer(incomingMessage.transfer_id);
      if (task && task.status === 'downloading' && task.receivedChunks) {
        task.receivedChunks[incomingMessage.chunk_index] = incomingMessage.chunk;
        const newOffset = task.offset + CHUNK_SIZE;
        const progress = Math.min(99, Math.round((newOffset / task.size) * 100));
        updateTransfer(task.id, { offset: newOffset, progress });
        
        onSendMessage({ type: 'file_chunk_ack', transfer_id: task.id, chunk_index: incomingMessage.chunk_index });
      }
    } else if (incomingMessage.type === 'file_transfer_end') {
      const task = getTransfer(incomingMessage.transfer_id);
      if (task && task.status === 'downloading') {
        saveDownloadedFile(task);
      }
    } else if (incomingMessage.type === 'file_transfer_cancel') {
       updateTransfer(incomingMessage.transfer_id, { status: 'cancelled' });
    }

  }, [incomingMessage]);

  return {
    transfers,
    startUpload,
    cancelTransfer,
    acceptDownload,
    rejectDownload,
    removeTransfer
  };
}
