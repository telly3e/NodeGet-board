import {
  createPrivateSessionToken,
  getPrivatePanelPublicHost,
} from "../_shared/privateSession.js";
import { getSiteSessionEmailFromRequest } from "../_shared/oauthAccess.js";

const noStoreHeaders = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
};

export async function onRequest({ request, env }) {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const email = await getSiteSessionEmailFromRequest({ env, request });

  if (!email) {
    return new Response("Private panel session required", {
      headers: noStoreHeaders,
      status: 401,
    });
  }

  let session;
  const publicHost = getPrivatePanelPublicHost(env, request);
  try {
    session = await createPrivateSessionToken({
      email,
      env,
      host: publicHost,
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
  rpcUrl.host = publicHost;
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
