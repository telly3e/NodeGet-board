export type RpcDebugWebSocketEvent =
  | {
      type: "connection";
      state: "connecting" | "open" | "error" | "closed";
      connectionId: number;
      url: string;
      timestamp: number;
      closeCode?: number;
      closeReason?: string;
    }
  | {
      type: "frame";
      direction: "outgoing" | "incoming";
      connectionId: number;
      url: string;
      timestamp: number;
      data: unknown;
    };

type NativeWebSocketCtor = typeof WebSocket;
type RpcDebugWebSocketListener = (event: RpcDebugWebSocketEvent) => void;

const listeners = new Set<RpcDebugWebSocketListener>();

let nativeWebSocket: NativeWebSocketCtor | null = null;
let installed = false;
let nextConnectionId = 1;

const emit = (event: RpcDebugWebSocketEvent) => {
  listeners.forEach((listener) => listener(event));
};

export const addRpcDebugWebSocketListener = (
  listener: RpcDebugWebSocketListener,
) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const installRpcDebugWebSocketPatch = () => {
  if (installed || typeof window === "undefined") return;

  nativeWebSocket = window.WebSocket;
  const OriginalWebSocket = nativeWebSocket;

  class DebugWebSocket extends OriginalWebSocket {
    readonly __rpcDebugConnectionId: number;
    readonly __rpcDebugUrl: string;

    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols as string | string[] | undefined);
      this.__rpcDebugConnectionId = nextConnectionId++;
      this.__rpcDebugUrl = String(url);

      emit({
        type: "connection",
        state: "connecting",
        connectionId: this.__rpcDebugConnectionId,
        url: this.__rpcDebugUrl,
        timestamp: Date.now(),
      });

      this.addEventListener("open", () => {
        emit({
          type: "connection",
          state: "open",
          connectionId: this.__rpcDebugConnectionId,
          url: this.__rpcDebugUrl,
          timestamp: Date.now(),
        });
      });

      this.addEventListener("message", (event) => {
        emit({
          type: "frame",
          direction: "incoming",
          connectionId: this.__rpcDebugConnectionId,
          url: this.__rpcDebugUrl,
          timestamp: Date.now(),
          data: event.data,
        });
      });

      this.addEventListener("error", () => {
        emit({
          type: "connection",
          state: "error",
          connectionId: this.__rpcDebugConnectionId,
          url: this.__rpcDebugUrl,
          timestamp: Date.now(),
        });
      });

      this.addEventListener("close", (event) => {
        emit({
          type: "connection",
          state: "closed",
          connectionId: this.__rpcDebugConnectionId,
          url: this.__rpcDebugUrl,
          timestamp: Date.now(),
          closeCode: event.code,
          closeReason: event.reason,
        });
      });
    }

    send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
      emit({
        type: "frame",
        direction: "outgoing",
        connectionId: this.__rpcDebugConnectionId,
        url: this.__rpcDebugUrl,
        timestamp: Date.now(),
        data,
      });
      return super.send(data);
    }
  }

  window.WebSocket = DebugWebSocket as NativeWebSocketCtor;
  installed = true;
};

export const uninstallRpcDebugWebSocketPatch = () => {
  if (!installed || !nativeWebSocket || typeof window === "undefined") return;
  window.WebSocket = nativeWebSocket;
  nativeWebSocket = null;
  installed = false;
};
