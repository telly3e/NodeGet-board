import {
  AUTH_COOKIE_NAME,
  clearCookie,
  OAUTH_STATE_COOKIE_NAME,
} from "../_shared/oauthAccess.js";

export async function onRequest({ request }) {
  if (request.method !== "GET" && request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const headers = new Headers({
    "Cache-Control": "private, no-store, no-cache, must-revalidate",
    Location: "/",
  });
  clearCookie(headers, request, AUTH_COOKIE_NAME);
  clearCookie(headers, request, OAUTH_STATE_COOKIE_NAME);

  return new Response(null, {
    headers,
    status: 302,
  });
}
