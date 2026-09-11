# Telfin MCP (v1)

Remote **Model Context Protocol** endpoint so a tenant can connect Claude, Cursor, or similar clients to **their own** Telfin account. This is a distribution / ops surface — it does not replace the phone product and **does not place outbound calls**.

## Endpoint

| | |
|---|---|
| Canonical | `POST https://<api-host>/mcp` |
| Alias | `POST https://<api-host>/api/v1/mcp` |
| Transport | Streamable HTTP (stateless JSON-RPC 2.0) |
| Auth | `Authorization: Bearer telfin_sk_…` or legacy `ark_live_…` (or `X-API-Key`) |

Local default: `http://localhost:3001/mcp`.

GET/DELETE return **405** — v1 is stateless; send JSON-RPC on POST.

## Mint a key

1. Sign in as the **account owner**.
2. Open **Settings → API Keys** (also linked from **Settings → Integrations**).
3. **Create MCP key** (or New key → “MCP connector”).
4. Choose **write** scope if you need `telfin_create_lead` or `telfin_send_sms`.
5. Copy the secret immediately. Telfin stores only a SHA-256 hash (`tenant_api_keys.key_hash`), same as Public API keys.

Prefixes:

- `telfin_sk_` — minted for MCP
- `ark_live_` — existing Public API keys; they work on `/mcp` too

Never commit the raw token. Rotate by revoking the row and minting a new one.

## Claude custom connector

Claude’s remote MCP / custom connector UI varies by product (Claude.ai vs Desktop). The server side is:

1. **URL:** `https://api.telfin.ai/mcp` (or your API origin + `/mcp`).
2. **Auth:** HTTP header  
   `Authorization: Bearer telfin_sk_<your secret>`
3. If the UI asks for OAuth, v1 does **not** ship OAuth — use API key headers. Cursor and Claude Desktop `mcp.json` support this today.

After connecting, call `telfin_whoami` to confirm tenant name and plan.

## Cursor MCP config

User or project `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "telfin": {
      "url": "https://api.telfin.ai/mcp",
      "headers": {
        "Authorization": "Bearer telfin_sk_REPLACE_ME"
      }
    }
  }
}
```

Local:

```json
{
  "mcpServers": {
    "telfin": {
      "url": "http://localhost:3001/mcp",
      "headers": {
        "Authorization": "Bearer telfin_sk_REPLACE_ME"
      }
    }
  }
}
```

Smoke with curl (no secret in git):

```bash
curl -sS http://localhost:3001/mcp \
  -H "Authorization: Bearer $TELFIN_MCP_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## v1 tools

| Tool | Scope | What it does |
|---|---|---|
| `telfin_whoami` | read | Tenant name, slug, plan hints, timezone, vertical |
| `telfin_list_leads` | read | Recent **tenant** contacts (`since`, `limit`) |
| `telfin_create_lead` | write | Create contact; `source=mcp`; requires E.164 `phone` |
| `telfin_list_calls` | read | Recent calls (duration, direction, summary) |
| `telfin_get_call` | read | One call + transcript excerpt (same tenant only) |
| `telfin_list_numbers` | read | Tenant DIDs + provision status |
| `telfin_send_sms` | write | Send SMS if two-way SMS is already enabled for the tenant; otherwise a clear “not enabled” error |

Leads are **CRM contacts** for the authenticated tenant. Platform-wide `demo_leads` (homepage call-me / marketing widget) are **not** exposed — that table is not tenant-scoped.

## Deferred (not in v1 — do not implement via MCP)

- Calendar book / cancel (needs live Google OAuth per tenant)
- `place_call` / `join_call`
- Campaign outbound / bulk dial

v1 will reject unknown tool names rather than dial.

## Isolation & safety

- Tenant id comes **only** from the hashed API key. Clients cannot pass another tenant.
- Read keys cannot call write tools.
- No session map: each POST authenticates independently (no cross-tenant session reuse).
- SMS uses the same plan + DID + Telnyx path as the dashboard inbox. If that path is not configured, the tool errors; it does not invent a from-number.
- Do not set `DEMO_SKIP_COOLDOWN`. Demo call-me is unchanged.

## Implementation map

| Piece | Path |
|---|---|
| HTTP | `apps/api/src/modules/mcp/mcp.router.ts` |
| JSON-RPC | `apps/api/src/modules/mcp/mcp.protocol.ts` |
| Tools | `apps/api/src/modules/mcp/mcp.tools.ts` |
| Handlers | `apps/api/src/modules/mcp/mcp.handlers.ts` |
| DB store | `apps/api/src/modules/mcp/mcp.db-store.ts` |
| Key hashing | `apps/api/src/modules/public-api/api-key.crypto.ts` |
| Dashboard | `apps/dashboard/src/app/(app)/settings/api-keys/page.tsx` |
