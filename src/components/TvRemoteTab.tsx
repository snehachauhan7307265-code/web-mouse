import React, { useState } from 'react';
import { 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  Circle, 
  ArrowLeft, 
  Home, 
  Menu, 
  Power, 
  Volume2, 
  Volume1, 
  VolumeX, 
  Play, 
  Pause, 
  Tv, 
  Send, 
  Search,
  Sparkles,
  Layers,
  Settings
} from 'lucide-react';
import { Device, OutgoingMessage } from '../types';
import { TVRemoteCommandAction } from '../services/receiverInterfaces';
import { triggerHaptic } from '../services/websocketService';

interface TvRemoteTabProps {
  device: Device | null;
  isConnected: boolean;
  onSendMessage: (msg: OutgoingMessage) => void;
  vibrationEnabled: boolean;
}

export const TvRemoteTab: React.FC<TvRemoteTabProps> = ({
  device,
  isConnected,
  onSendMessage,
  vibrationEnabled,
}) => {
  const [inputText, setInputText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);

  const handleAction = (action: TVRemoteCommandAction) => {
    triggerHaptic('medium', vibrationEnabled);

    // Send receiver-specific command (WebMouse V2 Phase 1)
    if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
      onSendMessage({
        type: 'receiver_navigation',
        direction: action,
      });
    } else if (action === 'select') {
      onSendMessage({ type: 'receiver_select' });
    } else if (action === 'back') {
      onSendMessage({ type: 'receiver_back' });
    } else if (action === 'home') {
      onSendMessage({ type: 'receiver_home' });
    } else if (action === 'vol_up') {
      onSendMessage({ type: 'receiver_volume', action: 'increase' });
    } else if (action === 'vol_down') {
      onSendMessage({ type: 'receiver_volume', action: 'decrease' });
    } else if (action === 'mute') {
      onSendMessage({ type: 'receiver_volume', action: 'mute' });
    }

    // Also send standard tv_remote command for Windows helper compatibility
    onSendMessage({
      type: 'tv_remote',
      action,
    });
  };

  const handleSendText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    triggerHaptic('light', vibrationEnabled);
    onSendMessage({
      type: 'type_text',
      text: inputText,
    });
    setInputText('');
  };

  const handleTogglePlay = () => {
    triggerHaptic('light', vibrationEnabled);
    setIsPlaying(!isPlaying);
    onSendMessage({
      type: 'receiver_media',
      action: 'playpause',
    });
    onSendMessage({
      type: 'media_control',
      action: 'playpause',
    });
  };

  const deviceName = device?.name || 'Smart Display';
  const isAndroidTv = device?.type === 'android_tv';
  const isSmartBoard = device?.type === 'smart_board';

  return (
    <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4 pb-12 bg-zinc-950 text-white select-none">
      {/* Device Header */}
      <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/70 border border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl ${
            isAndroidTv ? 'bg-amber-500/20 text-amber-400' :
            isSmartBoard ? 'bg-purple-500/20 text-purple-400' :
            'bg-indigo-500/20 text-indigo-400'
          }`}>
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white truncate max-w-[180px]">{deviceName}</h3>
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span>{isAndroidTv ? 'Android TV Remote' : isSmartBoard ? 'Smart Board Controller' : 'Universal Remote'}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => handleAction('power')}
          className="p-2.5 rounded-xl bg-zinc-800 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 border border-zinc-700/60 active:scale-95 transition-all"
          title="Toggle Power / Sleep"
        >
          <Power className="w-4 h-4" />
        </button>
      </div>

      {/* Top Remote Control Bar: Back, Home, Menu */}
      <div className="grid grid-cols-3 gap-2.5">
        <button
          onClick={() => handleAction('back')}
          className="py-3 px-2 rounded-2xl bg-zinc-900 hover:bg-zinc-800/80 active:bg-zinc-800 border border-zinc-800 text-zinc-300 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-indigo-400" />
          <span className="text-[10px] font-semibold">Back</span>
        </button>

        <button
          onClick={() => handleAction('home')}
          className="py-3 px-2 rounded-2xl bg-zinc-900 hover:bg-zinc-800/80 active:bg-zinc-800 border border-zinc-800 text-zinc-300 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 shadow-sm"
        >
          <Home className="w-5 h-5 text-emerald-400" />
          <span className="text-[10px] font-semibold">Home</span>
        </button>

        <button
          onClick={() => handleAction('menu')}
          className="py-3 px-2 rounded-2xl bg-zinc-900 hover:bg-zinc-800/80 active:bg-zinc-800 border border-zinc-800 text-zinc-300 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 shadow-sm"
        >
          <Menu className="w-5 h-5 text-amber-400" />
          <span className="text-[10px] font-semibold">Menu</span>
        </button>
      </div>

      {/* Tactile D-PAD Controller */}
      <div className="py-2 flex flex-col items-center justify-center">
        <div className="relative w-64 h-64 rounded-full bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 shadow-2xl p-2 flex items-center justify-center ring-1 ring-zinc-800/50">
          {/* UP Button */}
          <button
            onClick={() => handleAction('up')}
            className="absolute top-2 w-16 h-14 rounded-t-full bg-zinc-800/70 hover:bg-zinc-700 active:bg-indigo-600/60 active:scale-95 text-zinc-200 hover:text-white flex items-center justify-center transition-all shadow-md group"
            title="D-Pad Up"
          >
            <ChevronUp className="w-6 h-6 text-zinc-300 group-hover:text-indigo-400 transition-colors" />
          </button>

          {/* DOWN Button */}
          <button
            onClick={() => handleAction('down')}
            className="absolute bottom-2 w-16 h-14 rounded-b-full bg-zinc-800/70 hover:bg-zinc-700 active:bg-indigo-600/60 active:scale-95 text-zinc-200 hover:text-white flex items-center justify-center transition-all shadow-md group"
            title="D-Pad Down"
          >
            <ChevronDown className="w-6 h-6 text-zinc-300 group-hover:text-indigo-400 transition-colors" />
          </button>

          {/* LEFT Button */}
          <button
            onClick={() => handleAction('left')}
            className="absolute left-2 w-14 h-16 rounded-l-full bg-zinc-800/70 hover:bg-zinc-700 active:bg-indigo-600/60 active:scale-95 text-zinc-200 hover:text-white flex items-center justify-center transition-all shadow-md group"
            title="D-Pad Left"
          >
            <ChevronLeft className="w-6 h-6 text-zinc-300 group-hover:text-indigo-400 transition-colors" />
          </button>

          {/* RIGHT Button */}
          <button
            onClick={() => handleAction('right')}
            className="absolute right-2 w-14 h-16 rounded-r-full bg-zinc-800/70 hover:bg-zinc-700 active:bg-indigo-600/60 active:scale-95 text-zinc-200 hover:text-white flex items-center justify-center transition-all shadow-md group"
            title="D-Pad Right"
          >
            <ChevronRight className="w-6 h-6 text-zinc-300 group-hover:text-indigo-400 transition-colors" />
          </button>

          {/* CENTER OK / SELECT BUTTON */}
          <button
            onClick={() => handleAction('select')}
            className="w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 active:scale-90 text-white font-bold text-sm tracking-wider flex items-center justify-center shadow-lg shadow-indigo-600/30 transition-all border border-indigo-400/30 z-10"
            title="Select / OK"
          >
            OK
          </button>
        </div>
      </div>

      {/* Media & Volume Row */}
      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={() => handleAction('vol_up')}
          className="py-3 px-1 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
        >
          <Volume2 className="w-5 h-5 text-indigo-400" />
          <span className="text-[10px] font-medium">Vol +</span>
        </button>

        <button
          onClick={() => handleAction('vol_down')}
          className="py-3 px-1 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
        >
          <Volume1 className="w-5 h-5 text-indigo-400" />
          <span className="text-[10px] font-medium">Vol -</span>
        </button>

        <button
          onClick={() => handleAction('mute')}
          className="py-3 px-1 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
        >
          <VolumeX className="w-5 h-5 text-rose-400" />
          <span className="text-[10px] font-medium">Mute</span>
        </button>

        <button
          onClick={handleTogglePlay}
          className="py-3 px-1 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
        >
          {isPlaying ? <Pause className="w-5 h-5 text-emerald-400" /> : <Play className="w-5 h-5 text-emerald-400" />}
          <span className="text-[10px] font-medium">{isPlaying ? 'Pause' : 'Play'}</span>
        </button>
      </div>

      {/* TV Search & Text Input */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-3 space-y-2">
        <div className="flex items-center gap-1.5 px-0.5">
          <Search className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-[11px] font-semibold text-zinc-300">TV Search & Text Input</span>
        </div>
        <form onSubmit={handleSendText} className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type search query to TV..."
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
