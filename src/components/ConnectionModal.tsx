import React, { useState } from 'react';
import { X, Wifi, ShieldCheck, Monitor, HelpCircle, ArrowRight, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { ConnectionConfig, ConnectionStatus, ConnectedDeviceInfo } from '../types';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ConnectionConfig;
  status: ConnectionStatus;
  deviceInfo: ConnectedDeviceInfo | null;
  pairedDevice: ConnectedDeviceInfo | null;
  onSaveAndConnect: (config: ConnectionConfig) => void;
  onDisconnect: () => void;
  onForgetDevice: () => void;
  onOpenHelperGuide: () => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  config,
  status,
  deviceInfo,
  pairedDevice,
  onSaveAndConnect,
  onDisconnect,
  onForgetDevice,
  onOpenHelperGuide,
}) => {
  const [host, setHost] = useState(config.host);
  const [port, setPort] = useState(config.port.toString());
  const [code, setCode] = useState(config.code);
  const [autoReconnect, setAutoReconnect] = useState(config.autoReconnect);

  React.useEffect(() => {
    if (isOpen) {
      setHost(config.host);
      setPort(config.port.toString());
      setCode(config.code);
      setAutoReconnect(config.autoReconnect);
    }
  }, [isOpen, config.host, config.port, config.code, config.autoReconnect]);

  if (!isOpen) return null;

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveAndConnect({
      host: host.trim(),
      port: parseInt(port, 10) || 8765,
      code: code.trim(),
      autoReconnect,
    });
  };

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting' || status === 'reconnecting';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        id="modal-connection-dialog"
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden text-zinc-100 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 bg-zinc-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold leading-tight">Connection Area</h2>
              <p className="text-xs text-zinc-400">Connect to Windows Local Helper</p>
            </div>
          </div>
          <button
            id="btn-close-conn-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Active Status Display */}
          <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
            isConnected
              ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
              : isConnecting
              ? 'bg-amber-950/30 border-amber-500/30 text-amber-300'
              : status === 'auth_failed'
              ? 'bg-rose-950/30 border-rose-500/30 text-rose-300'
              : 'bg-zinc-800/40 border-zinc-700/50 text-zinc-300'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full shrink-0 ${
                isConnected
                  ? 'bg-emerald-400 animate-pulse'
                  : isConnecting
                  ? 'bg-amber-400 animate-ping'
                  : status === 'auth_failed'
                  ? 'bg-rose-400'
                  : 'bg-zinc-500'
              }`} />
              <div>
                <p className="text-xs uppercase font-bold tracking-wider opacity-80">Connection Status</p>
                <p className="text-sm font-semibold capitalize">
                  {status === 'auth_failed' ? 'Pairing Code Rejected' : status}
                </p>
              </div>
            </div>

            {deviceInfo && (
              <div className="text-right">
                <p className="text-xs text-zinc-400">Computer</p>
                <p className="text-xs font-semibold text-white">{deviceInfo.computerName}</p>
                {deviceInfo.latencyMs !== undefined && (
                  <p className="text-[10px] text-emerald-400 font-mono">{deviceInfo.latencyMs} ms</p>
                )}
              </div>
            )}
          </div>

          {/* Detailed Error Banner if Auth Failed or Connection Error */}
          {status === 'auth_failed' && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">Pairing Failed</p>
                <p className="text-rose-200 mt-0.5">
                  {deviceInfo?.errorMessage || 'The 6-digit pairing code did not match the code displayed in your Windows terminal.'}
                </p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-300 space-y-2">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">Cannot Reach Windows PC</p>
                  <p className="text-amber-200 mt-0.5">
                    Ensure <code className="text-white bg-black/40 px-1 py-0.5 rounded">python webmouse_server.py</code> is running on your PC and both devices are on the same Wi-Fi.
                  </p>
                </div>
              </div>
              {typeof window !== 'undefined' && window.location.protocol === 'https:' && (
                <div className="pt-2 border-t border-amber-500/20 text-[11px] text-amber-200/90 leading-relaxed">
                  <span className="font-semibold text-white">HTTPS Deployment Note:</span> Browsers on HTTPS (like Vercel) may restrict unencrypted local WebSocket connections (<code className="text-white bg-black/30 px-1 rounded">ws://</code>). In Chrome, tap the lock/tune icon beside the address bar &rarr; Site settings &rarr; Insecure Content &rarr; Allow, or add WebMouse to your phone's Home Screen.
                </div>
              )}
            </div>
          )}

          {/* Paired Device or Manual Form */}
          {config.token ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-zinc-950/80 border border-indigo-500/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                    <Monitor className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {config.lastComputerName || pairedDevice?.computerName || 'My Laptop'}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Saved Connection • {config.host}:{config.port}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Auto-reconnect */}
              <div className="flex items-center justify-between py-2 border-t border-zinc-800/50">
                <label htmlFor="chk-auto-reconnect-paired" className="text-xs text-zinc-300 cursor-pointer">
                  Automatically reconnect
                </label>
                <input
                  id="chk-auto-reconnect-paired"
                  type="checkbox"
                  checked={autoReconnect}
                  onChange={(e) => {
                     setAutoReconnect(e.target.checked);
                     onSaveAndConnect({ ...config, autoReconnect: e.target.checked });
                  }}
                  className="w-4 h-4 accent-indigo-500 rounded bg-zinc-900 border-zinc-700 cursor-pointer"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5">
                {isConnected ? (
                  <button
                    type="button"
                    onClick={onDisconnect}
                    className="w-full py-3 px-4 rounded-xl bg-rose-600/90 hover:bg-rose-500 active:scale-[0.98] text-white font-medium text-sm transition-all shadow-lg shadow-rose-600/20"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); handleConnect(e); }}
                    disabled={isConnecting || status === 'reconnecting'}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 active:scale-[0.98] text-white font-medium text-sm transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isConnecting || status === 'reconnecting' ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Reconnecting...</span>
                      </>
                    ) : (
                      <>
                        <span>Reconnect</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
                
                <button
                  type="button"
                  onClick={onForgetDevice}
                  className="w-full py-3 px-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 active:scale-[0.98] text-zinc-300 hover:text-white font-medium text-sm transition-all"
                >
                  Forget this device
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleConnect} className="space-y-3.5">
              {/* IP Address & Port */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300 flex items-center justify-between">
                    <span>Local IP Address</span>
                    <button
                      type="button"
                      onClick={onOpenHelperGuide}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
                    >
                      <span>How to find?</span>
                    </button>
                  </label>
                  <div className="relative">
                    <input
                      id="input-computer-ip"
                      type="text"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      placeholder="e.g. 192.168.1.5"
                      disabled={isConnected}
                      className="w-full bg-zinc-950/80 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-300">Port</label>
                  <input
                    id="input-computer-port"
                    type="number"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="8765"
                    disabled={isConnected}
                    className="w-full bg-zinc-950/80 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50 text-center font-mono"
                    required
                  />
                </div>
              </div>

              {/* 6-Digit Pairing Code */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300 flex items-center justify-between">
                  <span>Pairing Code (6 Digits)</span>
                  <span className="text-[11px] text-zinc-400">Printed in terminal</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <input
                    id="input-pairing-code"
                    type="text"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 483921"
                    disabled={isConnected}
                    className="w-full bg-zinc-950/80 border border-zinc-700 rounded-xl pl-9 pr-3.5 py-2.5 text-base font-mono tracking-widest text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                    required
                  />
                </div>
              </div>

              {/* Auto-reconnect */}
              <div className="flex items-center justify-between py-1">
                <label htmlFor="chk-auto-reconnect" className="text-xs text-zinc-300 cursor-pointer">
                  Automatically reconnect if signal drops
                </label>
                <input
                  id="chk-auto-reconnect"
                  type="checkbox"
                  checked={autoReconnect}
                  onChange={(e) => setAutoReconnect(e.target.checked)}
                  className="w-4 h-4 accent-indigo-500 rounded bg-zinc-900 border-zinc-700 cursor-pointer"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-2.5">
                {isConnected ? (
                  <button
                    id="btn-disconnect"
                    type="button"
                    onClick={onDisconnect}
                    className="w-full py-3 px-4 rounded-xl bg-rose-600/90 hover:bg-rose-500 active:scale-[0.98] text-white font-medium text-sm transition-all shadow-lg shadow-rose-600/20"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    id="btn-connect"
                    type="submit"
                    disabled={isConnecting}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 active:scale-[0.98] text-white font-medium text-sm transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isConnecting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <span>Connect</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          )}

          {/* Quick Helper Guide Callout */}
          <div className="pt-2 border-t border-zinc-800/80">
            <button
              id="btn-modal-open-guide"
              type="button"
              onClick={onOpenHelperGuide}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 hover:bg-zinc-800/60 border border-zinc-800 transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <Monitor className="w-4 h-4 text-indigo-400" />
                <div>
                  <p className="text-xs font-semibold text-zinc-200">Need the Windows Helper?</p>
                  <p className="text-[11px] text-zinc-400">View code, instructions & requirements.txt</p>
                </div>
              </div>
              <HelpCircle className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
