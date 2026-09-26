export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'reconnecting'
  | 'connected'
  | 'auth_failed'
  | 'error';

export type DeviceType = 'windows' | 'android' | 'android_tv' | 'smart_board' | 'tablet' | 'generic';
export type DevicePlatform = 'windows' | 'android' | 'linux' | 'macos' | 'web';

export type DeviceCapability =
  | 'mouse'
  | 'keyboard'
  | 'media'
  | 'presentation'
  | 'presentation_receiver'
  | 'file_transfer'
  | 'file_receiver'
  | 'screen_receiver'
  | 'screen_sender'
  | 'screen_capture'
  | 'quick_share'
  | 'custom_controls'
  | 'tv_remote'
  | 'clipboard_sync'
  | 'touch_board'
  | 'touch';

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  platform: DevicePlatform;
  connectionState: ConnectionStatus;
  capabilities: DeviceCapability[];
  lastSeen?: number;
  paired: boolean;
  host: string;
  port: number;
  token?: string;
  pairingCode?: string;
  model?: string;
  osVersion?: string;
  screenWidth?: number;
  screenHeight?: number;
}

export interface ComputerProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  token?: string;
  pairingCode?: string;
  lastConnected?: number;
  status?: 'connected' | 'offline' | 'saved';
  type?: DeviceType;
  platform?: DevicePlatform;
  capabilities?: DeviceCapability[];
}

export type QuickActionId =
  | 'mouse'
  | 'keyboard'
  | 'media'
  | 'presentation'
  | 'files'
  | 'share'
  | 'custom'
  | 'screenshot'
  | 'alttab'
  | 'desktop'
  | 'lock'
  | 'volume_up'
  | 'volume_down'
  | 'mute'
  | 'copy'
  | 'paste';

export interface CustomControl {
  id: string;
  title: string;
  icon: string;
  color: 'indigo' | 'emerald' | 'amber' | 'rose' | 'blue' | 'purple' | 'zinc';
  type: 'shortcut' | 'key' | 'mouse' | 'text' | 'media' | 'quick';
  shortcutKeys?: string[];
  key?: string;
  mouseAction?: 'left_click' | 'right_click' | 'middle_click' | 'double_click';
  text?: string;
  mediaAction?: 'playpause' | 'nexttrack' | 'prevtrack' | 'volumeup' | 'volumedown' | 'volumemute';
  quickAction?: 'desktop' | 'lock' | 'screenshot' | 'alttab' | 'taskmgr' | 'explorer' | 'snip';
}

export interface ConnectionConfig {
  host: string;
  port: number;
  code: string;
  token?: string;
  qrToken?: string;
  lastComputerName?: string;
  autoReconnect: boolean;
}

export interface AppSettings {
  deviceName: string;
  pointerSensitivity: number;
  pointerSpeed: number; // 0.8: Low, 1.0: Med, 1.5: High
  pointerAcceleration: boolean;
  scrollSensitivity: number;
  invertScroll: boolean;
  vibration: boolean;
  clickSound: boolean;
  theme: 'dark' | 'light';
  clipboardSync?: boolean; // Optional for backward compatibility with saved settings
  activeQuickActions?: QuickActionId[];
}

export interface ConnectedDeviceInfo {
  computerName: string;
  deviceType?: DeviceType;
  platform?: DevicePlatform;
  capabilities?: DeviceCapability[];
  model?: string;
  osVersion?: string;
  screenWidth?: number;
  screenHeight?: number;
  ip: string;
  port: number;
  latencyMs?: number;
  errorMessage?: string;
}

export interface ReceivedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
  receivedAt: number;
  senderName: string;
}

export interface QuickShareItem {
  id: string;
  type: 'text' | 'url';
  content: string;
  senderName: string;
  receivedAt: number;
}

export interface PresentationState {
  currentSlide: number;
  totalSlides: number;
  isBlackScreen: boolean;
  isActive: boolean;
}

export type OutgoingMessage =
  | { type: 'auth'; code: string; token?: string; deviceName: string }
  | { type: 'mouse_move'; dx: number; dy: number }
  | { type: 'left_click' }
  | { type: 'right_click' }
  | { type: 'middle_click' }
  | { type: 'double_click' }
  | { type: 'mouse_down'; button?: 'left' | 'right' | 'middle' }
  | { type: 'mouse_up'; button?: 'left' | 'right' | 'middle' }
  | { type: 'scroll'; amount: number }
  | { type: 'hscroll'; amount: number }
  | { type: 'key'; key: string }
  | { type: 'type_text'; text: string }
  | { type: 'shortcut'; keys: string[] }
  | { type: 'ping'; timestamp: number }
  | { type: 'take_screenshot' }
  | { type: 'media_control'; action: 'playpause' | 'nexttrack' | 'prevtrack' | 'volumeup' | 'volumedown' | 'volumemute' }
  | { type: 'presentation_control'; action: 'start' | 'stop' | 'next' | 'prev' | 'black' }
  | { type: 'quick_control'; action: 'desktop' | 'lock' | 'screenshot' | 'alttab' | 'taskmgr' | 'explorer' | 'snip' }
  | { type: 'tv_remote'; action: 'up' | 'down' | 'left' | 'right' | 'select' | 'back' | 'home' | 'menu' | 'power' | 'vol_up' | 'vol_down' | 'mute' }
  | { type: 'receiver_navigation'; direction: 'up' | 'down' | 'left' | 'right' }
  | { type: 'receiver_select' }
  | { type: 'receiver_back' }
  | { type: 'receiver_home' }
  | { type: 'receiver_volume'; action: 'increase' | 'decrease' | 'mute' }
  | { type: 'receiver_media'; action: 'playpause' | 'next' | 'prev' }
  | { type: 'get_device_info' }
  | { type: 'get_capabilities' }
  | { type: 'share_link'; url: string }
  | { type: 'share_text'; text: string }
  | { type: 'get_clipboard' }
  | { type: 'file_transfer_start'; filename: string; size: number; transfer_id: string; total_chunks: number }
  | { type: 'file_chunk'; transfer_id: string; chunk_index: number; chunk: string }
  | { type: 'file_transfer_end'; transfer_id: string }
  | { type: 'incoming_file_accept'; transfer_id: string }
  | { type: 'incoming_file_reject'; transfer_id: string }
  | { type: 'file_chunk_ack'; transfer_id: string; chunk_index: number }
  | { type: 'file_transfer_cancel'; transfer_id: string }
  | { type: 'webrtc_signaling'; signalType: 'offer' | 'answer' | 'ice_candidate' | 'stop'; payload?: any }
  | { type: 'webrtc_offer'; sessionId: string; fromDevice: string; toDevice: string; sdp: string }
  | { type: 'webrtc_answer'; sessionId: string; fromDevice: string; toDevice: string; sdp: string }
  | { type: 'webrtc_ice_candidate'; sessionId: string; fromDevice?: string; toDevice?: string; candidate: any }
  | { type: 'projector_start'; sessionId: string; sourceDevice: string; targetDevice: string; quality?: string; fps?: number }
  | { type: 'projector_stop'; sessionId: string; reason?: string }
  | { type: 'projector_pause'; sessionId: string }
  | { type: 'projector_resume'; sessionId: string }
  | { type: 'open_app'; app: string };

export type IncomingMessage =
  | { type: 'server_info'; ip: string; port: number; version: number }
  | { 
      type: 'auth_result'; 
      success: boolean; 
      message: string; 
      token?: string; 
      computerName?: string; 
      deviceType?: DeviceType;
      platform?: DevicePlatform;
      capabilities?: DeviceCapability[];
      model?: string;
      osVersion?: string;
      screenWidth?: number; 
      screenHeight?: number 
    }
  | { 
      type: 'device_info'; 
      name: string; 
      deviceType: DeviceType; 
      platform: DevicePlatform; 
      capabilities: DeviceCapability[]; 
      model?: string; 
      osVersion?: string; 
      screenWidth?: number; 
      screenHeight?: number 
    }
  | { type: 'capabilities'; capabilities: DeviceCapability[] }
  | { type: 'receiver_navigation'; direction: 'up' | 'down' | 'left' | 'right' }
  | { type: 'receiver_select' }
  | { type: 'receiver_back' }
  | { type: 'receiver_home' }
  | { type: 'receiver_volume'; action: 'increase' | 'decrease' | 'mute' }
  | { type: 'receiver_media'; action: 'playpause' | 'next' | 'prev' }
  | { type: 'presentation_control'; action: 'start' | 'stop' | 'next' | 'prev' | 'black' }
  | { type: 'share_link'; url: string }
  | { type: 'share_text'; text: string }
  | { type: 'type_text'; text: string }
  | { type: 'tv_remote'; action: 'up' | 'down' | 'left' | 'right' | 'select' | 'back' | 'home' | 'menu' | 'power' | 'vol_up' | 'vol_down' | 'mute' }
  | { type: 'pong'; timestamp: number }
  | { type: 'error'; message: string }
  | { type: 'notification'; message: string }
  | { type: 'clipboard_data'; text: string }
  | { type: 'screenshot_result'; success: boolean; image?: string; filename?: string; message?: string; timestamp?: number }
  | { type: 'file_transfer_accepted'; transfer_id: string }
  | { type: 'file_transfer_rejected'; transfer_id: string; reason: string }
  | { type: 'file_chunk_ack'; transfer_id: string; chunk_index: number }
  | { type: 'file_transfer_success'; transfer_id: string }
  | { type: 'file_transfer_error'; transfer_id: string; message: string }
  | { type: 'file_transfer_cancel'; transfer_id: string }
  | { type: 'incoming_file_request'; transfer_id: string; filename: string; size: number; total_chunks: number }
  | { type: 'file_chunk'; transfer_id: string; chunk_index: number; chunk: string }
  | { type: 'file_transfer_end'; transfer_id: string }
  | { type: 'webrtc_signaling'; signalType: 'offer' | 'answer' | 'ice_candidate' | 'stop'; payload?: any }
  | { type: 'webrtc_offer'; sessionId: string; fromDevice: string; toDevice: string; sdp: string }
  | { type: 'webrtc_answer'; sessionId: string; fromDevice: string; toDevice: string; sdp: string }
  | { type: 'webrtc_ice_candidate'; sessionId: string; fromDevice?: string; toDevice?: string; candidate: any }
  | { type: 'projector_start'; sessionId: string; sourceDevice: string; targetDevice: string; quality?: string; fps?: number }
  | { type: 'projector_stop'; sessionId: string; reason?: string }
  | { type: 'projector_pause'; sessionId: string }
  | { type: 'projector_resume'; sessionId: string };

export interface LogEntry {
  id: string;
  time: string;
  type: 'tx' | 'rx' | 'sys' | 'err';
  content: string;
}

