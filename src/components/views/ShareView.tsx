import React, { useState, useRef, useEffect } from 'react';
import { 
  FileUp, 
  Link2, 
  ClipboardCopy, 
  Send, 
  File as FileIcon, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  X, 
  ChevronDown,
  ShieldCheck, 
  RefreshCw, 
  FolderDown, 
  Check,
  Laptop,
  Tv,
  Monitor,
  Tablet,
  RotateCcw,
  Trash2,
  Inbox,
  AlertTriangle,
  FileCheck2,
  FileQuestion
} from 'lucide-react';
import { OutgoingMessage, AppSettings, Device, DeviceType } from '../../types';
import { TransferTask } from '../../hooks/useFileTransfer';
import { triggerHaptic } from '../../services/websocketService';
import { 
  formatBytes, 
  formatSpeed, 
  loadTransferHistory, 
  clearTransferHistory,
  TransferHistoryRecord 
} from '../../utils/fileTransferEngine';

interface ShareViewProps {
  onSendMessage: (msg: OutgoingMessage) => void;
  settings: AppSettings;
  transfers: TransferTask[];
  activeDevice: Device | null;
  devices?: Device[];
  isConnected: boolean;
  onSelectDevice?: (device: Device) => void;
  onOpenDeviceSelector?: () => void;
  onStartUpload: (file: File) => Promise<string | null>;
  onCancelTransfer: (id: string) => void;
  onAcceptDownload?: (id: string) => void;
  onRejectDownload?: (id: string) => void;
  onRemoveTransfer?: (id: string) => void;
}

export const ShareView: React.FC<ShareViewProps> = ({
  onSendMessage,
  settings,
  transfers,
  activeDevice,
  devices = [],
  isConnected,
  onSelectDevice,
  onOpenDeviceSelector,
  onStartUpload,
  onCancelTransfer,
  onAcceptDownload,
  onRejectDownload,
}) => {
  const [activeSection, setActiveSection] = useState<'files' | 'link' | 'clipboard'>('files');
  const [linkInput, setLinkInput] = useState('');
  const [clipboardInput, setClipboardInput] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [history, setHistory] = useState<TransferHistoryRecord[]>(() => loadTransferHistory());
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Sync transfer history when transfers update
  useEffect(() => {
    setHistory(loadTransferHistory());
  }, [transfers]);

  const targetName = activeDevice?.name || 'My Laptop';
  const targetType: DeviceType = activeDevice?.type || 'windows';
  const hasFileCapability = activeDevice?.capabilities
    ? activeDevice.capabilities.includes('file_transfer')
    : true; // Default to true if not explicitly restricted

  const renderDeviceIcon = (type: DeviceType) => {
    switch (type) {
      case 'android_tv': return <Tv className="w-3.5 h-3.5 text-amber-400" />;
      case 'smart_board': return <Monitor className="w-3.5 h-3.5 text-purple-400" />;
      case 'tablet': return <Tablet className="w-3.5 h-3.5 text-cyan-400" />;
      case 'windows':
      default:
        return <Laptop className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files || []);
    if (droppedFiles.length === 0) return;

    triggerHaptic('medium', settings.vibration);
    setSelectedQueue((prev) => [...prev, ...droppedFiles]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    triggerHaptic('light', settings.vibration);
    setSelectedQueue((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendQueue = async () => {
    if (selectedQueue.length === 0) return;
    triggerHaptic('heavy', settings.vibration);

    const queueToSend = [...selectedQueue];
    setSelectedQueue([]);

    for (const file of queueToSend) {
      await onStartUpload(file);
    }
  };

  const handleRemoveQueueItem = (index: number) => {
    setSelectedQueue((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkInput.trim()) return;
    let url = linkInput.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    triggerHaptic('medium', settings.vibration);
    onSendMessage({ type: 'share_link', url });
    setLinkInput('');
  };

  const handleSendClipboard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clipboardInput.trim()) return;
    triggerHaptic('medium', settings.vibration);
    onSendMessage({ type: 'share_text', text: clipboardInput });
    setClipboardInput('');
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleRequestClipboardFromPC = () => {
    triggerHaptic('light', settings.vibration);
    onSendMessage({ type: 'get_clipboard' });
  };

  const handleClearHistory = () => {
    clearTransferHistory();
    setHistory([]);
    triggerHaptic('light', settings.vibration);
  };

  // Incoming downloads waiting for user approval
  const pendingDownloads = transfers.filter(
    (t) => t.direction === 'download' && t.status === 'WAITING_FOR_RECEIVER'
  );

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6 overflow-y-auto pb-16 select-none animate-in fade-in duration-200">
      {/* Top Header with Target Device Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <span>FILE SHARING & QUICK SHARE</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Real Wi-Fi file transfer with integrity checks, clipboard sync & links
          </p>
        </div>

        {/* Target Device Selector */}
        <div className="relative shrink-0">
          <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
            Target Device:
          </div>
          <button
            onClick={() => {
              if (onOpenDeviceSelector) onOpenDeviceSelector();
              else setShowDeviceDropdown(!showDeviceDropdown);
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 active:scale-95 border border-zinc-700/80 text-xs font-semibold text-zinc-100 transition-all shadow-sm"
          >
            {renderDeviceIcon(targetType)}
            <span className="truncate max-w-[150px]">{targetName}</span>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 ring-2 ring-emerald-500/20' : 'bg-zinc-500'}`} />
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
          </button>

          {/* Fallback Dropdown if device selector modal not provided */}
          {showDeviceDropdown && devices.length > 0 && (
            <div className="absolute right-0 top-full mt-1.5 w-56 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-xl p-1.5 z-40 space-y-1">
              {devices.map((dev) => (
                <button
                  key={dev.id}
                  onClick={() => {
                    if (onSelectDevice) onSelectDevice(dev);
                    setShowDeviceDropdown(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-medium transition-colors ${
                    dev.id === activeDevice?.id ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {renderDeviceIcon(dev.type)}
                    <span className="truncate">{dev.name}</span>
                  </div>
                  {dev.id === activeDevice?.id && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Target Capability / Connection Notice */}
      {!isConnected ? (
        <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 flex items-center gap-3 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Not connected to {targetName}. Connect to the device to enable file transfers.</span>
        </div>
      ) : !hasFileCapability ? (
        <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30 flex items-center gap-3 text-xs text-rose-200">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>Device &quot;{targetName}&quot; does not support file transfer. Please select a Windows PC or Smart Board.</span>
        </div>
      ) : null}

      {/* Incoming File Confirmation Notification (Section 13) */}
      {pendingDownloads.length > 0 && (
        <div className="space-y-2">
          {pendingDownloads.map((t) => (
            <div
              key={t.id}
              className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg animate-in slide-in-from-top-2"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 shrink-0">
                  <Inbox className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Incoming File Request
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                      {formatBytes(t.size)}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-200 font-semibold mt-0.5">{t.filename}</p>
                  <p className="text-[11px] text-zinc-400">From {t.sourceDevice}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onAcceptDownload && onAcceptDownload(t.id)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Accept</span>
                </button>
                <button
                  onClick={() => onRejectDownload && onRejectDownload(t.id)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold active:scale-95 transition-all"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mode Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* 1. File Transfer Card */}
        <button
          onClick={() => setActiveSection('files')}
          className={`p-5 rounded-2xl border text-left transition-all active:scale-[0.98] flex flex-col justify-between h-36 ${
            activeSection === 'files'
              ? 'bg-zinc-900 border-indigo-500 shadow-lg shadow-indigo-500/10'
              : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
          }`}
        >
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 w-fit">
            <FileUp className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">File Transfer</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Direct chunked transfer to target folder
            </p>
          </div>
        </button>

        {/* 2. Quick Share Link Card */}
        <button
          onClick={() => setActiveSection('link')}
          className={`p-5 rounded-2xl border text-left transition-all active:scale-[0.98] flex flex-col justify-between h-36 ${
            activeSection === 'link'
              ? 'bg-zinc-900 border-indigo-500 shadow-lg shadow-indigo-500/10'
              : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
          }`}
        >
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 w-fit">
            <Link2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Quick Share URL</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Open webpage instantly on remote screen
            </p>
          </div>
        </button>

        {/* 3. Clipboard Sync Card */}
        <button
          onClick={() => setActiveSection('clipboard')}
          className={`p-5 rounded-2xl border text-left transition-all active:scale-[0.98] flex flex-col justify-between h-36 ${
            activeSection === 'clipboard'
              ? 'bg-zinc-900 border-indigo-500 shadow-lg shadow-indigo-500/10'
              : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
          }`}
        >
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 w-fit">
            <ClipboardCopy className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Clipboard Sync</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Push text or pull remote clipboard
            </p>
          </div>
        </button>
      </div>

      {/* Selected Action Panel */}
      <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-md">
        {activeSection === 'files' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-white">Transfer to {targetName}</h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Saved into <span className="font-mono text-zinc-200">Downloads/WebMouse Transfers</span> with SHA-256 integrity verification
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!isConnected || !hasFileCapability}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold shadow-md active:scale-95 transition-all flex items-center gap-1.5 self-start sm:self-auto"
              >
                <FileUp className="w-4 h-4" />
                <span>Choose Files</span>
              </button>
            </div>

            {/* Drag & Drop Zone */}
            <div
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-8 rounded-2xl border-2 border-dashed text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-2 ${
                isDragging
                  ? 'border-indigo-400 bg-indigo-500/10'
                  : 'border-zinc-700/80 hover:border-zinc-500 bg-zinc-950/40'
              }`}
            >
              <div className="p-3.5 rounded-2xl bg-zinc-900 text-zinc-400 border border-zinc-800 shadow-inner">
                <FileUp className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-200">
                  📁 Drop Files Here or <span className="text-indigo-400 underline underline-offset-2">Browse</span>
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Supports TXT, PDF, JPG, PNG, MP4, ZIP and all standard formats (up to 250 MB)
                </p>
              </div>
            </div>

            {/* Selected Files Staging Queue */}
            {selectedQueue.length > 0 && (
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-200">
                    Selected Files ({selectedQueue.length}) · Total{' '}
                    {formatBytes(selectedQueue.reduce((acc, f) => acc + f.size, 0))}
                  </span>
                  <button
                    onClick={() => setSelectedQueue([])}
                    className="text-zinc-500 hover:text-zinc-300 text-[11px]"
                  >
                    Clear All
                  </button>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {selectedQueue.map((f, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/90 border border-zinc-800/80 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate min-w-0">
                        <FileIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate text-zinc-200">{f.name}</span>
                        <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                          ({formatBytes(f.size)})
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveQueueItem(idx);
                        }}
                        className="text-zinc-500 hover:text-rose-400 p-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleSendQueue}
                  disabled={!isConnected || !hasFileCapability}
                  className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Send {selectedQueue.length} {selectedQueue.length === 1 ? 'File' : 'Files'} to {targetName}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {activeSection === 'link' && (
          <form onSubmit={handleSendLink} className="space-y-3">
            <div>
              <h4 className="text-sm font-bold text-white">Send Web URL / Link to {targetName}</h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Target computer will launch default browser with this link immediately
              </p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                placeholder="https://youtube.com or any web link..."
                className="flex-1 bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!linkInput.trim() || !isConnected}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all shadow-md"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Open on Device</span>
              </button>
            </div>
          </form>
        )}

        {activeSection === 'clipboard' && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-bold text-white">Clipboard Sync</h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Send text to remote clipboard or pull text from remote computer
              </p>
            </div>
            <form onSubmit={handleSendClipboard} className="space-y-2">
              <textarea
                value={clipboardInput}
                onChange={(e) => setClipboardInput(e.target.value)}
                placeholder="Type or paste text to copy into target PC clipboard..."
                rows={3}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 resize-none"
              />
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleRequestClipboardFromPC}
                  disabled={!isConnected}
                  className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 disabled:opacity-40 text-zinc-300 text-xs font-medium flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  <FolderDown className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Fetch PC Clipboard</span>
                </button>

                <button
                  type="submit"
                  disabled={!clipboardInput.trim() || !isConnected}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all shadow-md"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                  <span>{isCopied ? 'Sent to PC!' : 'Send to PC'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Active Ongoing Transfers (Section 11, 12: Real Progress & States) */}
      {transfers.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">
            Active Transfers
          </h3>
          <div className="space-y-2.5">
            {transfers.map((t) => {
              const isRunning = t.status === 'TRANSFERRING' || t.status === 'VALIDATING' || t.status === 'WAITING_FOR_RECEIVER' || t.status === 'VERIFYING';
              const isDone = t.status === 'COMPLETED';
              const isFailed = t.status === 'FAILED';
              const isCancelled = t.status === 'CANCELLED';

              return (
                <div
                  key={t.id}
                  className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-3 shadow-md"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-2.5 rounded-xl shrink-0 ${
                          isDone
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : isFailed
                            ? 'bg-rose-500/10 text-rose-400'
                            : isCancelled
                            ? 'bg-zinc-800 text-zinc-400'
                            : 'bg-indigo-500/10 text-indigo-400'
                        }`}
                      >
                        {isDone ? (
                          <FileCheck2 className="w-5 h-5" />
                        ) : isFailed ? (
                          <AlertCircle className="w-5 h-5" />
                        ) : (
                          <FileIcon className="w-5 h-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-white truncate max-w-xs sm:max-w-md">
                            {t.filename}
                          </p>
                          {/* State Badges */}
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-semibold uppercase ${
                              isDone
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : isFailed
                                ? 'bg-rose-500/20 text-rose-300'
                                : isCancelled
                                ? 'bg-zinc-800 text-zinc-400'
                                : t.status === 'VERIFYING'
                                ? 'bg-purple-500/20 text-purple-300'
                                : t.status === 'WAITING_FOR_RECEIVER'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-indigo-500/20 text-indigo-300'
                            }`}
                          >
                            {t.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {formatBytes(t.bytesTransferred)} / {formatBytes(t.size)}
                          {t.speedBytesPerSec > 0 && ` · ${formatSpeed(t.speedBytesPerSec)}`}
                          {' · '}
                          {t.direction === 'upload' ? `Sent to ${t.targetDevice}` : `Received from ${t.sourceDevice}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isRunning && (
                        <button
                          onClick={() => onCancelTransfer(t.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-300 text-xs font-medium transition-colors"
                          title="Cancel Transfer"
                        >
                          Cancel
                        </button>
                      )}
                      {isDone && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                          <CheckCircle className="w-4 h-4" />
                          <span>Verified</span>
                        </span>
                      )}
                      {isFailed && t.file && (
                        <button
                          onClick={() => onStartUpload(t.file!)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-900/40 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold transition-colors flex items-center gap-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Retry</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Real Byte Progress Bar */}
                  {isRunning && (
                    <div className="space-y-1">
                      <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-500 h-full rounded-full transition-all duration-200"
                          style={{ width: `${t.progress}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                        <span>
                          {t.status === 'VERIFYING'
                            ? 'Verifying SHA-256 checksum...'
                            : t.status === 'WAITING_FOR_RECEIVER'
                            ? 'Waiting for receiver acceptance...'
                            : 'Transferring data chunks...'}
                        </span>
                        <span>{t.progress}%</span>
                      </div>
                    </div>
                  )}

                  {/* Error display */}
                  {isFailed && t.error && (
                    <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-xs text-rose-300">
                      {t.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transfer History (Section 19) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-zinc-500" />
            <span>Recent Transfers</span>
          </h3>
          {history.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="text-[11px] font-medium text-zinc-500 hover:text-rose-400 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear History</span>
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 text-center space-y-2">
            <Clock className="w-6 h-6 text-zinc-600 mx-auto" />
            <p className="text-xs text-zinc-400 font-medium">No recent transfers recorded</p>
            <p className="text-[11px] text-zinc-600">
              Files verified and completed over Wi-Fi will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 10).map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      item.status === 'COMPLETED'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : item.status === 'FAILED'
                        ? 'bg-rose-500/10 text-rose-400'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    <FileIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-200 truncate">{item.filename}</p>
                    <p className="text-[10px] text-zinc-500">
                      {formatBytes(item.size)} · {item.direction === 'upload' ? `To ${item.targetDevice}` : `From ${item.sourceDevice}`} ·{' '}
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                      item.status === 'COMPLETED'
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : item.status === 'FAILED'
                        ? 'text-rose-400 bg-rose-500/10'
                        : 'text-zinc-400 bg-zinc-800'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
