import {
  buildAuthorizationUrl,
  createLoginState,
  OAUTH_STATE_COOKIE_NAME,
  setCookie,
} from "../_shared/oauthAccess.js";

const getSafeReturnTo = (request) => {
  const url = new URL(request.url);
  const value = url.searchParams.get("return") || "/";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
};

export async function onRequest({ request, env }) {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const loginState = createLoginState(getSafeReturnTo(request));
  const authorizationUrl = await buildAuthorizationUrl({
    env,
    loginState,
    request,
  });
  const headers = new Headers({
    Location: authorizationUrl.toString(),
  });
  setCookie(headers, request, OAUTH_STATE_COOKIE_NAME, loginState, {
    maxAge: 10 * 60,
  });

  return new Response(null, {
    headers,
    status: 302,
  });
}
