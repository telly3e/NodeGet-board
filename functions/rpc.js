const DEFAULT_TOKEN_PLACEHOLDER = "__NODEGET_PRIVATE_TOKEN__";

const parseAllowedEmails = (value) =>
  (value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const closeSocket = (socket, code = 1011, reason = "Proxy closed") => {
  try {
    if (
      socket &&
      (socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING)
    ) {
      socket.close(code, reason);
    }
  } catch {
    // Ignore close races between the browser and upstream server.
  }
};

const replaceToken = (data, placeholder, token) => {
  if (typeof data !== "string") return data;
  return data.split(placeholder).join(token);
};

export async function onRequest({ request, env }) {
  const upgrade = request.headers.get("Upgrade");
  if (upgrade?.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 426 });
  }

  const allowedEmails = parseAllowedEmails(env.PRIVATE_PANEL_ALLOWED_EMAILS);
  if (allowedEmails.length > 0) {
    const email = (
      request.headers.get("Cf-Access-Authenticated-User-Email") || ""
    ).toLowerCase();

    if (!allowedEmails.includes(email)) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  if (!env.NODEGET_BACKEND_WS || !env.NODEGET_TOKEN) {
    return new Response("Missing NODEGET_BACKEND_WS or NODEGET_TOKEN", {
      status: 500,
    });
  }

  const upstreamResponse = await fetch(env.NODEGET_BACKEND_WS, {
    headers: {
      Upgrade: "websocket",
    },
  });
  const upstreamSocket = upstreamResponse.webSocket;

  if (!upstreamSocket) {
    return new Response("Upstream did not accept WebSocket", { status: 502 });
  }

  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  const tokenPlaceholder =
    env.NODEGET_TOKEN_PLACEHOLDER || DEFAULT_TOKEN_PLACEHOLDER;

  server.accept({ allowHalfOpen: true });
  upstreamSocket.accept({ allowHalfOpen: true });

  server.addEventListener("message", (event) => {
    if (upstreamSocket.readyState !== WebSocket.OPEN) return;
    upstreamSocket.send(
      replaceToken(event.data, tokenPlaceholder, env.NODEGET_TOKEN),
    );
  });

  upstreamSocket.addEventListener("message", (event) => {
    if (server.readyState !== WebSocket.OPEN) return;
    server.send(event.data);
  });

  server.addEventListener("close", (event) => {
    closeSocket(upstreamSocket, event.code, event.reason);
  });
  server.addEventListener("error", () => closeSocket(upstreamSocket));

  upstreamSocket.addEventListener("close", (event) => {
    closeSocket(server, event.code, event.reason);
  });
  upstreamSocket.addEventListener("error", () => closeSocket(server));

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}
