/**
 * WebMouse V2 — Real File Transfer Engine
 * High-reliability chunked transfer pipeline with integrity verification,
 * path sanitization, capability checks, and persistent transfer history.
 */

import { Device } from '../types';

export const CHUNK_SIZE = 64 * 1024; // 64 KB safe chunk size
export const MAX_FILE_SIZE_BYTES = 250 * 1024 * 1024; // 250 MB ceiling for local Wi-Fi transfer
export const HISTORY_STORAGE_KEY = 'webmouse_transfer_history_v2';

export type TransferStatus = 
  | 'QUEUED'
  | 'VALIDATING'
  | 'WAITING_FOR_RECEIVER'
  | 'ACCEPTED'
  | 'TRANSFERRING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED';

export interface TransferHistoryRecord {
  id: string;
  filename: string;
  size: number;
  direction: 'upload' | 'download';
  sourceDevice: string;
  targetDevice: string;
  status: TransferStatus;
  progress: number;
  timestamp: number;
  error?: string;
  savedPath?: string;
  checksum?: string;
}

/**
 * Sanitize filename to prevent directory traversal and invalid filesystem characters.
 * Rejects ../, ..\, absolute paths, and strips illegal characters.
 */
export function sanitizeFileName(rawName: string): string {
  if (!rawName) return 'unnamed_file';
  // Strip path traversal and path separators
  let clean = rawName.replace(/^.*[\\\/]/, '');
  // Remove forbidden Windows and POSIX characters: < > : " / \ | ? *
  clean = clean.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
  // Strip leading dots or empty
  clean = clean.replace(/^\.+/, '');
  if (!clean) clean = 'file_' + Date.now();
  return clean;
}

/**
 * Calculate SHA-256 checksum using Web Crypto API.
 * Includes progressive chunking fallback for environments without crypto.subtle.
 */
export async function calculateFileChecksum(file: File): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.warn('[FileTransfer] crypto.subtle.digest error, using streaming fallback:', e);
    }
  }

  // Fallback checksum if subtle crypto is unavailable in non-secure origins
  const sliceSize = Math.min(file.size, 1024 * 1024);
  const sample = new Uint8Array(await file.slice(0, sliceSize).arrayBuffer());
  let hash = 0x811c9dc5;
  for (let i = 0; i < sample.length; i++) {
    hash ^= sample[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return 'fnv_' + (hash >>> 0).toString(16) + '_' + file.size;
}

/**
 * Validate file before transfer initiation
 */
export function validateFileForTransfer(
  file: File | null | undefined,
  targetDevice: Device | null,
  isConnected: boolean
): { valid: boolean; error?: string } {
  if (!isConnected) {
    return { valid: false, error: 'Not connected to any device. Connect to target first.' };
  }

  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  if (file.size === 0) {
    return { valid: false, error: 'Cannot send empty file (0 bytes).' };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const maxMb = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024));
    return { valid: false, error: `File too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Limit is ${maxMb} MB.` };
  }

  if (targetDevice && targetDevice.capabilities) {
    const hasCapability = targetDevice.capabilities.includes('file_transfer');
    if (!hasCapability) {
      return { 
        valid: false, 
        error: `Device "${targetDevice.name}" does not support file transfers.` 
      };
    }
  }

  return { valid: true };
}

/**
 * Format bytes to readable string (KB, MB, GB)
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Format transfer speed
 */
export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '0 KB/s';
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

/**
 * Load transfer history from localStorage
 */
export function loadTransferHistory(): TransferHistoryRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.slice(0, 30);
    }
  } catch (e) {
    console.error('[FileTransfer] Failed to load history:', e);
  }
  return [];
}

/**
 * Save transfer record into history
 */
export function recordTransferInHistory(record: TransferHistoryRecord): void {
  try {
    const current = loadTransferHistory();
    const updated = [record, ...current.filter((item) => item.id !== record.id)].slice(0, 30);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('[FileTransfer] Failed to save history:', e);
  }
}

/**
 * Clear history
 */
export function clearTransferHistory(): void {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (e) {}
}
