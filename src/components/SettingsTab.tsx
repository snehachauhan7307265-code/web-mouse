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
    <div className="flex-1 flex flex-col h-full bg-zinc-950 select-none overflow-y-auto p-4 sm:p-6 space-y-4 text-zinc-100 max-w-3xl mx-auto w-full pb-12">
      {/* Device & Identity Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3 shadow-md">
        <div className="flex items-center gap-2.5">
          <Smartphone className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">Device Information</h3>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-400">Device Name (Broadcast to target computers/TVs)</label>
          <input
            id="input-device-name"
            type="text"
            value={settings.deviceName}
            onChange={(e) => onUpdateSettings({ deviceName: e.target.value })}
            placeholder="e.g. Phone Controller"
            className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 shadow-inner"
          />
        </div>
      </div>

      {/* Touchpad & Pointer Controls */}
      <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4 shadow-md">
        <div className="flex items-center gap-2.5">
          <Sliders className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">Pointer & Touchpad Preferences</h3>
        </div>

        {/* Pointer Sensitivity */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-300">Pointer Sensitivity</span>
            <span className="font-mono text-indigo-400 font-bold">{settings.pointerSensitivity.toFixed(1)}x</span>
          </div>
          <div className="flex gap-2">
            {[0.8, 1.2, 2.0].map((sens, idx) => {
              const label = idx === 0 ? 'Low' : idx === 1 ? 'Medium' : 'High';
              const isSelected = Math.abs(settings.pointerSensitivity - sens) < 0.3;
              return (
                <button 
                  key={label}
                  onClick={() => onUpdateSettings({ pointerSensitivity: sens })}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-xl border transition-colors ${
                    isSelected ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Acceleration Toggle */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-xs font-medium text-white">Pointer Acceleration</p>
            <p className="text-[11px] text-zinc-500">Smooth acceleration curves for precise micro-movements</p>
          </div>
          <button
            onClick={() => onUpdateSettings({ pointerAcceleration: !settings.pointerAcceleration })}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              settings.pointerAcceleration ? 'bg-indigo-600' : 'bg-zinc-800'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                settings.pointerAcceleration ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Scroll Inversion */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-xs font-medium text-white">Invert Scroll Direction</p>
            <p className="text-[11px] text-zinc-500">Reverse natural two-finger scroll</p>
          </div>
          <button
            onClick={() => onUpdateSettings({ invertScroll: !settings.invertScroll })}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              settings.invertScroll ? 'bg-indigo-600' : 'bg-zinc-800'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                settings.invertScroll ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Haptics & Sound */}
      <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3 shadow-md">
        <div className="flex items-center gap-2.5">
          <Vibrate className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">Haptic & Tactile Feedback</h3>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-white">Vibration Feedback</p>
            <p className="text-[11px] text-zinc-500">Subtle vibration pulses on clicks and gestures</p>
          </div>
          <button
            onClick={() => onUpdateSettings({ vibration: !settings.vibration })}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              settings.vibration ? 'bg-indigo-600' : 'bg-zinc-800'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                settings.vibration ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Helper Script Guide */}
      <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3 shadow-md flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Windows Helper Setup</h3>
          <p className="text-xs text-zinc-400 mt-0.5">View instructions, Python script and troubleshooting</p>
        </div>
        <button
          onClick={onOpenHelperGuide}
          className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-semibold border border-zinc-700/80 transition-all active:scale-95"
        >
          View Guide
        </button>
      </div>

      {/* Logs section */}
      <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">Network & Event Logs</h3>
          </div>
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
          >
            {showLogs ? 'Hide Logs' : `Show (${logs.length})`}
          </button>
        </div>

        {showLogs && (
          <div className="space-y-2 pt-2">
            <div className="max-h-40 overflow-y-auto bg-zinc-950 p-3 rounded-xl border border-zinc-800 font-mono text-[10px] space-y-1">
              {logs.length === 0 ? (
                <p className="text-zinc-600">No logs recorded yet.</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="text-zinc-400">
                    <span className="text-zinc-600 mr-2">{log.time}</span>
                    <span>{log.content}</span>
                  </div>
                ))
              )}
            </div>
            {logs.length > 0 && (
              <button
                onClick={onClearLogs}
                className="text-xs text-zinc-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Logs</span>
              </button>
            )}
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

      {/* Product Information Card (Section 1: WEBMOUSE V2 / Universal Device Control) */}
      <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center space-y-2 shadow-lg">
        <h2 className="text-base font-bold text-white tracking-tight">WebMouse V2</h2>
        <p className="text-xs font-semibold text-indigo-400">
          Universal Device Control
        </p>
        <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed pt-1">
          Universal device controller turning any smartphone or browser into a wireless trackpad, keyboard, media remote, screen projector, and AI voice controller.
        </p>
        <div className="pt-2 flex justify-center gap-2.5 text-xs text-zinc-500">
          <span>Version 2.0.0</span>
          <span>·</span>
          <span>Zero External Hardware</span>
          <span>·</span>
          <span>WebSocket Fast Lane</span>
        </div>
      </div>
    </div>
  );
};
