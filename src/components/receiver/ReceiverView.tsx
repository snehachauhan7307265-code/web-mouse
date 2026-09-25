import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Tv, 
  Monitor, 
  Wifi, 
  KeyRound, 
  ArrowLeft, 
  Maximize2, 
  Minimize2, 
  RefreshCw, 
  Sliders, 
  Layers, 
  FolderUp, 
  Link2, 
  FileText, 
  Image, 
  Video, 
  Trash2, 
  ExternalLink, 
  Download, 
  CheckCircle2, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  PenTool, 
  Eraser, 
  Sparkles,
  Cast,
  X,
  Compass
} from 'lucide-react';
import { receiverService, ReceiverConfig, ReceiverStatus, ConnectedController } from '../../services/receiverService';
import { DeviceType, ReceivedFile, QuickShareItem, PresentationState } from '../../types';

interface ReceiverViewProps {
  onExitReceiverMode: () => void;
  onLaunchControllerForTesting?: () => void;
}

export const ReceiverView: React.FC<ReceiverViewProps> = ({
  onExitReceiverMode,
  onLaunchControllerForTesting,
}) => {
  const [config, setConfig] = useState<ReceiverConfig>(() => receiverService.getConfig());
  const [status, setStatus] = useState<ReceiverStatus>(() => receiverService.getStatus());
  const [controller, setController] = useState<ConnectedController | null>(() => receiverService.getConnectedController());

  // Active receiver tab/view on the big screen
  const [activeScreen, setActiveScreen] = useState<'home' | 'presentation' | 'files' | 'share' | 'board' | 'projector'>('home');

  // Interactive focus grid for D-pad navigation
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const totalGridItems = 6;

  // Real-time overlays
  const [volume, setVolume] = useState<{ volume: number; isMuted: boolean }>(() => receiverService.getVolume());
  const [showVolumeHud, setShowVolumeHud] = useState(false);
  const volumeHudTimerRef = useRef<any>(null);

  const [presentation, setPresentation] = useState<PresentationState>(() => receiverService.getPresentationState());
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>(() => receiverService.getReceivedFiles());
  const [quickShareItems, setQuickShareItems] = useState<QuickShareItem[]>(() => receiverService.getQuickShareItems());
  const [activeNotification, setActiveNotification] = useState<string | null>(null);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Smart Board drawing state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState('#6366f1');
  const [penWidth, setPenWidth] = useState(4);

  // Preview file modal
  const [previewFile, setPreviewFile] = useState<ReceivedFile | null>(null);

  // Subscribe to receiverService events
  useEffect(() => {
    const unsubStatus = receiverService.addEventListener('statusChange', (newStatus, ctrl) => {
      setStatus(newStatus);
      setController(ctrl);
      if (newStatus === 'connected' && ctrl) {
        showHudNotification(`🟢 Connected to ${ctrl.name}`);
      }
    });

    const unsubNav = receiverService.addEventListener('navigation', (direction) => {
      setFocusedIndex((prev) => {
        let next = prev;
        if (direction === 'right') next = (prev + 1) % totalGridItems;
        if (direction === 'left') next = (prev - 1 + totalGridItems) % totalGridItems;
        if (direction === 'down') next = (prev + 3) % totalGridItems;
        if (direction === 'up') next = (prev - 3 + totalGridItems) % totalGridItems;
        return next;
      });
      showHudNotification(`D-Pad: ${direction.toUpperCase()}`);
    });

    const unsubSelect = receiverService.addEventListener('select', () => {
      showHudNotification(`OK / Select Triggered`);
      // Trigger action corresponding to focused item
      if (focusedIndex === 0) setActiveScreen('home');
      else if (focusedIndex === 1) setActiveScreen('presentation');
      else if (focusedIndex === 2) setActiveScreen('files');
      else if (focusedIndex === 3) setActiveScreen('share');
      else if (focusedIndex === 4) setActiveScreen('board');
      else if (focusedIndex === 5) setActiveScreen('projector');
    });

    const unsubBack = receiverService.addEventListener('back', () => {
      setActiveScreen('home');
      showHudNotification('Back pressed');
    });

    const unsubHome = receiverService.addEventListener('home', () => {
      setActiveScreen('home');
      setFocusedIndex(0);
      showHudNotification('Home Screen');
    });

    const unsubVol = receiverService.addEventListener('volumeChange', (newVol, isMuted) => {
      setVolume({ volume: newVol, isMuted });
      setShowVolumeHud(true);
      if (volumeHudTimerRef.current) clearTimeout(volumeHudTimerRef.current);
      volumeHudTimerRef.current = setTimeout(() => setShowVolumeHud(false), 2000);
    });

    const unsubPres = receiverService.addEventListener('presentationChange', (state) => {
      setPresentation(state);
      setActiveScreen('presentation');
      showHudNotification(`Slide ${state.currentSlide} / ${state.totalSlides}`);
    });

    const unsubFile = receiverService.addEventListener('fileReceived', (file) => {
      setReceivedFiles(receiverService.getReceivedFiles());
      showHudNotification(`📥 Received file: ${file.name}`);
    });

    const unsubShare = receiverService.addEventListener('quickShareReceived', (item) => {
      setQuickShareItems(receiverService.getQuickShareItems());
      setActiveScreen('share');
      showHudNotification(`🔗 Received Quick Share from ${item.senderName}`);
    });

    return () => {
      unsubStatus();
      unsubNav();
      unsubSelect();
      unsubBack();
      unsubHome();
      unsubVol();
      unsubPres();
      unsubFile();
      unsubShare();
    };
  }, [focusedIndex]);

  const showHudNotification = (text: string) => {
    setActiveNotification(text);
    setTimeout(() => {
      setActiveNotification((curr) => (curr === text ? null : curr));
    }, 2500);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleDeviceTypeChange = (type: DeviceType) => {
    receiverService.updateConfig({ type });
    setConfig(receiverService.getConfig());
  };

  const handleDeviceNameChange = (name: string) => {
    receiverService.updateConfig({ name });
    setConfig(receiverService.getConfig());
  };

  const handleRegeneratePin = () => {
    receiverService.regenerateCredentials();
    setConfig(receiverService.getConfig());
  };

  // Canvas drawing handlers for Smart Board
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const qrData = receiverService.getQRData();
  const isSmartBoard = config.type === 'smart_board';

  return (
    <div className="w-full h-[100dvh] bg-zinc-950 text-white flex flex-col overflow-hidden select-none font-sans relative">
      {/* Top TV/Board Bar */}
      <header className="h-16 px-6 bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl ${isSmartBoard ? 'bg-purple-500/20 text-purple-400' : 'bg-amber-500/20 text-amber-400'}`}>
            {isSmartBoard ? <Monitor className="w-6 h-6" /> : <Tv className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">WEBMOUSE RECEIVER</h1>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                isSmartBoard ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {isSmartBoard ? 'Smart Board' : 'Android TV'}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              {config.name} • {status === 'connected' ? `🟢 Connected: ${controller?.name}` : '🟡 Waiting for phone connection'}
            </p>
          </div>
        </div>

        {/* Center Navigation Tabs on Receiver */}
        <div className="hidden md:flex items-center gap-1 bg-zinc-950/80 p-1 rounded-2xl border border-zinc-800">
          {[
            { id: 'home', label: 'TV Home' },
            { id: 'presentation', label: 'Presentation' },
            { id: 'files', label: `Files (${receivedFiles.length})` },
            { id: 'share', label: `Quick Share (${quickShareItems.length})` },
            ...(isSmartBoard ? [{ id: 'board', label: 'Whiteboard' }] : []),
            { id: 'projector', label: 'Screen Mirror' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveScreen(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeScreen === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2">
          {onLaunchControllerForTesting && (
            <button
              onClick={onLaunchControllerForTesting}
              className="px-3 py-1.5 rounded-xl bg-indigo-600/90 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
              title="Connect this browser tab as Controller to test"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Simulate Phone</span>
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            title="Toggle 10-foot Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={onExitReceiverMode}
            className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-rose-950/40 text-zinc-300 hover:text-rose-400 border border-zinc-700/60 text-xs font-semibold transition-all flex items-center gap-1"
            title="Exit to Phone Controller Mode"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Controller Mode</span>
          </button>
        </div>
      </header>

      {/* Main Receiver Stage */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* If status is WAITING: Large Split Screen with QR, PIN, and Device Info */}
        {status === 'waiting' && activeScreen === 'home' ? (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 p-6 md:p-12 gap-8 items-center justify-center max-w-7xl mx-auto overflow-y-auto">
            {/* Left: Huge QR Code & PIN for Phone to Scan */}
            <div className="flex flex-col items-center justify-center p-8 bg-zinc-900/90 border border-zinc-800 rounded-3xl shadow-2xl space-y-6 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>RECEIVER READY — SCAN TO CONNECT</span>
              </div>

              {/* QR Code Container */}
              <div className="p-4 bg-white rounded-3xl shadow-2xl ring-4 ring-indigo-500/20">
                <QRCodeSVG
                  value={qrData}
                  size={240}
                  level="M"
                  includeMargin={false}
                />
              </div>

              {/* 6-Digit PIN Display */}
              <div className="space-y-1">
                <span className="text-xs text-zinc-400 uppercase tracking-widest font-semibold">Or enter 6-digit PIN on phone:</span>
                <div className="text-4xl font-mono font-extrabold text-white tracking-widest bg-zinc-950 px-6 py-2 rounded-2xl border border-zinc-800 inline-block shadow-inner">
                  {config.pairingCode.slice(0, 3)} {config.pairingCode.slice(3)}
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-zinc-400 pt-2">
                <button
                  onClick={handleRegeneratePin}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-300 flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>New PIN</span>
                </button>
                <span>Ensure phone & {isSmartBoard ? 'Smart Board' : 'TV'} are on same Wi-Fi</span>
              </div>
            </div>

            {/* Right: Receiver Settings & Capabilities Display */}
            <div className="flex flex-col justify-center space-y-6 p-6 md:p-8 bg-zinc-900/50 border border-zinc-800/80 rounded-3xl">
              <div>
                <span className="text-xs uppercase tracking-wider text-indigo-400 font-bold">Receiver Configuration</span>
                <h2 className="text-2xl font-bold text-white mt-1">Configure Target Screen</h2>
                <p className="text-xs text-zinc-400 mt-1">
                  This device acts as a receiver. Your phone connects to this screen over Wi-Fi as a remote, presenter, and file drop.
                </p>
              </div>

              {/* Name & Type Toggles */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-400 font-semibold block mb-1">Device Name on Network</label>
                  <input
                    type="text"
                    value={config.name}
                    onChange={(e) => handleDeviceNameChange(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 font-semibold block mb-1.5">Target Device Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleDeviceTypeChange('android_tv')}
                      className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                        !isSmartBoard
                          ? 'bg-amber-500/20 border-amber-500 text-white'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Tv className="w-5 h-5 text-amber-400" />
                      <div>
                        <div className="text-xs font-bold">Android TV</div>
                        <div className="text-[10px] text-zinc-400">D-Pad & Media Remote</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleDeviceTypeChange('smart_board')}
                      className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                        isSmartBoard
                          ? 'bg-purple-500/20 border-purple-500 text-white'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Monitor className="w-5 h-5 text-purple-400" />
                      <div>
                        <div className="text-xs font-bold">Smart Board</div>
                        <div className="text-[10px] text-zinc-400">Whiteboard & Slides</div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Advertised Capabilities */}
              <div className="pt-2 border-t border-zinc-800">
                <span className="text-xs font-semibold text-zinc-400 block mb-2">Advertised Capabilities:</span>
                <div className="flex flex-wrap gap-2">
                  {config.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="px-2.5 py-1 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-700/60 flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>{cap.replace('_', ' ')}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ACTIVE CONNECTED SCREENS */
          <div className="flex-1 flex flex-col overflow-hidden p-6 md:p-8">
            {/* Screen 1: TV Home / Focus Navigation Screen */}
            {activeScreen === 'home' && (
              <div className="flex-1 flex flex-col justify-between max-w-6xl mx-auto w-full space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Android TV Media & Apps</h2>
                    <p className="text-xs text-zinc-400">Use phone D-Pad arrows and OK to navigate between cards</p>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Controller: {controller?.name || 'Connected Phone'}</span>
                  </div>
                </div>

                {/* 6 Grid Focus Tiles */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 items-center">
                  {[
                    { id: 0, title: 'Media Player', desc: 'Music & Video Streamer', icon: Play, color: 'emerald' },
                    { id: 1, title: 'Presentation Slides', desc: 'Slide Viewer Mode', icon: Layers, color: 'purple' },
                    { id: 2, title: 'Received Files', desc: `${receivedFiles.length} files stored`, icon: FolderUp, color: 'blue' },
                    { id: 3, title: 'Quick Share', desc: `${quickShareItems.length} links & text`, icon: Link2, color: 'indigo' },
                    { id: 4, title: 'Smart Whiteboard', desc: 'Digital Touch Canvas', icon: PenTool, color: 'amber' },
                    { id: 5, title: 'Screen Projector', desc: 'Mirror Phone Screen', icon: Cast, color: 'rose' },
                  ].map((card) => {
                    const isFocused = focusedIndex === card.id;
                    const Icon = card.icon;
                    return (
                      <div
                        key={card.id}
                        onClick={() => {
                          setFocusedIndex(card.id);
                          if (card.id === 1) setActiveScreen('presentation');
                          else if (card.id === 2) setActiveScreen('files');
                          else if (card.id === 3) setActiveScreen('share');
                          else if (card.id === 4) setActiveScreen('board');
                          else if (card.id === 5) setActiveScreen('projector');
                        }}
                        className={`p-6 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between h-44 relative overflow-hidden ${
                          isFocused
                            ? 'bg-indigo-600/30 border-indigo-400 ring-4 ring-indigo-500/50 shadow-2xl scale-105'
                            : 'bg-zinc-900/80 border-zinc-800 hover:bg-zinc-900'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className={`p-3 rounded-2xl bg-zinc-800/80 text-white shadow-md`}>
                            <Icon className="w-6 h-6" />
                          </div>
                          {isFocused && (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-500 text-white text-[10px] font-extrabold uppercase tracking-widest animate-pulse">
                              Active Focus
                            </span>
                          )}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">{card.title}</h3>
                          <p className="text-xs text-zinc-400 mt-0.5">{card.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between p-4 bg-zinc-900/60 rounded-2xl border border-zinc-800 text-xs text-zinc-400">
                  <div className="flex items-center gap-3">
                    <span>Press <kbd className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-white font-mono">D-Pad</kbd> on phone remote to move focus</span>
                    <span>Press <kbd className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-white font-mono">OK</kbd> to launch mode</span>
                  </div>
                  <div>Volume: {volume.isMuted ? 'Muted' : `${volume.volume}%`}</div>
                </div>
              </div>
            )}

            {/* Screen 2: Presentation Receiver Mode */}
            {activeScreen === 'presentation' && (
              <div className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full relative">
                {presentation.isBlackScreen ? (
                  <div className="w-full h-full bg-black rounded-3xl flex items-center justify-center border border-zinc-800 shadow-2xl">
                    <p className="text-zinc-600 text-lg font-mono">Screen Blacked Out by Presenter</p>
                  </div>
                ) : (
                  <div className="w-full h-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 flex flex-col justify-between shadow-2xl relative">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                      <div>
                        <span className="text-xs uppercase text-indigo-400 font-bold">WebMouse Presentation Remote</span>
                        <h2 className="text-xl font-bold text-white">Slide {presentation.currentSlide} of {presentation.totalSlides}</h2>
                      </div>
                      <button
                        onClick={() => setActiveScreen('home')}
                        className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
                      <div className="p-4 bg-indigo-500/20 text-indigo-400 rounded-3xl">
                        <Layers className="w-16 h-16" />
                      </div>
                      <h3 className="text-3xl font-extrabold text-white">Slide {presentation.currentSlide}</h3>
                      <p className="text-zinc-400 max-w-md text-sm">
                        Advancing seamlessly from your phone. Use Next/Prev buttons on phone Presentation remote to control this slide.
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-zinc-800 text-xs text-zinc-400">
                      <span>Controls active on {controller?.name || 'Phone'}</span>
                      <div className="w-48 bg-zinc-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${(presentation.currentSlide / presentation.totalSlides) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Screen 3: Received Files Gallery */}
            {activeScreen === 'files' && (
              <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full space-y-4 overflow-hidden">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">Received Files Gallery</h2>
                    <p className="text-xs text-zinc-400">Files received directly from phone over Wi-Fi</p>
                  </div>
                  <button
                    onClick={() => setActiveScreen('home')}
                    className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  {receivedFiles.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center bg-zinc-900/50 border border-zinc-800 rounded-3xl text-zinc-500 space-y-2">
                      <FolderUp className="w-10 h-10 text-zinc-600" />
                      <p className="text-sm">No files received yet. Send photos or docs from your phone!</p>
                    </div>
                  ) : (
                    receivedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-4 hover:border-zinc-700 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl shrink-0">
                            {file.type.includes('image') ? <Image className="w-5 h-5" /> :
                             file.type.includes('video') ? <Video className="w-5 h-5" /> :
                             <FileText className="w-5 h-5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-sm text-white truncate">{file.name}</h4>
                            <p className="text-xs text-zinc-400">
                              {(file.size / 1024 / 1024).toFixed(2)} MB • From {file.senderName} • {new Date(file.receivedAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {file.dataUrl && (
                            <button
                              onClick={() => setPreviewFile(file)}
                              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
                            >
                              Preview
                            </button>
                          )}
                          {file.dataUrl && (
                            <a
                              href={file.dataUrl}
                              download={file.name}
                              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                              title="Download File"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => receiverService.deleteReceivedFile(file.id)}
                            className="p-2 rounded-xl bg-zinc-800 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 transition-colors"
                            title="Delete File"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Screen 4: Quick Share Stream */}
            {activeScreen === 'share' && (
              <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full space-y-4 overflow-hidden">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">Quick Share Inbox</h2>
                    <p className="text-xs text-zinc-400">URLs and notes pushed instantly from phone</p>
                  </div>
                  <button
                    onClick={() => setActiveScreen('home')}
                    className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3">
                  {quickShareItems.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center bg-zinc-900/50 border border-zinc-800 rounded-3xl text-zinc-500 space-y-2">
                      <Link2 className="w-10 h-10 text-zinc-600" />
                      <p className="text-sm">No links or notes received. Tap Quick Share on your phone!</p>
                    </div>
                  ) : (
                    quickShareItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3 shadow-lg"
                      >
                        <div className="flex items-center justify-between text-xs text-zinc-400">
                          <span>Received from <strong className="text-white">{item.senderName}</strong></span>
                          <span>{new Date(item.receivedAt).toLocaleTimeString()}</span>
                        </div>

                        <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800/80 font-mono text-sm text-indigo-300 break-all select-text">
                          {item.content}
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          {item.type === 'url' && (
                            <a
                              href={item.content}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Open URL</span>
                            </a>
                          )}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(item.content);
                              showHudNotification('Copied to clipboard');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors"
                          >
                            Copy
                          </button>
                          <button
                            onClick={() => receiverService.dismissQuickShare(item.id)}
                            className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs transition-colors"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Screen 5: Smart Board Digital Whiteboard */}
            {activeScreen === 'board' && (
              <div className="flex-1 flex flex-col w-full h-full space-y-3">
                <div className="flex items-center justify-between bg-zinc-900 p-3 rounded-2xl border border-zinc-800">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Smart Board Canvas</span>
                    {/* Pen colors */}
                    <div className="flex items-center gap-1.5">
                      {['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#ffffff'].map((c) => (
                        <button
                          key={c}
                          onClick={() => setPenColor(c)}
                          className={`w-6 h-6 rounded-full border-2 transition-transform ${penColor === c ? 'scale-125 border-white' : 'border-transparent'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={clearCanvas}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-rose-950/40 text-zinc-300 hover:text-rose-400 text-xs font-semibold transition-colors"
                    >
                      Clear Board
                    </button>
                    <button
                      onClick={() => setActiveScreen('home')}
                      className="p-1.5 rounded-xl bg-zinc-800 text-zinc-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 bg-zinc-900 rounded-3xl border border-zinc-800 overflow-hidden relative shadow-2xl">
                  <canvas
                    ref={canvasRef}
                    width={1600}
                    height={900}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-full cursor-crosshair touch-none bg-zinc-950"
                  />
                </div>
              </div>
            )}

            {/* Screen 6: Screen Projector / Mirroring Foundation */}
            {activeScreen === 'projector' && (
              <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full text-center space-y-4 p-8 bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl">
                <div className="p-4 bg-rose-500/20 text-rose-400 rounded-3xl">
                  <Cast className="w-16 h-16 animate-pulse" />
                </div>
                <h3 className="text-2xl font-bold text-white">Screen Projector Receiver Surface</h3>
                <p className="text-sm text-zinc-400 max-w-md">
                  WebRTC P2P signaling is configured. Controller can cast presentation slides, photos, and browser screen to this receiver.
                </p>
                <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 text-xs font-mono text-zinc-400 space-y-1 text-left w-full max-w-md">
                  <div>Protocol: WebRTC DataChannel + RTCPeerConnection</div>
                  <div>Receiver Capability: screen_receiver (Active)</div>
                  <div>Signaling State: Ready for SDP Offer / Answer</div>
                </div>
                <button
                  onClick={() => setActiveScreen('home')}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold"
                >
                  Return to Home
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Android TV Volume HUD Overlay */}
      {showVolumeHud && (
        <div className="absolute top-20 right-8 z-50 p-4 bg-zinc-900/95 border border-zinc-700 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in duration-150">
          {volume.isMuted ? <VolumeX className="w-6 h-6 text-rose-400" /> : <Volume2 className="w-6 h-6 text-indigo-400" />}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-white">
              <span>Volume</span>
              <span>{volume.isMuted ? 'Muted' : `${volume.volume}%`}</span>
            </div>
            <div className="w-36 h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-150"
                style={{ width: `${volume.isMuted ? 0 : volume.volume}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Floating Activity Notification HUD */}
      {activeNotification && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-zinc-900/95 border border-indigo-500/50 text-white text-xs font-bold rounded-full shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>{activeNotification}</span>
        </div>
      )}

      {/* Preview File Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/85 backdrop-blur-md">
          <div className="max-w-3xl w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-white text-sm truncate">{previewFile.name}</h3>
              <button
                onClick={() => setPreviewFile(null)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center justify-center max-h-[60vh] overflow-hidden rounded-2xl bg-zinc-950 p-2">
              {previewFile.type.includes('image') ? (
                <img src={previewFile.dataUrl} alt={previewFile.name} className="max-h-[55vh] object-contain rounded-xl" />
              ) : previewFile.type.includes('video') ? (
                <video src={previewFile.dataUrl} controls className="max-h-[55vh] rounded-xl" />
              ) : (
                <div className="p-8 text-center text-zinc-400 text-xs">
                  Document ready: {previewFile.name} ({(previewFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
