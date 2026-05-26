const SESSION_TTL_SECONDS = 90;

export const parseAllowedEmails = (value) =>
  (value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const normalizeHost = (value) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";

  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    return new URL(withScheme).host;
  } catch {
    return trimmed.split("/")[0] || "";
  }
};

export const getPrivatePanelPublicHost = (env, request) =>
  normalizeHost(env.PRIVATE_PANEL_PUBLIC_HOST) ||
  normalizeHost(request.headers.get("X-Forwarded-Host")?.split(",")[0]) ||
  new URL(request.url).host;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64Url = (bytes) => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const fromBase64Url = (value) => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const encodeJson = (value) =>
  toBase64Url(encoder.encode(JSON.stringify(value)));

const decodeJson = (value) => JSON.parse(decoder.decode(fromBase64Url(value)));

const getSessionSecret = (env) =>
  env.PRIVATE_PANEL_SESSION_SECRET || env.NODEGET_TOKEN;

const sign = async (payload, secret) => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, encoder.encode(payload)),
    ),
  );
};

const safeEqual = (left, right) => {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
};

export const createPrivateSessionToken = async ({ env, email, host }) => {
  const secret = getSessionSecret(env);
  if (!secret) {
    throw new Error("Missing PRIVATE_PANEL_SESSION_SECRET or NODEGET_TOKEN");
  }

  const payload = encodeJson({
    email: email.toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    host,
    nonce: crypto.randomUUID(),
  });
  const signature = await sign(payload, secret);

  return {
    expiresIn: SESSION_TTL_SECONDS,
    token: `${payload}.${signature}`,
  };
};

export const verifyPrivateSessionToken = async ({
  token,
  env,
  host,
  allowedEmails,
}) => {
  if (!token) return false;

  const secret = getSessionSecret(env);
  if (!secret) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  try {
    const data = decodeJson(payload);
    if (!data || typeof data !== "object") return false;
    if (data.host !== host) return false;
    if (
      typeof data.exp !== "number" ||
      data.exp < Math.floor(Date.now() / 1000)
    ) {
      return false;
    }

    const email =
      typeof data.email === "string" ? data.email.toLowerCase() : "";
    if (allowedEmails.length > 0 && !allowedEmails.includes(email)) {
      return false;
    }

    const expected = await sign(payload, secret);
    return safeEqual(signature, expected);
  } catch {
    return false;
  }
};
