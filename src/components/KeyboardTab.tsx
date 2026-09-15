import React, { useState, useRef } from 'react';
import { Send, Delete, CornerDownLeft, Space, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Volume2, Volume1, VolumeX, Play, Keyboard as KeyboardIcon, Check, Copy, Scissors, Undo2, Layers, Monitor, RotateCcw } from 'lucide-react';
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
  const [activeTabSubView, setActiveTabSubView] = useState<'standard' | 'fn' | 'media'>('standard');
  const nativeInputRef = useRef<HTMLInputElement>(null);

  const pressKey = (key: string) => {
    triggerHaptic('light', settings.vibration);

    // If any modifier is active, treat as shortcut or send modified key
    const modifiers = Object.entries(activeModifiers)
      .filter(([_, active]) => active)
      .map(([mod]) => mod);

    if (modifiers.length > 0) {
      onSendMessage({
        type: 'shortcut',
        keys: [...modifiers, key],
      });
      // Reset modifiers after single chord
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

  // Text Input Send Handler
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

  // Immediate character streaming for phone keyboard
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (immediateTyping) {
      if (val.length > typedInput.length) {
        // Appended characters
        const diff = val.slice(typedInput.length);
        for (const char of diff) {
          onSendMessage({ type: 'key', key: char });
        }
      } else if (val.length < typedInput.length) {
        // Deleted character
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
    <div className="flex-1 flex flex-col h-full bg-zinc-950 select-none overflow-y-auto p-3 space-y-3">
      {/* Phone Typing Bar & Native Keyboard Trigger */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3 shadow-lg shrink-0">
        <form onSubmit={handleSendText} className="flex gap-2">
          <div className="relative flex-1">
            <input
              id="input-mobile-type-field"
              ref={nativeInputRef}
              type="text"
              value={typedInput}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              placeholder={immediateTyping ? "Instant typing active..." : "Type here to send text..."}
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 pr-10"
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
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white rounded-xl font-medium text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95 transition-transform"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>

        <div className="flex items-center justify-between mt-2.5 px-1 text-[11px] text-zinc-400">
          <span>Tap icon to summon native phone keyboard</span>
          <label className="flex items-center gap-1.5 cursor-pointer text-zinc-300">
            <input
              type="checkbox"
              checked={immediateTyping}
              onChange={(e) => setImmediateTyping(e.target.checked)}
              className="w-3.5 h-3.5 accent-indigo-500 rounded"
            />
            <span>Instant streaming</span>
          </label>
        </div>
      </div>

      {/* Useful Windows Shortcuts Bar */}
      <div className="space-y-1.5 shrink-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 px-1">Windows Shortcuts</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <button
            id="btn-shortcut-ctrl-c"
            onClick={() => executeShortcut(['ctrl', 'c'])}
            className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm"
          >
            <Copy className="w-3.5 h-3.5 text-indigo-400" />
            <span>Ctrl + C</span>
          </button>

          <button
            id="btn-shortcut-ctrl-v"
            onClick={() => executeShortcut(['ctrl', 'v'])}
            className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm"
          >
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ctrl + V</span>
          </button>

          <button
            id="btn-shortcut-ctrl-x"
            onClick={() => executeShortcut(['ctrl', 'x'])}
            className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm"
          >
            <Scissors className="w-3.5 h-3.5 text-amber-400" />
            <span>Ctrl + X</span>
          </button>

          <button
            id="btn-shortcut-ctrl-z"
            onClick={() => executeShortcut(['ctrl', 'z'])}
            className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm"
          >
            <Undo2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Ctrl + Z</span>
          </button>

          <button
            id="btn-shortcut-alt-tab"
            onClick={() => executeShortcut(['alt', 'tab'])}
            className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm"
          >
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>Alt + Tab</span>
          </button>

          <button
            id="btn-shortcut-win-d"
            onClick={() => executeShortcut(['win', 'd'])}
            className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm"
          >
            <Monitor className="w-3.5 h-3.5 text-blue-400" />
            <span>Win + D</span>
          </button>
        </div>
      </div>

      {/* Sub-view switcher: Standard keys / Function keys / Media keys */}
      <div className="flex bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 shrink-0">
        <button
          onClick={() => setActiveTabSubView('standard')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTabSubView === 'standard' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Special & Navigation
        </button>
        <button
          onClick={() => setActiveTabSubView('fn')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTabSubView === 'fn' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Function (F1–F12)
        </button>
        <button
          onClick={() => setActiveTabSubView('media')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTabSubView === 'media' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Media & Volume
        </button>
      </div>

      {/* View 1: Standard Key Cluster (Esc, Tab, Enter, Backspace, Modifiers, Arrows) */}
      {activeTabSubView === 'standard' && (
        <div className="space-y-3">
          {/* Top Row: Esc, Tab, Delete, Backspace */}
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => pressKey('escape')}
              className="py-3 px-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-300 active:scale-95 shadow-sm"
            >
              ESC
            </button>
            <button
              onClick={() => pressKey('tab')}
              className="py-3 px-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-300 active:scale-95 shadow-sm"
            >
              TAB
            </button>
            <button
              onClick={() => pressKey('delete')}
              className="py-3 px-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-rose-300 active:scale-95 shadow-sm"
            >
              DEL
            </button>
            <button
              onClick={() => pressKey('backspace')}
              className="py-3 px-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-300 active:scale-95 shadow-sm flex items-center justify-center gap-1"
            >
              <Delete className="w-4 h-4" />
              <span>BKSP</span>
            </button>
          </div>

          {/* Modifiers Row (Ctrl, Alt, Shift, Windows Key) */}
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => toggleModifier('ctrl')}
              className={`py-3 px-2 rounded-xl border text-xs font-bold active:scale-95 transition-all shadow-sm ${
                activeModifiers.ctrl
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-600/30'
                  : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
              }`}
            >
              CTRL {activeModifiers.ctrl && '•'}
            </button>
            <button
              onClick={() => toggleModifier('alt')}
              className={`py-3 px-2 rounded-xl border text-xs font-bold active:scale-95 transition-all shadow-sm ${
                activeModifiers.alt
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-600/30'
                  : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
              }`}
            >
              ALT {activeModifiers.alt && '•'}
            </button>
            <button
              onClick={() => toggleModifier('shift')}
              className={`py-3 px-2 rounded-xl border text-xs font-bold active:scale-95 transition-all shadow-sm ${
                activeModifiers.shift
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-600/30'
                  : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
              }`}
            >
              SHIFT {activeModifiers.shift && '•'}
            </button>
            <button
              onClick={() => pressKey('win')}
              className="py-3 px-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-blue-400 active:scale-95 shadow-sm"
            >
              WIN ❖
            </button>
          </div>

          {/* Space & Enter Big Row */}
          <div className="grid grid-cols-12 gap-2">
            <button
              onClick={() => pressKey('space')}
              className="col-span-8 py-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-300 active:scale-95 shadow-sm flex items-center justify-center gap-2"
            >
              <Space className="w-4 h-4 text-zinc-500" />
              <span>SPACEBAR</span>
            </button>

            <button
              onClick={() => pressKey('enter')}
              className="col-span-4 py-3.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 border border-emerald-500 text-xs font-bold text-white active:scale-95 shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-1.5"
            >
              <CornerDownLeft className="w-4 h-4" />
              <span>ENTER</span>
            </button>
          </div>

          {/* Directional Arrow Keys Cluster */}
          <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl flex flex-col items-center justify-center">
            <p className="text-[10px] font-bold tracking-wider uppercase text-zinc-500 mb-2">Arrow Navigation</p>
            <div className="grid grid-cols-3 gap-2 w-48">
              <div />
              <button
                id="btn-arrow-up"
                onClick={() => pressKey('up')}
                className="h-12 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 flex items-center justify-center text-zinc-100 border border-zinc-700 shadow-md"
              >
                <ArrowUp className="w-5 h-5" />
              </button>
              <div />

              <button
                id="btn-arrow-left"
                onClick={() => pressKey('left')}
                className="h-12 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 flex items-center justify-center text-zinc-100 border border-zinc-700 shadow-md"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                id="btn-arrow-down"
                onClick={() => pressKey('down')}
                className="h-12 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 flex items-center justify-center text-zinc-100 border border-zinc-700 shadow-md"
              >
                <ArrowDown className="w-5 h-5" />
              </button>
              <button
                id="btn-arrow-right"
                onClick={() => pressKey('right')}
                className="h-12 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 flex items-center justify-center text-zinc-100 border border-zinc-700 shadow-md"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View 2: Function Keys (F1-F12) */}
      {activeTabSubView === 'fn' && (
        <div className="grid grid-cols-4 gap-2.5">
          {Array.from({ length: 12 }, (_, i) => `f${i + 1}`).map((fkey) => (
            <button
              key={fkey}
              onClick={() => pressKey(fkey)}
              className="py-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold uppercase text-zinc-200 active:scale-95 transition-all shadow-sm"
            >
              {fkey}
            </button>
          ))}
        </div>
      )}

      {/* View 3: Media & Quick System Keys */}
      {activeTabSubView === 'media' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => pressKey('volumemute')}
              className="p-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 flex items-center justify-center gap-2 active:scale-95 text-xs font-semibold"
            >
              <VolumeX className="w-5 h-5 text-rose-400" />
              <span>Mute</span>
            </button>
            <button
              onClick={() => pressKey('playpause')}
              className="p-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 flex items-center justify-center gap-2 active:scale-95 text-xs font-semibold"
            >
              <Play className="w-5 h-5 text-emerald-400" />
              <span>Play / Pause</span>
            </button>
            <button
              onClick={() => pressKey('volumedown')}
              className="p-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 flex items-center justify-center gap-2 active:scale-95 text-xs font-semibold"
            >
              <Volume1 className="w-5 h-5 text-zinc-300" />
              <span>Volume Down</span>
            </button>
            <button
              onClick={() => pressKey('volumeup')}
              className="p-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 flex items-center justify-center gap-2 active:scale-95 text-xs font-semibold"
            >
              <Volume2 className="w-5 h-5 text-zinc-300" />
              <span>Volume Up</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-2">
            <button
              onClick={() => executeShortcut(['win', 'l'])}
              className="p-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-amber-300 text-xs font-semibold active:scale-95"
            >
              Lock Computer (Win + L)
            </button>
            <button
              onClick={() => pressKey('printscreen')}
              className="p-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-semibold active:scale-95"
            >
              Print Screen (PrtScn)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
