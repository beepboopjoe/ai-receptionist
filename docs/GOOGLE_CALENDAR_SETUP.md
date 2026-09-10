# Google Calendar OAuth setup

Tenants click **Connect Google** in Settings → Integrations (or onboarding step 2). The API starts Google’s OAuth consent, stores an encrypted refresh token per tenant, and the scheduler writes events on that calendar when the AI books.

Until credentials are present, `POST /api/v1/integrations/google-calendar/connect` returns **503** with setup instructions. The dashboard shows “Not configured” instead of a dead Connect button. Office hours still let a tenant go live without booking.

Sign-in (`GOOGLE_AUTH_*`) and Calendar (`GOOGLE_CLIENT_*`) are separate env vars so the two flows can use different OAuth clients. If Calendar vars are empty, the API **falls back** to `GOOGLE_AUTH_CLIENT_ID` / `GOOGLE_AUTH_CLIENT_SECRET` — you still must add the Calendar **redirect URI** on that client.

## 1. Google Cloud Console

1. Open [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
2. Enable **Google Calendar API** ([Enable API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com)).
3. Create (or reuse) an **OAuth 2.0 Client ID**, application type **Web application**.
4. **Authorized redirect URIs** — add:

   | Environment | Redirect URI |
   |-------------|--------------|
   | Local | `http://localhost:3001/api/v1/integrations/google-calendar/callback` |
   | Production (current Railway API) | `https://ai-receptionist-production-de7b.up.railway.app/api/v1/integrations/google-calendar/callback` |

5. Under **OAuth consent screen**, add scopes:
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/userinfo.email`
6. Copy the **Client ID** and **Client secret**.

Do **not** use the Google sign-in callback (`/api/v1/auth/google/callback`) as the Calendar redirect. They are different paths.

## 2. Railway (API service `ai-receptionist`)

Set on the API service (not Vercel):

| Variable | Required | Notes |
|----------|----------|--------|
| `GOOGLE_CLIENT_ID` | Yes* | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes* | OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Recommended | Must match Console exactly. If unset, production uses `${APP_URL}/api/v1/integrations/google-calendar/callback` (localhost defaults are ignored in production). |
| `APP_URL` / `API_PUBLIC_URL` | Already set | Public API origin used when `GOOGLE_REDIRECT_URI` is blank. |
| `DASHBOARD_URL` | Already set | Where Google sends the user after connect (`/settings/integrations?google_connected=1`). |
| `ENCRYPTION_KEY` | Already set | AES-256-GCM for refresh tokens at rest. |
| `GOOGLE_AUTH_CLIENT_ID` / `GOOGLE_AUTH_CLIENT_SECRET` | Optional fallback | Used only when `GOOGLE_CLIENT_*` are empty. |

\*Or rely on the sign-in client fallback and add the Calendar redirect URI to that client.

Suggested production values:

```env
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_REDIRECT_URI=https://ai-receptionist-production-de7b.up.railway.app/api/v1/integrations/google-calendar/callback
```

Do **not** set `DEMO_SKIP_COOLDOWN`. Redeploy the API after saving variables.

## 3. Vercel (dashboard)

No new dashboard env vars. `NEXT_PUBLIC_API_URL` must already point at the Railway API (including `/api/v1`). Connect is `POST /integrations/google-calendar/connect` with the JWT; the browser then goes to Google.

## 4. Verify

1. Sign in as a tenant **owner** or **admin**.
2. Open `/settings/integrations`.
3. Google Calendar should show **Not connected** (or **Not configured** if Railway vars are still missing).
4. Click **Connect Google** → Google consent → back to Settings with a **Connected** badge and **Disconnect**.
5. Book a test appointment (call the AI or `POST /api/v1/internal/appointments/book`). A event should appear on the connected Google calendar (`primary` unless `metadata.calendar_id` is changed).

### Useful endpoints

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/v1/integrations/google-calendar/status` | staff+ |
| `POST` | `/api/v1/integrations/google-calendar/connect` | admin+ → `{ url }` |
| `GET` | `/api/v1/integrations/google-calendar/connect` | admin+ → 302 (or JSON if `Accept: application/json`) |
| `GET` | `/api/v1/integrations/google-calendar/callback` | Google (unauthenticated) |
| `POST` | `/api/v1/integrations/google-calendar/disconnect` | admin+ |

A GET to `/connect` without a JWT is **401**, not 404. The old production 404 meant the plugin was not registered.

## Local dev

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3001/api/v1/integrations/google-calendar/callback
DASHBOARD_URL=http://localhost:3000
APP_URL=http://localhost:3001
```

Add the local redirect URI on the same OAuth client (or a desktop/dev client).
