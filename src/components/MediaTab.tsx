import React from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Volume1,
  MonitorPlay, MonitorX, ChevronLeft, ChevronRight, Square
} from 'lucide-react';
import { OutgoingMessage, AppSettings } from '../types';
import { triggerHaptic } from '../services/websocketService';

interface MediaTabProps {
  onSendMessage: (msg: OutgoingMessage) => void;
  settings: AppSettings;
}

export const MediaTab: React.FC<MediaTabProps> = ({ onSendMessage, settings }) => {
  const sendMedia = (action: 'playpause' | 'nexttrack' | 'prevtrack' | 'volumeup' | 'volumedown' | 'volumemute') => {
    triggerHaptic('light', settings.vibration);
    onSendMessage({ type: 'media_control', action });
  };

  const sendPres = (action: 'start' | 'stop' | 'next' | 'prev' | 'black') => {
    triggerHaptic('medium', settings.vibration);
    onSendMessage({ type: 'presentation_control', action });
  };

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 text-white overflow-y-auto">
      <div className="p-4 space-y-8">
        
        {/* Media Controls */}
        <section>
          <h2 className="text-xl font-bold mb-4 tracking-tight">Media</h2>
          
          <div className="bg-zinc-900 border border-zinc-800/80 rounded-3xl p-6 flex flex-col gap-8 shadow-inner">
            {/* Playback */}
            <div className="flex items-center justify-center gap-6">
              <button onClick={() => sendMedia('prevtrack')} className="p-4 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 rounded-full transition-colors shadow-sm">
                <SkipBack className="w-7 h-7 text-zinc-300" />
              </button>
              
              <button onClick={() => sendMedia('playpause')} className="p-6 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-full transition-colors shadow-lg shadow-indigo-500/20">
                <div className="flex items-center gap-1">
                  <Play className="w-8 h-8 fill-white" />
                  <Pause className="w-8 h-8 fill-white" />
                </div>
              </button>
              
              <button onClick={() => sendMedia('nexttrack')} className="p-4 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 rounded-full transition-colors shadow-sm">
                <SkipForward className="w-7 h-7 text-zinc-300" />
              </button>
            </div>
            
            {/* Volume */}
            <div className="flex items-center justify-center gap-4 border-t border-zinc-800/80 pt-6">
              <button onClick={() => sendMedia('volumemute')} className="p-3 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 rounded-xl transition-colors">
                <VolumeX className="w-5 h-5 text-zinc-400" />
              </button>
              <button onClick={() => sendMedia('volumedown')} className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 rounded-xl transition-colors flex items-center justify-center">
                <Volume1 className="w-5 h-5 text-zinc-300" />
              </button>
              <button onClick={() => sendMedia('volumeup')} className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 rounded-xl transition-colors flex items-center justify-center">
                <Volume2 className="w-5 h-5 text-zinc-300" />
              </button>
            </div>
          </div>
        </section>

        {/* Presentation Controls */}
        <section>
          <h2 className="text-xl font-bold mb-4 tracking-tight">Presentation</h2>
          
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => sendPres('prev')} className="col-span-1 p-6 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 rounded-2xl flex flex-col items-center justify-center gap-3 border border-zinc-800/50">
              <ChevronLeft className="w-8 h-8 text-zinc-400" />
              <span className="font-semibold text-sm text-zinc-300">Previous</span>
            </button>
            
            <button onClick={() => sendPres('next')} className="col-span-1 p-6 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 rounded-2xl flex flex-col items-center justify-center gap-3 border border-zinc-800/50">
              <ChevronRight className="w-8 h-8 text-zinc-400" />
              <span className="font-semibold text-sm text-zinc-300">Next</span>
            </button>

            <button onClick={() => sendPres('start')} className="col-span-1 p-4 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 rounded-2xl flex flex-col items-center justify-center gap-2 border border-zinc-800/50">
              <MonitorPlay className="w-5 h-5 text-emerald-400" />
              <span className="font-medium text-xs text-zinc-400">Start (F5)</span>
            </button>

            <button onClick={() => sendPres('stop')} className="col-span-1 p-4 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 rounded-2xl flex flex-col items-center justify-center gap-2 border border-zinc-800/50">
              <MonitorX className="w-5 h-5 text-rose-400" />
              <span className="font-medium text-xs text-zinc-400">Exit (Esc)</span>
            </button>

            <button onClick={() => sendPres('black')} className="col-span-2 p-4 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 rounded-2xl flex items-center justify-center gap-3 border border-zinc-800/50">
              <Square className="w-4 h-4 fill-black text-black" />
              <span className="font-medium text-sm text-zinc-300">Black Screen (B)</span>
            </button>
          </div>
        </section>

      </div>
    </div>
  );
};
