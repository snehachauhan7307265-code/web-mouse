import React, { useState, useRef } from 'react';
import { Send, Link2, FileUp, Image as ImageIcon, Video, History, ClipboardCopy, X } from 'lucide-react';
import { OutgoingMessage, AppSettings } from '../types';
import { triggerHaptic } from '../services/websocketService';

interface ShareTabProps {
  onSendMessage: (msg: OutgoingMessage) => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

export const ShareTab: React.FC<ShareTabProps> = ({ onSendMessage, settings, onUpdateSettings }) => {
  const [textInput, setTextInput] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [activeView, setActiveView] = useState<'menu' | 'text' | 'link' | 'file' | 'history'>('menu');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Basic transfer state
  const [transferStatus, setTransferStatus] = useState<{ filename: string; progress: number } | null>(null);

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
    const file = e.target.files?.[0];
    if (!file) return;

    triggerHaptic('heavy', settings.vibration);
    onSendMessage({ type: 'file_transfer_start', filename: file.name, size: file.size });
    
    setTransferStatus({ filename: file.name, progress: 0 });

    const reader = new FileReader();
    const chunkSize = 1024 * 512; // 512KB chunks
    let offset = 0;

    reader.onload = (e) => {
      if (!e.target?.result) return;
      const arrayBuffer = e.target.result as ArrayBuffer;
      const base64Chunk = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      
      onSendMessage({ type: 'file_chunk', chunk: base64Chunk });
      
      offset += chunkSize;
      const progress = Math.min(100, Math.round((offset / file.size) * 100));
      setTransferStatus({ filename: file.name, progress });

      if (offset < file.size) {
        readNextChunk();
      } else {
        onSendMessage({ type: 'file_transfer_end' });
        setTimeout(() => setTransferStatus(null), 2000);
      }
    };

    const readNextChunk = () => {
      const slice = file.slice(offset, offset + chunkSize);
      reader.readAsArrayBuffer(slice);
    };

    readNextChunk();
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
      
      {transferStatus && (
        <div className="mb-6 p-4 bg-indigo-900/40 border border-indigo-500/30 rounded-2xl flex flex-col gap-2">
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium text-indigo-100 truncate flex-1 mr-4">Uploading {transferStatus.filename}</span>
            <span className="text-indigo-400 font-bold">{transferStatus.progress}%</span>
          </div>
          <div className="w-full bg-indigo-950 rounded-full h-2.5 overflow-hidden">
            <div className="bg-indigo-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${transferStatus.progress}%` }}></div>
          </div>
        </div>
      )}

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
