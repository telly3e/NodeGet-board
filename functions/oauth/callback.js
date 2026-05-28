import {
  AUTH_COOKIE_NAME,
  clearCookie,
  createSiteSession,
  exchangeCode,
  OAUTH_STATE_COOKIE_NAME,
  parseCookies,
  readLoginState,
  setCookie,
  verifyIdToken,
} from "../_shared/oauthAccess.js";
import { parseAllowedEmails } from "../_shared/privateSession.js";

const noStoreHeaders = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
};

const getSafeReturnTo = (value) =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/";

export async function onRequest({ request, env }) {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const cookies = parseCookies(request);
  const stateCookie = cookies.get(OAUTH_STATE_COOKIE_NAME);
  const headers = new Headers(noStoreHeaders);
  clearCookie(headers, request, OAUTH_STATE_COOKIE_NAME);

  if (!code || !state || !stateCookie) {
    return new Response("OAuth callback is missing code or state", {
      headers,
      status: 400,
    });
  }

  let loginState;
  try {
    loginState = readLoginState(stateCookie);
  } catch {
    return new Response("OAuth state cookie is invalid", {
      headers,
      status: 400,
    });
  }

  if (loginState.state !== state) {
    return new Response("OAuth state does not match", {
      headers,
      status: 400,
    });
  }

  try {
    const tokens = await exchangeCode({ code, env, request });
    const { email } = await verifyIdToken({
      env,
      idToken: tokens.id_token,
      nonce: loginState.nonce,
    });

    const allowedEmails = parseAllowedEmails(env.PRIVATE_PANEL_ALLOWED_EMAILS);
    if (allowedEmails.length > 0 && !allowedEmails.includes(email)) {
      return new Response("Forbidden", {
        headers,
        status: 403,
      });
    }

    const session = await createSiteSession({ email, env, request });
    setCookie(headers, request, AUTH_COOKIE_NAME, session.token, {
      maxAge: session.expiresIn,
    });
    headers.set("Location", getSafeReturnTo(loginState.returnTo));

    return new Response(null, {
      headers,
      status: 302,
    });
  } catch (error) {
    console.error("Cloudflare Access OIDC login failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return new Response("Cloudflare Access login failed", {
      headers,
      status: 401,
    });
  }
}
