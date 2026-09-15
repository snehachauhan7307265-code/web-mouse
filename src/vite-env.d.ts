/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WEBSOCKET_URL?: string;
  readonly VITE_DEFAULT_HELPER_HOST?: string;
  readonly VITE_DEFAULT_HELPER_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
