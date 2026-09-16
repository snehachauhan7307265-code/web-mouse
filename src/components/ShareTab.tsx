import React, { useState, useRef } from 'react';
import { Send, Link2, FileUp, Image as ImageIcon, ClipboardCopy, X, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
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
  const [textInput, setTextInput] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [activeView, setActiveView] = useState<'menu' | 'text' | 'link' | 'file' | 'history'>('menu');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleShareText = () => {
    if (!textInput.trim()) return;
    triggerHaptic('medium', settings.vibration);
    onSendMessage({ type: 'share_text', text: textInput });
    setTextInput('');
    setActiveView('menu');
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
    setActiveView('menu');
  };

  const handleGetClipboard = () => {
    triggerHaptic('light', settings.vibration);
    onSendMessage({ type: 'get_clipboard' });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    triggerHaptic('heavy', settings.vibration);
    files.forEach(file => {
      onStartUpload(file);
    });
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (activeView === 'text') {
    return (
      <div className="flex-1 flex flex-col p-4 bg-zinc-950 text-white animate-in slide-in-from-right-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Share Text</h2>
          <button onClick={() => setActiveView('menu')} className="p-2 bg-zinc-900 rounded-full"><X className="w-5 h-5"/></button>
        </div>
        <textarea
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Type or paste text here to send to PC clipboard..."
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none mb-4"
        />
        <button
          onClick={handleShareText}
          disabled={!textInput.trim()}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2"
        >
          <Send className="w-5 h-5" /> Send to PC Clipboard
        </button>
      </div>
    );
  }

  if (activeView === 'link') {
    return (
      <div className="flex-1 flex flex-col p-4 bg-zinc-950 text-white animate-in slide-in-from-right-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Share Link</h2>
          <button onClick={() => setActiveView('menu')} className="p-2 bg-zinc-900 rounded-full"><X className="w-5 h-5"/></button>
        </div>
        <input
          type="url"
          value={linkInput}
          onChange={(e) => setLinkInput(e.target.value)}
          placeholder="https://example.com"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 mb-4"
        />
        <button
          onClick={handleShareLink}
          disabled={!linkInput.trim()}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2"
        >
          <Link2 className="w-5 h-5" /> Open Link on PC
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 bg-zinc-950 text-white overflow-y-auto">
      <h2 className="text-2xl font-bold mb-6 mt-2 tracking-tight">Share to PC</h2>
      
      {/* Active File Transfers */}
      <div className="flex flex-col gap-3 mb-6">
        {transfers.filter(t => t.status !== 'waiting_for_approval').map(t => (
          <div key={t.id} className={`p-4 border rounded-2xl flex flex-col gap-3 ${
            t.status === 'error' ? 'bg-red-950/40 border-red-500/30' :
            t.status === 'success' ? 'bg-green-950/40 border-green-500/30' :
            'bg-zinc-900/60 border-zinc-800'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-bold uppercase tracking-wider shrink-0">
                    {t.direction === 'upload' ? 'Sent' : 'Received'}
                  </span>
                  <h3 className="font-bold text-sm text-zinc-100 truncate">{t.filename}</h3>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  {(t.size / 1024 / 1024).toFixed(2)} MB
                  {(t.status === 'uploading' || t.status === 'downloading') && t.speedBytesPerSec > 0 && ` • ${(t.speedBytesPerSec / 1024 / 1024).toFixed(1)} MB/s`}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {t.status === 'success' && <CheckCircle className="w-5 h-5 text-green-400" />}
                {t.status === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
                {t.status === 'cancelled' && <XCircle className="w-5 h-5 text-zinc-500" />}
                {t.status === 'pending' && <span className="text-xs text-zinc-500 font-semibold uppercase">Pending</span>}
                {(t.status === 'uploading' || t.status === 'downloading' || t.status === 'pending') && (
                  <button onClick={() => onCancelTransfer(t.id)} className="p-1.5 hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            
            {(t.status === 'uploading' || t.status === 'downloading') && (
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-zinc-950 rounded-full h-2 overflow-hidden">
                  <div className="bg-indigo-500 h-2 rounded-full transition-all duration-300" style={{ width: `${t.progress}%` }}></div>
                </div>
                <span className="text-xs font-bold text-indigo-400 min-w-[32px] text-right">{t.progress}%</span>
              </div>
            )}
            
            {t.error && (
              <p className="text-xs text-red-400">{t.error}</p>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => setActiveView('text')}
          className="p-4 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 rounded-2xl flex flex-col items-center justify-center gap-3 border border-zinc-800/50 transition-colors"
        >
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-full">
            <ClipboardCopy className="w-6 h-6" />
          </div>
          <span className="font-semibold text-sm text-zinc-300">Text</span>
        </button>

        <button
          onClick={() => setActiveView('link')}
          className="p-4 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 rounded-2xl flex flex-col items-center justify-center gap-3 border border-zinc-800/50 transition-colors"
        >
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-full">
            <Link2 className="w-6 h-6" />
          </div>
          <span className="font-semibold text-sm text-zinc-300">Link</span>
        </button>

        <button
          onClick={() => { fileInputRef.current?.setAttribute('accept', 'image/*'); fileInputRef.current?.click(); }}
          className="p-4 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 rounded-2xl flex flex-col items-center justify-center gap-3 border border-zinc-800/50 transition-colors"
        >
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-full">
            <ImageIcon className="w-6 h-6" />
          </div>
          <span className="font-semibold text-sm text-zinc-300">Photo</span>
        </button>

        <button
          onClick={() => { fileInputRef.current?.removeAttribute('accept'); fileInputRef.current?.click(); }}
          className="p-4 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 rounded-2xl flex flex-col items-center justify-center gap-3 border border-zinc-800/50 transition-colors"
        >
          <div className="p-3 bg-orange-500/10 text-orange-400 rounded-full">
            <FileUp className="w-6 h-6" />
          </div>
          <span className="font-semibold text-sm text-zinc-300">File</span>
        </button>
      </div>

      <input 
        type="file" 
        multiple
        className="hidden" 
        ref={fileInputRef}
        onChange={handleFileSelect}
      />

      {/* Clipboard Sync Area */}
      <div className="mt-2 space-y-3">
        <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest px-1">Clipboard Tools</h3>
        
        <div className="bg-zinc-900 border border-zinc-800/50 rounded-2xl overflow-hidden">
          <div className="p-4 flex items-center justify-between border-b border-zinc-800/50">
            <div className="flex flex-col">
              <span className="font-medium text-sm text-zinc-200">Auto-Sync Clipboard</span>
              <span className="text-xs text-zinc-500">Opt-in beta feature</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.clipboardSync || false}
                onChange={(e) => onUpdateSettings({ clipboardSync: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
            </label>
          </div>
          
          <button 
            onClick={handleGetClipboard}
            className="w-full p-4 flex items-center justify-between bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 transition-colors text-left"
          >
            <span className="font-medium text-sm text-zinc-200">Get text from PC Clipboard</span>
            <ClipboardCopy className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
