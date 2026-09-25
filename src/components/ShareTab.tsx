import React, { useState, useRef } from 'react';
import { 
  Send, Link2, FileUp, Image as ImageIcon, ClipboardCopy, X, CheckCircle, 
  AlertCircle, XCircle, RefreshCw, FolderDown, ShieldCheck, File, Clock,
  ExternalLink, Sparkles, Copy, Check
} from 'lucide-react';
import { OutgoingMessage, AppSettings } from '../types';
import { triggerHaptic } from '../services/websocketService';
import { TransferTask } from '../hooks/useFileTransfer';

interface ShareTabProps {
  onSendMessage: (msg: OutgoingMessage) => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  transfers: TransferTask[];
  onStartUpload: (file: File) => void;
  onCancelTransfer: (id: string) => void;
}

export const ShareTab: React.FC<ShareTabProps> = ({ 
  onSendMessage, 
  settings, 
  onUpdateSettings, 
  transfers,
  onStartUpload,
  onCancelTransfer
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'files' | 'quickshare'>('files');
  const [textInput, setTextInput] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [copiedNote, setCopiedNote] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleShareText = () => {
    if (!textInput.trim()) return;
    triggerHaptic('medium', settings.vibration);
    onSendMessage({ type: 'share_text', text: textInput });
    setTextInput('');
  };

  const handleShareLink = () => {
    if (!linkInput.trim()) return;
    let url = linkInput.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    triggerHaptic('medium', settings.vibration);
    onSendMessage({ type: 'share_link', url });
    setLinkInput('');
  };

  const handleGetClipboard = () => {
    triggerHaptic('light', settings.vibration);
    onSendMessage({ type: 'get_clipboard' });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    triggerHaptic('heavy', settings.vibration);
    files.forEach((file) => {
      onStartUpload(file);
    });
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 text-white overflow-y-auto select-none p-4 space-y-4 pb-8">
      {/* Sub-tab navigation */}
      <div className="flex items-center gap-1.5 p-1 bg-zinc-900/90 rounded-2xl border border-zinc-800 shrink-0">
        <button
          onClick={() => setActiveSubTab('files')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            activeSubTab === 'files'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <FileUp className="w-4 h-4" />
          <span>File Transfer</span>
        </button>
        <button
          onClick={() => setActiveSubTab('quickshare')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            activeSubTab === 'quickshare'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Link2 className="w-4 h-4" />
          <span>Quick Share</span>
        </button>
      </div>

      {/* 1. FILE TRANSFER TAB */}
      {activeSubTab === 'files' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Upload Drop Zone / Picker Card */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-full p-6 rounded-3xl border-2 border-dashed border-indigo-500/30 hover:border-indigo-500/60 bg-gradient-to-b from-indigo-950/20 to-zinc-900/40 flex flex-col items-center justify-center text-center cursor-pointer transition-all active:scale-[0.99] group shadow-inner space-y-3"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="p-4 bg-indigo-500/10 text-indigo-400 rounded-2xl group-hover:scale-110 transition-transform">
              <FileUp className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Send Files to PC</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Tap to pick photos, videos, or documents
              </p>
            </div>
            <span className="px-3 py-1 bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 rounded-full text-[11px] font-semibold">
              Supports multiple files
            </span>
          </div>

          {/* Security sandbox info */}
          <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl text-[11px] text-zinc-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">Saved safely to PC: <strong className="text-zinc-300 font-mono">Downloads/WebMouse</strong></span>
          </div>

          {/* Transfers List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h4 className="font-bold text-xs text-zinc-300 uppercase tracking-wider">
                Transfer Activity ({transfers.length})
              </h4>
            </div>

            {transfers.length === 0 ? (
              <div className="p-8 text-center bg-zinc-900/40 border border-zinc-800/60 rounded-2xl text-xs text-zinc-500">
                No active or recent transfers
              </div>
            ) : (
              <div className="space-y-2.5">
                {transfers.map((t) => {
                  const progressPct = Math.round(t.progress * 100);
                  const isFinished = t.status === 'success';
                  const isError = t.status === 'error';
                  const isCancelled = t.status === 'cancelled';
                  const isRunning = t.status === 'uploading' || t.status === 'downloading';

                  return (
                    <div
                      key={t.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isFinished
                          ? 'bg-emerald-950/20 border-emerald-500/30'
                          : isError
                          ? 'bg-rose-950/20 border-rose-500/30'
                          : isCancelled
                          ? 'bg-zinc-900/40 border-zinc-800'
                          : 'bg-zinc-900/80 border-indigo-500/30 shadow-md'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div
                            className={`p-2 rounded-xl shrink-0 ${
                              isFinished
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : isError
                                ? 'bg-rose-500/20 text-rose-400'
                                : 'bg-indigo-500/20 text-indigo-400'
                            }`}
                          >
                            <File className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h5 className="font-bold text-xs text-white truncate">
                              {t.filename}
                            </h5>
                            <p className="text-[10px] text-zinc-400 mt-0.5">
                              {formatSize((t.size * progressPct) / 100)} / {formatSize(t.size)}
                              {isRunning && t.speedBytesPerSec > 0 && (
                                <span className="text-indigo-400 font-mono ml-1.5">
                                  • {(t.speedBytesPerSec / (1024 * 1024)).toFixed(1)} MB/s
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Status Icon & Cancel Action */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isFinished && (
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                              <CheckCircle className="w-4 h-4" />
                              <span>Done</span>
                            </span>
                          )}
                          {isError && (
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-400">
                              <AlertCircle className="w-4 h-4" />
                              <span>Failed</span>
                            </span>
                          )}
                          {isCancelled && (
                            <span className="text-[11px] text-zinc-500">Cancelled</span>
                          )}
                          {isRunning && (
                            <button
                              onClick={() => onCancelTransfer(t.id)}
                              className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors"
                              title="Cancel transfer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {isRunning && (
                        <div className="mt-3 space-y-1">
                          <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-indigo-500 h-full rounded-full transition-all duration-150"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                            <span>Transferring...</span>
                            <span>{progressPct}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. QUICK SHARE TAB */}
      {activeSubTab === 'quickshare' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Send Web Link Card */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-4 space-y-3 shadow-md">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
                <Link2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-white">Send URL to PC</h4>
                <p className="text-[10px] text-zinc-400">Opens immediately in PC default browser</p>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="url"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                placeholder="https://example.com or youtube link"
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded-2xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleShareLink}
                disabled={!linkInput.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-2xl font-semibold text-xs transition-all active:scale-95 shadow-md shadow-indigo-600/20 shrink-0"
              >
                Open on PC
              </button>
            </div>
          </div>

          {/* Send Text / Notes to Clipboard */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-4 space-y-3 shadow-md">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <ClipboardCopy className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-white">Send Text or Notes</h4>
                <p className="text-[10px] text-zinc-400">Copies directly to PC clipboard</p>
              </div>
            </div>

            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Paste or type text, codes, addresses, or notes to send to Windows clipboard..."
              className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 resize-none h-24 shadow-inner"
            />

            <button
              onClick={handleShareText}
              disabled={!textInput.trim()}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-2xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md shadow-emerald-600/20"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Copy to PC Clipboard</span>
            </button>
          </div>

          {/* PC -> Phone Clipboard Fetch */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
                <Copy className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-white">Get PC Clipboard</h4>
                <p className="text-[10px] text-zinc-400">Retrieve current copied text from Windows</p>
              </div>
            </div>
            <button
              onClick={handleGetClipboard}
              className="py-2 px-3 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 rounded-xl text-xs font-semibold border border-zinc-700 transition-all shadow-sm"
            >
              Fetch
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
