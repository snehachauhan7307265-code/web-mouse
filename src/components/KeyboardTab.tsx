import React, { useState, useRef } from 'react';
import { 
  Send, Delete, CornerDownLeft, Space, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Keyboard as KeyboardIcon, Check, Copy, Scissors, Undo2, Layers, Monitor, RotateCcw,
  Sparkles, Key, Compass, Command
} from 'lucide-react';
import { AppSettings, OutgoingMessage } from '../types';
import { triggerHaptic } from '../services/websocketService';

interface KeyboardTabProps {
  onSendMessage: (msg: OutgoingMessage) => void;
  settings: AppSettings;
}

export const KeyboardTab: React.FC<KeyboardTabProps> = ({ onSendMessage, settings }) => {
  const [typedInput, setTypedInput] = useState('');
  const [immediateTyping, setImmediateTyping] = useState(false);
  const [activeModifiers, setActiveModifiers] = useState<{
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    win: boolean;
  }>({
    ctrl: false,
    alt: false,
    shift: false,
    win: false,
  });
  const [activeSubView, setActiveSubView] = useState<'standard' | 'nav' | 'fn'>('standard');
  const nativeInputRef = useRef<HTMLInputElement>(null);

  const pressKey = (key: string) => {
    triggerHaptic('light', settings.vibration);

    const modifiers = Object.entries(activeModifiers)
      .filter(([_, active]) => active)
      .map(([mod]) => mod);

    if (modifiers.length > 0) {
      onSendMessage({
        type: 'shortcut',
        keys: [...modifiers, key],
      });
      // Reset modifier states after chord execution
      setActiveModifiers({ ctrl: false, alt: false, shift: false, win: false });
    } else {
      onSendMessage({
        type: 'key',
        key,
      });
    }
  };

  const executeShortcut = (keys: string[]) => {
    triggerHaptic('medium', settings.vibration);
    onSendMessage({
      type: 'shortcut',
      keys,
    });
  };

  const toggleModifier = (mod: 'ctrl' | 'alt' | 'shift' | 'win') => {
    triggerHaptic('light', settings.vibration);
    setActiveModifiers((prev) => ({ ...prev, [mod]: !prev[mod] }));
  };

  const handleSendText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!typedInput) return;

    triggerHaptic('medium', settings.vibration);
    onSendMessage({
      type: 'type_text',
      text: typedInput,
    });
    setTypedInput('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (immediateTyping) {
      if (val.length > typedInput.length) {
        const diff = val.slice(typedInput.length);
        for (const char of diff) {
          onSendMessage({ type: 'key', key: char });
        }
      } else if (val.length < typedInput.length) {
        onSendMessage({ type: 'key', key: 'backspace' });
      }
    }
    setTypedInput(val);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (immediateTyping) {
      if (e.key === 'Enter') {
        onSendMessage({ type: 'key', key: 'enter' });
        setTypedInput('');
        e.preventDefault();
      }
    } else {
      if (e.key === 'Enter') {
        handleSendText();
        e.preventDefault();
      }
    }
  };

  const openMobileKeyboard = () => {
    if (nativeInputRef.current) {
      nativeInputRef.current.focus();
      triggerHaptic('light', settings.vibration);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 select-none overflow-y-auto p-4 space-y-4 pb-8">
      {/* 1. Phone Typing Bar */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-3.5 shadow-lg space-y-2 shrink-0">
        <form onSubmit={handleSendText} className="flex gap-2">
          <div className="relative flex-1">
            <input
              id="input-mobile-type-field"
              ref={nativeInputRef}
              type="text"
              value={typedInput}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              placeholder={immediateTyping ? "Instant typing to PC..." : "Type text to send to PC..."}
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 pr-10 shadow-inner"
            />
            <button
              type="button"
              onClick={openMobileKeyboard}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
              title="Focus phone keyboard"
            >
              <KeyboardIcon className="w-4 h-4" />
            </button>
          </div>

          <button
            id="btn-send-typed-text"
            type="submit"
            disabled={!typedInput}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-2xl font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95 transition-transform"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>

        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] text-zinc-500">
            Sends real keystrokes to Windows
          </span>
          <button
            type="button"
            onClick={() => setImmediateTyping(!immediateTyping)}
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border transition-colors ${
              immediateTyping
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'text-zinc-500 border-zinc-800 hover:text-zinc-300'
            }`}
          >
            {immediateTyping ? '⚡ Live Typing: ON' : 'Live Typing: OFF'}
          </button>
        </div>
      </div>

      {/* 2. Top Modifier Keys Toolbar ([ESC] [TAB] [CTRL] [ALT] [WIN]) */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-2.5 space-y-2">
        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block px-1">
          Modifiers & Special Keys
        </span>
        <div className="grid grid-cols-5 gap-1.5">
          <button
            onClick={() => pressKey('esc')}
            className="py-2.5 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-200 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
          >
            ESC
          </button>
          <button
            onClick={() => pressKey('tab')}
            className="py-2.5 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-200 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
          >
            TAB
          </button>
          <button
            onClick={() => toggleModifier('ctrl')}
            className={`py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 border ${
              activeModifiers.ctrl
                ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
            }`}
          >
            CTRL
          </button>
          <button
            onClick={() => toggleModifier('alt')}
            className={`py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 border ${
              activeModifiers.alt
                ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
            }`}
          >
            ALT
          </button>
          <button
            onClick={() => toggleModifier('win')}
            className={`py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 border ${
              activeModifiers.win
                ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
            }`}
          >
            WIN
          </button>
        </div>
      </div>

      {/* 3. Common Productivity Shortcuts Toolbar */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-2.5 space-y-2">
        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block px-1">
          Quick Shortcuts Toolbar
        </span>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Ctrl + C', keys: ['ctrl', 'c'] },
            { label: 'Ctrl + V', keys: ['ctrl', 'v'] },
            { label: 'Ctrl + X', keys: ['ctrl', 'x'] },
            { label: 'Ctrl + Z', keys: ['ctrl', 'z'] },
            { label: 'Ctrl + A', keys: ['ctrl', 'a'] },
            { label: 'Ctrl + S', keys: ['ctrl', 's'] },
            { label: 'Ctrl + F', keys: ['ctrl', 'f'] },
            { label: 'Alt + Tab', keys: ['alt', 'tab'] },
            { label: 'Alt + F4', keys: ['alt', 'f4'] },
            { label: 'Win + D', keys: ['win', 'd'] },
            { label: 'Win + E', keys: ['win', 'e'] },
            { label: 'Win + L', keys: ['win', 'l'] },
          ].map((item, idx) => (
            <button
              key={idx}
              onClick={() => executeShortcut(item.keys)}
              className="py-2.5 px-1 bg-zinc-800/90 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-200 rounded-xl text-[11px] font-semibold transition-all active:scale-95 shadow-sm border border-zinc-700/60 flex items-center justify-center text-center"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Directional Arrow Keys & Extended Navigation Cluster */}
      <div className="grid grid-cols-2 gap-3">
        {/* Navigation keys cluster */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-3 flex flex-col justify-between">
          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
            Navigation Keys
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => pressKey('home')}
              className="py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold"
            >
              Home
            </button>
            <button
              onClick={() => pressKey('end')}
              className="py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold"
            >
              End
            </button>
            <button
              onClick={() => pressKey('pageup')}
              className="py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold"
            >
              Pg Up
            </button>
            <button
              onClick={() => pressKey('pagedown')}
              className="py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold"
            >
              Pg Dn
            </button>
            <button
              onClick={() => pressKey('insert')}
              className="py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold"
            >
              Insert
            </button>
            <button
              onClick={() => pressKey('delete')}
              className="py-2 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 rounded-xl text-xs font-semibold border border-rose-500/20"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Arrow Keys Cluster */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-3 flex flex-col items-center justify-center">
          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider self-start mb-2">
            Arrow Keys
          </span>
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={() => pressKey('up')}
              className="w-12 h-10 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-200 rounded-xl flex items-center justify-center shadow-md active:scale-95"
            >
              <ArrowUp className="w-5 h-5" />
            </button>
            <div className="flex gap-1.5">
              <button
                onClick={() => pressKey('left')}
                className="w-12 h-10 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-200 rounded-xl flex items-center justify-center shadow-md active:scale-95"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => pressKey('down')}
                className="w-12 h-10 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-200 rounded-xl flex items-center justify-center shadow-md active:scale-95"
              >
                <ArrowDown className="w-5 h-5" />
              </button>
              <button
                onClick={() => pressKey('right')}
                className="w-12 h-10 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-200 rounded-xl flex items-center justify-center shadow-md active:scale-95"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Essential Primary Keyboard Actions: Space, Enter, Backspace */}
      <div className="flex gap-2">
        <button
          onClick={() => pressKey('backspace')}
          className="flex-1 py-3.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-2xl font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md"
        >
          <Delete className="w-4 h-4" />
          <span>Backspace</span>
        </button>

        <button
          onClick={() => pressKey('space')}
          className="flex-1 py-3.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-2xl font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md"
        >
          <Space className="w-4 h-4" />
          <span>Space</span>
        </button>

        <button
          onClick={() => pressKey('enter')}
          className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-2xl font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-lg shadow-indigo-600/20"
        >
          <CornerDownLeft className="w-4 h-4" />
          <span>Enter</span>
        </button>
      </div>

      {/* 6. Function Keys Bar (F1 to F12 collapsible) */}
      <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-2.5">
        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block px-1 mb-2">
          Function Keys (F1 – F12)
        </span>
        <div className="grid grid-cols-6 gap-1.5">
          {['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12'].map((fKey) => (
            <button
              key={fKey}
              onClick={() => pressKey(fKey)}
              className="py-2 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-300 rounded-xl text-[11px] font-semibold transition-all active:scale-95"
            >
              {fKey.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
