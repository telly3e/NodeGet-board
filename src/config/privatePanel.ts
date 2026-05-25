import type { Backend } from "@/composables/useBackendStore";

export const PRIVATE_PANEL_TOKEN_PLACEHOLDER = "__NODEGET_PRIVATE_TOKEN__";

const truthy = (value: string | undefined) =>
  ["1", "true", "yes", "on"].includes((value ?? "").toLowerCase());

export const isPrivatePanelEnabled = () =>
  truthy(import.meta.env.VITE_PRIVATE_PANEL);

const getSameOriginRpcUrl = () => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/rpc`;
};

export const getPrivateBackend = (): Backend => ({
  name: import.meta.env.VITE_PRIVATE_BACKEND_NAME || "My Server",
  url: import.meta.env.VITE_PRIVATE_PROXY_WS || getSameOriginRpcUrl(),
  token:
    import.meta.env.VITE_PRIVATE_TOKEN_PLACEHOLDER ||
    PRIVATE_PANEL_TOKEN_PLACEHOLDER,
});
