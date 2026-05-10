# Google Sign-In Setup

This walks you through enabling "Sign in with Google" on the login and signup pages. The code is already built — you just need to plug in OAuth credentials.

Until credentials are added, the `/auth/google` endpoint returns `501 Not Configured` so the rest of the app keeps working.

## 1. Create an OAuth client in Google Cloud Console

1. Go to <https://console.cloud.google.com/apis/credentials>
2. Click **Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Name: `AI Receptionist — Sign-in` (or anything you like)
5. **Authorized redirect URIs** — add both:
   - `http://localhost:3001/api/v1/auth/google/callback` (local dev)
   - `https://api.aireceptionist.ai/api/v1/auth/google/callback` (prod, when applicable)
6. Click **Create** and copy the **Client ID** and **Client secret**

> **Note:** these credentials are separate from the Google Calendar OAuth client (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`). Keeping them split lets the two flows scope independently.

## 2. Add the credentials to `apps/api/.env`

```env
GOOGLE_AUTH_CLIENT_ID=123456789-abc...apps.googleusercontent.com
GOOGLE_AUTH_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx

# Used to build the redirect URL — defaults to http://localhost:3001 in dev
API_PUBLIC_URL=http://localhost:3001
DASHBOARD_URL=http://localhost:3000
```

## 3. Restart the dev server

```bash
pnpm --filter @ai-receptionist/api run demo
```

You should see this line vanish from the logs:

```
⚠️  Google sign-in not configured. Set GOOGLE_AUTH_CLIENT_ID...
```

## 4. Try it

1. Open <http://localhost:3000/login>
2. Click **Sign in with Google**
3. Pick a Google account
4. You're redirected to `/auth/google-complete`, then to `/dashboard`

## How it works

- **Frontend button** at `apps/dashboard/src/app/(auth)/login/page.tsx` and `signup/page.tsx`
- **Backend routes** at `apps/api/src/modules/admin/auth-google.router.ts`
  - `GET /api/v1/auth/google` → redirects to Google consent screen
  - `GET /api/v1/auth/google/callback` → exchanges code, verifies ID token, redirects to dashboard with token
- **Completion page** at `apps/dashboard/src/app/auth/google-complete/page.tsx` stores tokens in `localStorage`
- **Dev mode resolver** in `dev-server.ts` returns the mock tenant/user. Once Postgres is wired up, swap that resolver for one that does a real `INSERT … ON CONFLICT DO UPDATE` against `adminUsers` keyed on `googleId`.

## Production checklist

- [ ] Add the prod redirect URI in Google Cloud Console
- [ ] Set `GOOGLE_AUTH_CLIENT_ID` / `GOOGLE_AUTH_CLIENT_SECRET` in production env
- [ ] Set `API_PUBLIC_URL=https://api.aireceptionist.ai`
- [ ] Set `DASHBOARD_URL=https://app.aireceptionist.ai`
- [ ] Run the migration to add `google_id` to `admin_users` and make `password_hash` nullable
- [ ] Replace the `resolveUser` callback with the real DB-backed implementation
