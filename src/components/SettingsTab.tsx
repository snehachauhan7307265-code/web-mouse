import React, { useState } from 'react';
import { Smartphone, Sliders, Vibrate, Moon, Sun, Shield, Info, Terminal, Trash2, Download, Monitor, Check, RotateCcw, HelpCircle } from 'lucide-react';
import { AppSettings, ConnectionConfig, LogEntry } from '../types';
import { triggerHaptic } from '../services/websocketService';

interface SettingsTabProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  config: ConnectionConfig;
  onUpdateConfig: (newConfig: Partial<ConnectionConfig>) => void;
  logs: LogEntry[];
  onClearLogs: () => void;
  onOpenHelperGuide: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  onUpdateSettings,
  config,
  onUpdateConfig,
  logs,
  onClearLogs,
  onOpenHelperGuide,
}) => {
  const [showLogs, setShowLogs] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleResetDefaults = () => {
    onUpdateSettings({
      pointerSensitivity: 1.2,
      pointerSpeed: 1.0,
      pointerAcceleration: true,
      scrollSensitivity: 1.2,
      invertScroll: false,
      vibration: true,
      clickSound: true,
      theme: 'dark',
    });
    triggerHaptic('medium', true);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 select-none overflow-y-auto p-4 space-y-4 text-zinc-100">
      {/* Device & Identity Card */}
      <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3 shadow-md">
        <div className="flex items-center gap-2.5">
          <Smartphone className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">Device Information</h3>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-400">Device Name (Broadcast to PC)</label>
          <input
            id="input-device-name"
            type="text"
            value={settings.deviceName}
            onChange={(e) => onUpdateSettings({ deviceName: e.target.value })}
            placeholder="e.g. Sneha's Phone"
            className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Touchpad & Pointer Controls */}
      <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4 shadow-md">
        <div className="flex items-center gap-2.5">
          <Sliders className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">Pointer & Touchpad</h3>
        </div>

        {/* Pointer Sensitivity */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-300">Pointer Sensitivity</span>
            <span className="font-mono text-indigo-400 font-bold">{settings.pointerSensitivity.toFixed(1)}x</span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => onUpdateSettings({ pointerSensitivity: 0.8 })}
              className={`flex-1 py-1 text-xs rounded-lg border ${settings.pointerSensitivity < 1.0 ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}
            >
              Low
            </button>
            <button 
              onClick={() => onUpdateSettings({ pointerSensitivity: 1.2 })}
              className={`flex-1 py-1 text-xs rounded-lg border ${settings.pointerSensitivity >= 1.0 && settings.pointerSensitivity < 2.0 ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}
            >
              Medium
            </button>
            <button 
              onClick={() => onUpdateSettings({ pointerSensitivity: 2.2 })}
              className={`flex-1 py-1 text-xs rounded-lg border ${settings.pointerSensitivity >= 2.0 ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}
            >
              High
            </button>
          </div>
          <input
            id="setting-pointer-sensitivity"
            type="range"
            min="0.5"
            max="3.0"
            step="0.1"
            value={settings.pointerSensitivity}
            onChange={(e) => onUpdateSettings({ pointerSensitivity: parseFloat(e.target.value) })}
            className="w-full accent-indigo-500 cursor-pointer"
          />
        </div>

        {/* Pointer Speed Multiplier */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-300">Pointer Speed</span>
            <span className="font-mono text-indigo-400 font-bold">{settings.pointerSpeed.toFixed(1)}x</span>
          </div>
          <input
            id="setting-pointer-speed"
            type="range"
            min="0.5"
            max="2.5"
            step="0.1"
            value={settings.pointerSpeed}
            onChange={(e) => onUpdateSettings({ pointerSpeed: parseFloat(e.target.value) })}
            className="w-full accent-indigo-500 cursor-pointer"
          />
        </div>

        {/* Pointer Acceleration Toggle */}
        <div className="flex items-center justify-between py-1 border-t border-zinc-800/80 pt-3">
          <div>
            <p className="text-xs font-medium text-zinc-200">Pointer Acceleration</p>
            <p className="text-[11px] text-zinc-400">Dynamic curve for high precision vs rapid sweeps</p>
          </div>
          <input
            id="setting-pointer-accel"
            type="checkbox"
            checked={settings.pointerAcceleration}
            onChange={(e) => onUpdateSettings({ pointerAcceleration: e.target.checked })}
            className="w-4 h-4 accent-indigo-500 rounded bg-zinc-900 border-zinc-700 cursor-pointer"
          />
        </div>
      </div>

      {/* Scroll & Haptics */}
      <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4 shadow-md">
        <div className="flex items-center gap-2.5">
          <Vibrate className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">Scrolling & Haptics</h3>
        </div>

        {/* Scroll Sensitivity */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-300">Scroll Sensitivity</span>
            <span className="font-mono text-indigo-400 font-bold">{settings.scrollSensitivity.toFixed(1)}x</span>
          </div>
          <input
            id="setting-scroll-sensitivity"
            type="range"
            min="0.5"
            max="3.0"
            step="0.1"
            value={settings.scrollSensitivity}
            onChange={(e) => onUpdateSettings({ scrollSensitivity: parseFloat(e.target.value) })}
            className="w-full accent-indigo-500 cursor-pointer"
          />
        </div>

        {/* Invert Scroll */}
        <div className="flex items-center justify-between border-t border-zinc-800/80 pt-3">
          <div>
            <p className="text-xs font-medium text-zinc-200">Invert Scroll Direction</p>
            <p className="text-[11px] text-zinc-400">Reverses swipe up / swipe down action</p>
          </div>
          <input
            id="setting-invert-scroll"
            type="checkbox"
            checked={settings.invertScroll}
            onChange={(e) => onUpdateSettings({ invertScroll: e.target.checked })}
            className="w-4 h-4 accent-indigo-500 rounded bg-zinc-900 border-zinc-700 cursor-pointer"
          />
        </div>

        {/* Click Sound Toggle */}
        <div className="flex items-center justify-between border-t border-zinc-800/80 pt-3">
          <div>
            <p className="text-xs font-medium text-zinc-200">Click Sound</p>
            <p className="text-[11px] text-zinc-400">Play an audible beep on clicks</p>
          </div>
          <input
            id="setting-click-sound-toggle"
            type="checkbox"
            checked={settings.clickSound}
            onChange={(e) => onUpdateSettings({ clickSound: e.target.checked })}
            className="w-4 h-4 accent-indigo-500 rounded bg-zinc-900 border-zinc-700 cursor-pointer"
          />
        </div>

        {/* Vibration Toggle */}
        <div className="flex items-center justify-between border-t border-zinc-800/80 pt-3">
          <div>
            <p className="text-xs font-medium text-zinc-200">Vibration Haptic Feedback</p>
            <p className="text-[11px] text-zinc-400">Tactile pulse on clicks, drag locks, and gestures</p>
          </div>
          <input
            id="setting-vibration-toggle"
            type="checkbox"
            checked={settings.vibration}
            onChange={(e) => {
              const next = e.target.checked;
              onUpdateSettings({ vibration: next });
              triggerHaptic('medium', next);
            }}
            className="w-4 h-4 accent-indigo-500 rounded bg-zinc-900 border-zinc-700 cursor-pointer"
          />
        </div>

        {/* Theme Toggle */}
        <div className="flex items-center justify-between border-t border-zinc-800/80 pt-3">
          <div>
            <p className="text-xs font-medium text-zinc-200">App Theme</p>
            <p className="text-[11px] text-zinc-400">Dark mode recommended for OLED power saving</p>
          </div>
          <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => onUpdateSettings({ theme: 'dark' })}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
                settings.theme === 'dark' ? 'bg-indigo-600 text-white' : 'text-zinc-400'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Dark</span>
            </button>
            <button
              onClick={() => onUpdateSettings({ theme: 'light' })}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
                settings.theme === 'light' ? 'bg-indigo-600 text-white' : 'text-zinc-400'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Light</span>
            </button>
          </div>
        </div>
      </div>

      {/* Connection & Pairing Code Settings */}
      <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3 shadow-md">
        <div className="flex items-center gap-2.5">
          <Shield className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">Default Connection Credentials</h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Computer IP</label>
            <input
              type="text"
              value={config.host}
              onChange={(e) => onUpdateConfig({ host: e.target.value })}
              placeholder="e.g. 192.168.1.x"
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3 py-2 text-xs font-mono text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Pairing Code</label>
            <input
              type="text"
              maxLength={6}
              value={config.code}
              onChange={(e) => onUpdateConfig({ code: e.target.value.replace(/\D/g, '') })}
              placeholder="483921"
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3 py-2 text-xs font-mono tracking-widest text-white"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenHelperGuide}
          className="w-full mt-1 py-2 px-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-indigo-300 flex items-center justify-center gap-2 transition-colors"
        >
          <Monitor className="w-4 h-4 text-indigo-400" />
          <span>Windows Helper Setup Instructions & Code</span>
        </button>
      </div>

      {/* Live WebSocket Traffic Logs Console */}
      <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">Live WebSocket Debugger</h3>
          </div>
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
          >
            {showLogs ? 'Hide Console' : `Show Console (${logs.length})`}
          </button>
        </div>

        {showLogs && (
          <div className="space-y-2">
            <div className="h-44 overflow-y-auto bg-zinc-950 border border-zinc-800/90 rounded-xl p-2.5 font-mono text-[11px] space-y-1 select-text">
              {logs.length === 0 ? (
                <p className="text-zinc-600 italic">No packet activity recorded yet.</p>
              ) : (
                logs.slice(-30).map((log) => (
                  <div key={log.id} className="flex gap-2 leading-tight">
                    <span className="text-zinc-500 shrink-0">{log.time}</span>
                    <span
                      className={`shrink-0 font-bold ${
                        log.type === 'tx'
                          ? 'text-indigo-400'
                          : log.type === 'rx'
                          ? 'text-emerald-400'
                          : log.type === 'err'
                          ? 'text-rose-400'
                          : 'text-zinc-400'
                      }`}
                    >
                      [{log.type.toUpperCase()}]
                    </span>
                    <span className="text-zinc-300 break-all">{log.content}</span>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={onClearLogs}
                className="px-2.5 py-1 text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear Logs</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reset Defaults */}
      <div className="flex justify-center pt-1">
        <button
          onClick={handleResetDefaults}
          className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1.5 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset All Settings to Default</span>
        </button>
      </div>

      {/* Required PART 4: About Wireless Mouse Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800/80 text-center space-y-2 shadow-lg">
        <h2 className="text-base font-bold text-white tracking-wide">Wireless Mouse V1</h2>
        <p className="text-xs font-semibold text-indigo-400">
          Phone → Computer control over Wi-Fi
        </p>
        <p className="text-[11px] text-zinc-400 max-w-xs mx-auto leading-relaxed pt-1">
          Turns an Android or iPhone smartphone into a wireless trackpad, mouse, and keyboard for a Windows computer on your local network.
        </p>
        <div className="pt-2 flex justify-center gap-3 text-[10px] text-zinc-500">
          <span>Version 1.0.0</span>
          <span>•</span>
          <span>Zero External Hardware</span>
          <span>•</span>
          <span>WebSocket Fast Lane</span>
        </div>
      </div>
    </div>
  );
};
