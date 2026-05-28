import {
  createSignedSessionToken,
  decodeJson,
  encodeJson,
  getPrivatePanelPublicHost,
  parseAllowedEmails,
  verifySignedSessionToken,
} from "./privateSession.js";

export const AUTH_COOKIE_NAME = "__Host-nodeget_auth";
export const OAUTH_STATE_COOKIE_NAME = "__Host-nodeget_oauth";

const DEFAULT_SCOPES = "openid email profile";
const DEFAULT_SESSION_SECONDS = 8 * 60 * 60;
const CLOCK_SKEW_SECONDS = 60;

let discoveryCache;
let jwksCache;

const textEncoder = new TextEncoder();

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

export const parseCookies = (request) => {
  const cookies = new Map();
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) cookies.set(name, value);
  }
  return cookies;
};

const getCookieOptions = (request, { maxAge }) => {
  const secure = new URL(request.url).protocol === "https:";
  return [
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    typeof maxAge === "number" ? `Max-Age=${maxAge}` : "",
  ]
    .filter(Boolean)
    .join("; ");
};

export const setCookie = (headers, request, name, value, options = {}) => {
  headers.append(
    "Set-Cookie",
    `${name}=${value}; ${getCookieOptions(request, options)}`,
  );
};

export const clearCookie = (headers, request, name) => {
  setCookie(headers, request, name, "", { maxAge: 0 });
};

const normalizeTeamDomain = (value) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
};

const getDiscoveryUrl = (env) => {
  const explicit = env.PRIVATE_PANEL_OIDC_DISCOVERY_URL?.trim();
  if (explicit) return explicit;

  const teamDomain = normalizeTeamDomain(env.PRIVATE_PANEL_OIDC_TEAM_DOMAIN);
  const clientId = env.PRIVATE_PANEL_OIDC_CLIENT_ID?.trim();
  if (!teamDomain || !clientId) return "";

  return `https://${teamDomain}/cdn-cgi/access/sso/oidc/${encodeURIComponent(
    clientId,
  )}/.well-known/openid-configuration`;
};

const requireOidcConfig = (env) => {
  const clientId = env.PRIVATE_PANEL_OIDC_CLIENT_ID?.trim();
  const clientSecret = env.PRIVATE_PANEL_OIDC_CLIENT_SECRET?.trim();
  const discoveryUrl = getDiscoveryUrl(env);

  if (!clientId || !clientSecret || !discoveryUrl) {
    throw new Error(
      "Missing PRIVATE_PANEL_OIDC_CLIENT_ID, PRIVATE_PANEL_OIDC_CLIENT_SECRET, and PRIVATE_PANEL_OIDC_DISCOVERY_URL or PRIVATE_PANEL_OIDC_TEAM_DOMAIN",
    );
  }

  return { clientId, clientSecret, discoveryUrl };
};

export const isOidcEnabled = (env) => {
  try {
    requireOidcConfig(env);
    return true;
  } catch {
    return false;
  }
};

const fetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
};

export const getDiscovery = async (env) => {
  const config = requireOidcConfig(env);
  if (discoveryCache?.url === config.discoveryUrl) return discoveryCache.value;

  const value = await fetchJson(config.discoveryUrl);
  for (const key of ["issuer", "authorization_endpoint", "token_endpoint"]) {
    if (typeof value[key] !== "string" || !value[key]) {
      throw new Error(`OIDC discovery document is missing ${key}`);
    }
  }
  if (typeof value.jwks_uri !== "string" || !value.jwks_uri) {
    throw new Error("OIDC discovery document is missing jwks_uri");
  }

  discoveryCache = { url: config.discoveryUrl, value };
  return value;
};

const getJwks = async (env, discovery) => {
  if (jwksCache?.url === discovery.jwks_uri) return jwksCache.value;

  const value = await fetchJson(discovery.jwks_uri);
  if (!Array.isArray(value.keys)) {
    throw new Error("OIDC JWKS response is missing keys");
  }

  jwksCache = { url: discovery.jwks_uri, value };
  return value;
};

const verifyJwtSignature = async ({
  env,
  discovery,
  header,
  signed,
  signature,
}) => {
  if (header.alg !== "RS256") {
    throw new Error(`Unsupported OIDC signing algorithm: ${header.alg}`);
  }

  const jwks = await getJwks(env, discovery);
  const jwk = jwks.keys.find(
    (key) =>
      key.kid === header.kid &&
      key.kty === "RSA" &&
      (!key.use || key.use === "sig"),
  );
  if (!jwk) {
    jwksCache = undefined;
    throw new Error("OIDC signing key was not found");
  }

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    signature,
    textEncoder.encode(signed),
  );
  if (!ok) throw new Error("OIDC ID token signature is invalid");
};

export const verifyIdToken = async ({ env, idToken, nonce }) => {
  const [encodedHeader, encodedPayload, encodedSignature] = (
    idToken || ""
  ).split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error("OIDC ID token is malformed");
  }

  const discovery = await getDiscovery(env);
  const header = decodeJson(encodedHeader);
  const claims = decodeJson(encodedPayload);
  await verifyJwtSignature({
    discovery,
    env,
    header,
    signed: `${encodedHeader}.${encodedPayload}`,
    signature: fromBase64Url(encodedSignature),
  });

  const now = Math.floor(Date.now() / 1000);
  const { clientId } = requireOidcConfig(env);
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];

  if (claims.iss !== discovery.issuer) {
    throw new Error("OIDC ID token issuer does not match discovery");
  }
  if (!audience.includes(clientId)) {
    throw new Error("OIDC ID token audience does not include this client");
  }
  if (typeof claims.exp !== "number" || claims.exp < now - CLOCK_SKEW_SECONDS) {
    throw new Error("OIDC ID token has expired");
  }
  if (typeof claims.nbf === "number" && claims.nbf > now + CLOCK_SKEW_SECONDS) {
    throw new Error("OIDC ID token is not valid yet");
  }
  if (claims.nonce !== nonce) {
    throw new Error("OIDC ID token nonce does not match");
  }

  const email =
    typeof claims.email === "string" ? claims.email.toLowerCase() : "";
  if (!email) {
    throw new Error("OIDC ID token is missing email");
  }

  return { claims, email };
};

export const createLoginState = (returnTo = "/") =>
  encodeJson({
    nonce: crypto.randomUUID(),
    returnTo,
    state: crypto.randomUUID(),
  });

export const readLoginState = (value) => {
  const data = decodeJson(value);
  if (
    !data ||
    typeof data !== "object" ||
    typeof data.state !== "string" ||
    typeof data.nonce !== "string"
  ) {
    throw new Error("OAuth state cookie is malformed");
  }
  return data;
};

export const buildRedirectUri = (env, request) => {
  const explicit = env.PRIVATE_PANEL_OIDC_REDIRECT_URI?.trim();
  if (explicit) return explicit;

  const url = new URL(request.url);
  url.host = getPrivatePanelPublicHost(env, request);
  url.pathname = "/oauth/callback";
  url.search = "";
  url.hash = "";
  return url.toString();
};

export const buildAuthorizationUrl = async ({ env, request, loginState }) => {
  const { clientId } = requireOidcConfig(env);
  const discovery = await getDiscovery(env);
  const redirectUri = buildRedirectUri(env, request);
  const state = readLoginState(loginState);
  const url = new URL(discovery.authorization_endpoint);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    env.PRIVATE_PANEL_OIDC_SCOPES || DEFAULT_SCOPES,
  );
  url.searchParams.set("state", state.state);
  url.searchParams.set("nonce", state.nonce);
  return url;
};

export const exchangeCode = async ({ env, request, code }) => {
  const { clientId, clientSecret } = requireOidcConfig(env);
  const discovery = await getDiscovery(env);
  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    redirect_uri: buildRedirectUri(env, request),
  });

  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
  });

  if (env.PRIVATE_PANEL_OIDC_TOKEN_AUTH_METHOD === "client_secret_post") {
    body.set("client_id", clientId);
    body.set("client_secret", clientSecret);
  } else {
    headers.set(
      "Authorization",
      `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    );
  }

  const response = await fetch(discovery.token_endpoint, {
    body,
    headers,
    method: "POST",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `OIDC token exchange failed: ${response.status} ${
        data.error_description || data.error || ""
      }`.trim(),
    );
  }
  if (typeof data.id_token !== "string" || !data.id_token) {
    throw new Error("OIDC token response is missing id_token");
  }

  return data;
};

export const getAllowedEmailFromRequest = async ({ env, request }) => {
  const allowedEmails = parseAllowedEmails(env.PRIVATE_PANEL_ALLOWED_EMAILS);
  const accessEmail = (
    request.headers.get("Cf-Access-Authenticated-User-Email") || ""
  ).toLowerCase();
  if (
    accessEmail &&
    (allowedEmails.length === 0 || allowedEmails.includes(accessEmail))
  ) {
    return accessEmail;
  }

  const cookies = parseCookies(request);
  const session = await verifySignedSessionToken({
    allowedEmails,
    env,
    host: getPrivatePanelPublicHost(env, request),
    purpose: "site",
    token: cookies.get(AUTH_COOKIE_NAME),
  });

  return session && typeof session.email === "string" ? session.email : "";
};

export const createSiteSession = ({ email, env, request }) => {
  const ttlSeconds = Number.parseInt(
    env.PRIVATE_PANEL_OIDC_SESSION_SECONDS || "",
    10,
  );
  return createSignedSessionToken({
    email,
    env,
    host: getPrivatePanelPublicHost(env, request),
    purpose: "site",
    ttlSeconds: Number.isFinite(ttlSeconds)
      ? ttlSeconds
      : DEFAULT_SESSION_SECONDS,
  });
};
