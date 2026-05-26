/// <reference types="vite/client" />
/// <reference types="unplugin-vue-router/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_TOKEN?: string;
  readonly VITE_BACKEND_WS?: string;
  readonly VITE_PRIVATE_AGENT_WS?: string;
  readonly VITE_PRIVATE_BACKEND_NAME?: string;
  readonly VITE_PRIVATE_PANEL?: string;
  readonly VITE_PRIVATE_PROXY_WS?: string;
  readonly VITE_PRIVATE_TOKEN_PLACEHOLDER?: string;
  readonly VITE_RPC_DEBUG_PANEL_ENABLED?: string;
}
