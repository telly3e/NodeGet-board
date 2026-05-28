# NodeGet-Board

The dashboard of NodeGet. Built with vue+ts.

# Run and test

1. copy `example.env.development` -> `.env.development`

2. set your test server address and token

3. pnpm,启动!

```sh
pnpm install
pnpm dev
```

# Cloudflare Access OIDC protection

When the dashboard runs on Cloudflare Pages behind a custom domain that cannot
be protected by a self-hosted Access app at the DNS edge, enable the private
panel and add Cloudflare Access as an OIDC provider for the app itself:

1. In Cloudflare Zero Trust, create an Access SaaS application with OIDC.

2. Add this redirect URL to that SaaS application:

```text
https://your-dashboard.example.com/oauth/callback
```

3. Set these Cloudflare Pages runtime variables/secrets:

```text
VITE_PRIVATE_PANEL=true
NODEGET_BACKEND_WS=wss://your-nodeget-controller.example.com/nodeget/rpc
NODEGET_TOKEN=your_nodeget_token
PRIVATE_PANEL_ALLOWED_EMAILS=you@example.com
PRIVATE_PANEL_PUBLIC_HOST=your-dashboard.example.com
PRIVATE_PANEL_SESSION_SECRET=random_long_secret
PRIVATE_PANEL_OIDC_CLIENT_ID=cloudflare_access_oidc_client_id
PRIVATE_PANEL_OIDC_CLIENT_SECRET=cloudflare_access_oidc_client_secret
PRIVATE_PANEL_OIDC_TEAM_DOMAIN=your-team.cloudflareaccess.com
```

You can use `PRIVATE_PANEL_OIDC_DISCOVERY_URL` instead of
`PRIVATE_PANEL_OIDC_TEAM_DOMAIN` if you prefer to paste the full OIDC
configuration endpoint from Cloudflare.
