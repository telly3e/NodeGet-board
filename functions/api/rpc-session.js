import {
  createPrivateSessionToken,
  parseAllowedEmails,
} from "../_shared/privateSession.js";

const noStoreHeaders = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
};

export async function onRequest({ request, env }) {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const allowedEmails = parseAllowedEmails(env.PRIVATE_PANEL_ALLOWED_EMAILS);
  const email = (
    request.headers.get("Cf-Access-Authenticated-User-Email") || ""
  ).toLowerCase();

  if (!email) {
    return new Response("Cloudflare Access session required", {
      headers: noStoreHeaders,
      status: 401,
    });
  }

  if (allowedEmails.length > 0 && !allowedEmails.includes(email)) {
    return new Response("Forbidden", { headers: noStoreHeaders, status: 403 });
  }

  let session;
  try {
    session = await createPrivateSessionToken({
      email,
      env,
      host: new URL(request.url).host,
    });
  } catch (error) {
    console.error("Failed to create private RPC session", {
      message: error instanceof Error ? error.message : String(error),
    });
    return new Response("Failed to create RPC session", {
      headers: noStoreHeaders,
      status: 500,
    });
  }

  const rpcUrl = new URL(request.url);
  rpcUrl.pathname = "/rpc";
  rpcUrl.search = "";
  rpcUrl.protocol = rpcUrl.protocol === "https:" ? "wss:" : "ws:";
  rpcUrl.searchParams.set("session", session.token);

  return Response.json(
    {
      expiresIn: session.expiresIn,
      rpcUrl: rpcUrl.toString(),
    },
    { headers: noStoreHeaders },
  );
}
