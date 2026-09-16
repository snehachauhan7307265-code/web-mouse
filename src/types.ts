export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'reconnecting'
  | 'connected'
  | 'auth_failed'
  | 'error';

export interface ConnectionConfig {
  host: string;
  port: number;
  code: string;
  token?: string;
  lastComputerName?: string;
  autoReconnect: boolean;
}

export interface AppSettings {
  deviceName: string;
  pointerSensitivity: number;
  pointerSpeed: number;
  pointerAcceleration: boolean;
  scrollSensitivity: number;
  invertScroll: boolean;
  vibration: boolean;
  clickSound: boolean;
  theme: 'dark' | 'light';
  clipboardSync?: boolean; // Optional for backward compatibility with saved settings
}

export interface ConnectedDeviceInfo {
  computerName: string;
  screenWidth?: number;
  screenHeight?: number;
  ip: string;
  port: number;
  latencyMs?: number;
  errorMessage?: string;
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
  | { type: 'media_control'; action: 'playpause' | 'nexttrack' | 'prevtrack' | 'volumeup' | 'volumedown' | 'volumemute' }
  | { type: 'presentation_control'; action: 'start' | 'stop' | 'next' | 'prev' | 'black' }
  | { type: 'quick_control'; action: 'desktop' | 'lock' | 'screenshot' | 'alttab' }
  | { type: 'share_link'; url: string }
  | { type: 'share_text'; text: string }
  | { type: 'get_clipboard' }
  | { type: 'file_transfer_start'; filename: string; size: number; transfer_id: string; total_chunks: number }
  | { type: 'file_chunk'; transfer_id: string; chunk_index: number; chunk: string }
  | { type: 'file_transfer_end'; transfer_id: string }
  | { type: 'incoming_file_accept'; transfer_id: string }
  | { type: 'incoming_file_reject'; transfer_id: string }
  | { type: 'file_chunk_ack'; transfer_id: string; chunk_index: number }
  | { type: 'file_transfer_cancel'; transfer_id: string };

export type IncomingMessage =
  | { type: 'auth_result'; success: boolean; message: string; token?: string; computerName?: string; screenWidth?: number; screenHeight?: number }
  | { type: 'pong'; timestamp: number }
  | { type: 'error'; message: string }
  | { type: 'notification'; message: string }
  | { type: 'clipboard_data'; text: string }
  | { type: 'file_transfer_accepted'; transfer_id: string }
  | { type: 'file_transfer_rejected'; transfer_id: string; reason: string }
  | { type: 'file_chunk_ack'; transfer_id: string; chunk_index: number }
  | { type: 'file_transfer_success'; transfer_id: string }
  | { type: 'file_transfer_error'; transfer_id: string; message: string }
  | { type: 'file_transfer_cancel'; transfer_id: string }
  | { type: 'incoming_file_request'; transfer_id: string; filename: string; size: number; total_chunks: number }
  | { type: 'file_chunk'; transfer_id: string; chunk_index: number; chunk: string }
  | { type: 'file_transfer_end'; transfer_id: string };

export interface LogEntry {
  id: string;
  time: string;
  type: 'tx' | 'rx' | 'sys' | 'err';
  content: string;
}

