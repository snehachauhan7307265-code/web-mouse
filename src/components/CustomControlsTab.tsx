import React, { useState } from 'react';
import { 
  Plus, Trash2, ArrowUp, ArrowDown, Edit3, X, Check,
  Copy, Clipboard, Layers, Monitor, VolumeX, Camera, Activity, Save,
  Maximize, Minimize, Lock, Folder, Play, SkipForward, SkipBack,
  Volume2, Volume1, Command, Sparkles, Terminal, Globe, FileText
} from 'lucide-react';
import { CustomControl, OutgoingMessage, AppSettings } from '../types';
import { triggerHaptic } from '../services/websocketService';
import { getCustomControls, saveCustomControls, addCustomControl, deleteCustomControl, moveCustomControl } from '../utils/customControls';

interface CustomControlsTabProps {
  onSendMessage: (msg: OutgoingMessage) => void;
  settings: AppSettings;
  onOpenScreenshot?: () => void;
}

export const CustomControlsTab: React.FC<CustomControlsTabProps> = ({
  onSendMessage,
  settings,
  onOpenScreenshot,
}) => {
  const [controls, setControls] = useState<CustomControl[]>(getCustomControls);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'custom' | 'windows' | 'browser' | 'office'>('custom');

  // New Button Form State
  const [title, setTitle] = useState('');
  const [actionType, setActionType] = useState<CustomControl['type']>('shortcut');
  const [color, setColor] = useState<CustomControl['color']>('indigo');
  const [shortcutKeysInput, setShortcutKeysInput] = useState('ctrl, c');
  const [keyInput, setKeyInput] = useState('esc');
  const [mouseAction, setMouseAction] = useState<CustomControl['mouseAction']>('left_click');
  const [quickAction, setQuickAction] = useState<CustomControl['quickAction']>('desktop');
  const [textSnippet, setTextSnippet] = useState('');

  const executeControl = (control: CustomControl) => {
    triggerHaptic('medium', settings.vibration);

    switch (control.type) {
      case 'shortcut':
        if (control.shortcutKeys && control.shortcutKeys.length > 0) {
          onSendMessage({ type: 'shortcut', keys: control.shortcutKeys });
        }
        break;
      case 'key':
        if (control.key) {
          onSendMessage({ type: 'key', key: control.key });
        }
        break;
      case 'mouse':
        if (control.mouseAction) {
          onSendMessage({ type: control.mouseAction });
        }
        break;
      case 'text':
        if (control.text) {
          onSendMessage({ type: 'type_text', text: control.text });
        }
        break;
      case 'media':
        if (control.mediaAction) {
          onSendMessage({ type: 'media_control', action: control.mediaAction as any });
        }
        break;
      case 'quick':
        if (control.quickAction === 'screenshot' && onOpenScreenshot) {
          onOpenScreenshot();
        } else if (control.quickAction) {
          onSendMessage({ type: 'quick_control', action: control.quickAction as any });
        }
        break;
    }
  };

  const handleAddButton = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let shortcutKeys: string[] | undefined = undefined;
    if (actionType === 'shortcut') {
      shortcutKeys = shortcutKeysInput
        .split(/[,+\s]+/)
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean);
    }

    const created = addCustomControl({
      title: title.trim(),
      icon: 'Command',
      color,
      type: actionType,
      shortcutKeys,
      key: actionType === 'key' ? keyInput : undefined,
      mouseAction: actionType === 'mouse' ? mouseAction : undefined,
      quickAction: actionType === 'quick' ? quickAction : undefined,
      text: actionType === 'text' ? textSnippet : undefined,
    });

    setControls(getCustomControls());
    setIsAddModalOpen(false);
    setTitle('');
    setTextSnippet('');
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = deleteCustomControl(id);
    setControls(updated);
  };

  const handleMove = (id: string, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = moveCustomControl(id, direction);
    setControls(updated);
  };

  const getColorClasses = (c: CustomControl['color']) => {
    switch (c) {
      case 'indigo':
        return 'bg-indigo-950/40 border-indigo-500/40 text-indigo-300 hover:bg-indigo-900/40 hover:border-indigo-400';
      case 'emerald':
        return 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/40 hover:border-emerald-400';
      case 'amber':
        return 'bg-amber-950/40 border-amber-500/40 text-amber-300 hover:bg-amber-900/40 hover:border-amber-400';
      case 'rose':
        return 'bg-rose-950/40 border-rose-500/40 text-rose-300 hover:bg-rose-900/40 hover:border-rose-400';
      case 'blue':
        return 'bg-blue-950/40 border-blue-500/40 text-blue-300 hover:bg-blue-900/40 hover:border-blue-400';
      case 'purple':
        return 'bg-purple-950/40 border-purple-500/40 text-purple-300 hover:bg-purple-900/40 hover:border-purple-400';
      default:
        return 'bg-zinc-900/80 border-zinc-700/60 text-zinc-200 hover:bg-zinc-800 hover:border-zinc-600';
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 text-white overflow-y-auto p-4 space-y-4 select-none pb-8">
      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-zinc-900/90 rounded-2xl border border-zinc-800 shrink-0">
        <button
          onClick={() => setActiveCategory('custom')}
          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold transition-all ${
            activeCategory === 'custom'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Custom Deck
        </button>
        <button
          onClick={() => setActiveCategory('windows')}
          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold transition-all ${
            activeCategory === 'windows'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Windows
        </button>
        <button
          onClick={() => setActiveCategory('browser')}
          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold transition-all ${
            activeCategory === 'browser'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Browser
        </button>
        <button
          onClick={() => setActiveCategory('office')}
          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold transition-all ${
            activeCategory === 'office'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Office
        </button>
      </div>

      {/* 1. Custom Deck Mode */}
      {activeCategory === 'custom' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Macro Deck</h2>
              <p className="text-xs text-zinc-400">Your personalized trigger buttons</p>
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Button</span>
            </button>
          </div>

          {/* Buttons Grid */}
          <div className="grid grid-cols-2 gap-3">
            {controls.map((ctrl, idx) => (
              <div
                key={ctrl.id}
                onClick={() => executeControl(ctrl)}
                className={`p-3.5 rounded-2xl border flex flex-col justify-between min-h-[92px] cursor-pointer transition-all active:scale-[0.98] shadow-md group ${getColorClasses(
                  ctrl.color
                )}`}
              >
                <div className="flex items-start justify-between">
                  <span className="font-mono text-[10px] uppercase font-bold tracking-wider opacity-60">
                    {ctrl.type}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {idx > 0 && (
                      <button
                        onClick={(e) => handleMove(ctrl.id, 'up', e)}
                        className="p-1 hover:bg-black/30 rounded"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                    )}
                    {idx < controls.length - 1 && (
                      <button
                        onClick={(e) => handleMove(ctrl.id, 'down', e)}
                        className="p-1 hover:bg-black/30 rounded"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDelete(ctrl.id, e)}
                      className="p-1 hover:bg-black/30 text-rose-300 rounded"
                      title="Delete Button"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="mt-2">
                  <h3 className="font-bold text-sm tracking-tight">{ctrl.title}</h3>
                  <p className="text-[10px] opacity-75 font-mono truncate mt-0.5">
                    {ctrl.shortcutKeys?.join(' + ').toUpperCase() ||
                      ctrl.key?.toUpperCase() ||
                      ctrl.quickAction ||
                      ctrl.mediaAction ||
                      ctrl.text ||
                      'Action'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Windows Shortcuts */}
      {activeCategory === 'windows' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white tracking-tight">Windows System Shortcuts</h2>
            <span className="text-xs text-zinc-500 font-mono">Real Windows Input</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {[
              { title: 'Desktop', keys: ['win', 'd'], desc: 'Toggle Show Desktop' },
              { title: 'File Explorer', keys: ['win', 'e'], desc: 'Open This PC' },
              { title: 'Lock PC', action: 'lock', desc: 'Lock Windows session' },
              { title: 'Run Dialog', keys: ['win', 'r'], desc: 'Open Run prompt' },
              { title: 'Alt + Tab', keys: ['alt', 'tab'], desc: 'Switch active windows' },
              { title: 'Close Window', keys: ['alt', 'f4'], desc: 'Close current app' },
              { title: 'Task Manager', keys: ['ctrl', 'shift', 'esc'], desc: 'Open Task Manager' },
              { title: 'Task View', keys: ['win', 'tab'], desc: 'Timeline & Virtual Desktops' },
              { title: 'Snipping Tool', keys: ['win', 'shift', 's'], desc: 'Screen clip tool' },
              { title: 'Action Center', keys: ['win', 'a'], desc: 'Notifications & Quick toggles' },
              { title: 'Settings', keys: ['win', 'i'], desc: 'Windows Settings' },
              { title: 'Search Bar', keys: ['win', 's'], desc: 'Windows Search' },
            ].map((item, i) => (
              <button
                key={i}
                onClick={() => {
                  triggerHaptic('medium', settings.vibration);
                  if (item.action === 'lock') {
                    onSendMessage({ type: 'quick_control', action: 'lock' });
                  } else if (item.keys) {
                    onSendMessage({ type: 'shortcut', keys: item.keys });
                  }
                }}
                className="p-3 bg-zinc-900 border border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-800/80 rounded-2xl text-left transition-all active:scale-95"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-white">{item.title}</span>
                  <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-500/20">
                    {item.keys?.join('+').toUpperCase() || item.action?.toUpperCase()}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 leading-tight">{item.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. Browser Shortcuts */}
      {activeCategory === 'browser' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white tracking-tight">Web Browser Controls</h2>
            <span className="text-xs text-zinc-500 font-mono">Chrome / Edge / Firefox</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {[
              { title: 'New Tab', keys: ['ctrl', 't'], desc: 'Open fresh browser tab' },
              { title: 'Close Tab', keys: ['ctrl', 'w'], desc: 'Close active tab' },
              { title: 'Reopen Tab', keys: ['ctrl', 'shift', 't'], desc: 'Restore closed tab' },
              { title: 'Address Bar', keys: ['ctrl', 'l'], desc: 'Focus URL bar' },
              { title: 'Next Tab', keys: ['ctrl', 'tab'], desc: 'Switch right tab' },
              { title: 'Prev Tab', keys: ['ctrl', 'shift', 'tab'], desc: 'Switch left tab' },
              { title: 'Refresh Page', keys: ['ctrl', 'r'], desc: 'Reload current page' },
              { title: 'Hard Reload', keys: ['ctrl', 'f5'], desc: 'Reload bypassing cache' },
              { title: 'Fullscreen', keys: ['f11'], desc: 'Toggle F11 mode' },
              { title: 'Downloads', keys: ['ctrl', 'j'], desc: 'Open downloads history' },
              { title: 'History', keys: ['ctrl', 'h'], desc: 'Open browser history' },
              { title: 'DevTools', keys: ['f12'], desc: 'Inspect elements' },
            ].map((item, i) => (
              <button
                key={i}
                onClick={() => {
                  triggerHaptic('medium', settings.vibration);
                  onSendMessage({ type: 'shortcut', keys: item.keys });
                }}
                className="p-3 bg-zinc-900 border border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-800/80 rounded-2xl text-left transition-all active:scale-95"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-white">{item.title}</span>
                  <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-500/20">
                    {item.keys.join('+').toUpperCase()}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 leading-tight">{item.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. Office Shortcuts */}
      {activeCategory === 'office' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white tracking-tight">Editing & Office Shortcuts</h2>
            <span className="text-xs text-zinc-500 font-mono">Word / Excel / Docs</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {[
              { title: 'Save File', keys: ['ctrl', 's'], desc: 'Save current document' },
              { title: 'Undo Action', keys: ['ctrl', 'z'], desc: 'Step back' },
              { title: 'Redo Action', keys: ['ctrl', 'y'], desc: 'Step forward' },
              { title: 'Select All', keys: ['ctrl', 'a'], desc: 'Select entire document' },
              { title: 'Copy Selection', keys: ['ctrl', 'c'], desc: 'Copy to clipboard' },
              { title: 'Paste Selection', keys: ['ctrl', 'v'], desc: 'Paste from clipboard' },
              { title: 'Cut Selection', keys: ['ctrl', 'x'], desc: 'Cut text or item' },
              { title: 'Find in Doc', keys: ['ctrl', 'f'], desc: 'Search keyword' },
              { title: 'Print Document', keys: ['ctrl', 'p'], desc: 'Open print dialog' },
              { title: 'Bold Text', keys: ['ctrl', 'b'], desc: 'Format bold' },
              { title: 'Italic Text', keys: ['ctrl', 'i'], desc: 'Format italic' },
              { title: 'Underline Text', keys: ['ctrl', 'u'], desc: 'Format underline' },
            ].map((item, i) => (
              <button
                key={i}
                onClick={() => {
                  triggerHaptic('medium', settings.vibration);
                  onSendMessage({ type: 'shortcut', keys: item.keys });
                }}
                className="p-3 bg-zinc-900 border border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-800/80 rounded-2xl text-left transition-all active:scale-95"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-white">{item.title}</span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    {item.keys.join('+').toUpperCase()}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 leading-tight">{item.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add Custom Button Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">Create Custom Button</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddButton} className="space-y-3.5">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Button Name</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. My Macro, Discord Mute"
                  required
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Color Theme</label>
                <div className="flex items-center gap-2">
                  {(['indigo', 'emerald', 'amber', 'rose', 'blue', 'purple', 'zinc'] as const).map(
                    (c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          color === c ? 'scale-110 border-white' : 'border-transparent opacity-70'
                        } ${
                          c === 'indigo'
                            ? 'bg-indigo-600'
                            : c === 'emerald'
                            ? 'bg-emerald-600'
                            : c === 'amber'
                            ? 'bg-amber-600'
                            : c === 'rose'
                            ? 'bg-rose-600'
                            : c === 'blue'
                            ? 'bg-blue-600'
                            : c === 'purple'
                            ? 'bg-purple-600'
                            : 'bg-zinc-600'
                        }`}
                      />
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Action Type</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as any)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="shortcut">Keyboard Shortcut (e.g. Ctrl+C)</option>
                  <option value="key">Single Key (e.g. Esc, F11, Enter)</option>
                  <option value="mouse">Mouse Action (e.g. Double Click)</option>
                  <option value="quick">Quick Command (Desktop, Lock, Screenshot)</option>
                  <option value="text">Text Snippet (Type text)</option>
                </select>
              </div>

              {actionType === 'shortcut' && (
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">
                    Shortcut Keys (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={shortcutKeysInput}
                    onChange={(e) => setShortcutKeysInput(e.target.value)}
                    placeholder="e.g. ctrl, alt, del or win, d"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              )}

              {actionType === 'key' && (
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Target Key</label>
                  <input
                    type="text"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="e.g. enter, esc, f5, space"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              )}

              {actionType === 'mouse' && (
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Mouse Action</label>
                  <select
                    value={mouseAction}
                    onChange={(e) => setMouseAction(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="left_click">Left Click</option>
                    <option value="right_click">Right Click</option>
                    <option value="double_click">Double Click</option>
                    <option value="middle_click">Middle Click</option>
                  </select>
                </div>
              )}

              {actionType === 'quick' && (
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Quick Action</label>
                  <select
                    value={quickAction}
                    onChange={(e) => setQuickAction(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="desktop">Desktop (Win + D)</option>
                    <option value="screenshot">Take Screenshot</option>
                    <option value="alttab">Alt + Tab</option>
                    <option value="lock">Lock Windows (Win + L)</option>
                    <option value="taskmgr">Task Manager (Ctrl+Shift+Esc)</option>
                    <option value="explorer">File Explorer (Win + E)</option>
                  </select>
                </div>
              )}

              {actionType === 'text' && (
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Text Snippet to Type</label>
                  <textarea
                    value={textSnippet}
                    onChange={(e) => setTextSnippet(e.target.value)}
                    placeholder="Text typed when button is pressed..."
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none resize-none h-16"
                  />
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition-colors"
                >
                  Save Button
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
