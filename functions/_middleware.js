import {
  getSiteSessionEmailFromRequest,
  isOidcEnabled,
} from "./_shared/oauthAccess.js";

const noStoreHeaders = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
};

const isPublicAuthPath = (pathname) =>
  pathname === "/oauth/login" ||
  pathname === "/oauth/callback" ||
  pathname === "/oauth/logout";

const isPublicAssetPath = (pathname) =>
  pathname === "/manifest.json" ||
  pathname === "/browserconfig.xml" ||
  pathname === "/favicon.ico" ||
  pathname === "/logo.png" ||
  pathname === "/theme-init.js" ||
  /^\/(?:android-icon|apple-icon|favicon|ms-icon)-.+\.png$/i.test(pathname);

const wantsHtml = (request) => {
  const accept = request.headers.get("Accept") || "";
  return accept.includes("text/html");
};

const getReturnPath = (request) => {
  const url = new URL(request.url);
  return `${url.pathname}${url.search}`;
};

const isProgrammaticPath = (pathname) =>
  pathname === "/rpc" || pathname.startsWith("/api/");

export async function onRequest(context) {
  const { env, request } = context;

  if (!isOidcEnabled(env)) {
    return context.next();
  }

  const url = new URL(request.url);
  if (isPublicAuthPath(url.pathname) || isPublicAssetPath(url.pathname)) {
    return context.next();
  }

  const email = await getSiteSessionEmailFromRequest({ env, request });
  if (email) {
    return context.next();
  }

  if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
    return new Response("Authentication required", {
      headers: noStoreHeaders,
      status: 401,
    });
  }

  if (
    request.method === "GET" &&
    wantsHtml(request) &&
    !isProgrammaticPath(url.pathname)
  ) {
    const loginUrl = new URL("/oauth/login", request.url);
    loginUrl.searchParams.set("return", getReturnPath(request));
    return Response.redirect(loginUrl.toString(), 302);
  }

  return new Response("Authentication required", {
    headers: noStoreHeaders,
    status: 401,
  });
}
