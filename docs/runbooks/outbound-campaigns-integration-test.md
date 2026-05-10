# Outbound Campaigns — Manual Integration Test Runbook

For validating the live end-to-end outbound call flow: Twilio → Grok Voice → booking → dashboard.
Unit tests (21/21 passing) already cover CSV parsing, dial-window logic, and the qualification flow in isolation. This runbook covers the **live-credentials** path that unit tests can't reach.

---

## 1. Preconditions

### 1.1 Environment variables (`apps/api/.env`)

| Var | Notes |
|---|---|
| `DATABASE_URL` | `postgresql://dev:dev@localhost:5432/ai_receptionist` |
| `REDIS_URL` | `redis://localhost:6379` |
| `JWT_SECRET` | any 32+ char string |
| `ENCRYPTION_KEY` | 32-char hex |
| `XAI_API_KEY` | live xAI key — Grok Voice access |
| `TELNYX_API_KEY` | from Telnyx portal → API Keys |
| `TELNYX_APP_ID` | Connection Profile ID — Telnyx portal → My Connections → select app → copy ID |
| `TELNYX_PUBLIC_KEY` | Ed25519 webhook signing key (optional in dev, required in prod) |
| `APP_URL` | your public HTTPS tunnel (e.g. `https://abc123.ngrok-free.app`) — **must be HTTPS, Telnyx requires it** |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | for booking calendar events |
| `SENDGRID_API_KEY` *(optional)* | for confirmation SMS/email |

### 1.2 Credentials to verify before starting

- [ ] Telnyx phone number is voice-capable and SMS-capable (Telnyx portal → Numbers → check capabilities)
- [ ] Telnyx Connection Profile exists with the webhook URL configured: `https://<YOUR_TUNNEL>/api/v1/webhooks/telnyx`
- [ ] Telnyx Connection Profile has **media streaming enabled** and stream URL set to `wss://<YOUR_TUNNEL>/api/v1/webhooks/telnyx/stream`
- [ ] AMD is enabled on the connection profile: **answering machine detection = detect_beep**
- [ ] xAI API key has Grok Voice beta access (test via `wscat -c wss://api.x.ai/v1/realtime -H "Authorization: Bearer $XAI_API_KEY"`)
- [ ] Google Calendar is OAuth-connected for the test tenant (check `integrations` table: `status='connected'`, `provider='google_calendar'`)
- [ ] Test tenant has at least one `appointmentType` with `duration_min` configured in `tenant_settings.appointment_types`

#### Telnyx portal setup (one-time)

1. **Portal → My Connections → Create a new connection → Call Control**
2. Set **Webhook URL** = `https://<YOUR_TUNNEL>/api/v1/webhooks/telnyx`
3. Enable **Answering Machine Detection** → Mode: `detect_beep`
4. Enable **Media Streaming** → Stream URL: `wss://<YOUR_TUNNEL>/api/v1/webhooks/telnyx/stream` → Track: `both_tracks`
5. Copy the **Connection ID** (UUID) → this is your `TELNYX_APP_ID`
6. Assign your test phone number to this connection (Numbers → Assign to connection)

### 1.3 Services running

```powershell
# Terminal 1 — infra
docker compose -f infra/docker/docker-compose.yml up -d   # postgres + redis

# Terminal 2 — API
pnpm --filter @ai-receptionist/api dev     # :3001

# Terminal 3 — worker
pnpm --filter @ai-receptionist/api worker  # BullMQ worker

# Terminal 4 — dashboard
pnpm --filter @ai-receptionist/dashboard dev   # :3000

# Terminal 5 — public tunnel
ngrok http 3001    # copy HTTPS URL → APP_URL in .env, then restart API + worker
```

Health check before running any scenario:
```bash
curl $APP_URL/health            # → 200 OK
curl $APP_URL/api/v1/campaigns  # → 401 (auth required) is fine — proves routes loaded
redis-cli ping                   # → PONG
psql $DATABASE_URL -c "SELECT count(*) FROM tenants WHERE is_active=true;"  # ≥ 1
```

### 1.4 Sample data

**Test campaign (create via dashboard `/campaigns/new` or API):**
```json
{
  "name": "Demo — Spring Cleaning Drive",
  "fromNumber": "+14155551234",
  "dialWindowStart": "08:00",
  "dialWindowEnd": "20:00",
  "maxRetries": 2,
  "retryDelayMinutes": 5,
  "maxConcurrentCalls": 2,
  "voicemailMessage": "Hi, this is Sarah from Bright Smile Dental. We're welcoming new patients — give us a call back at 415-555-1234 when you have a moment."
}
```

**Test leads CSV (`demo-leads.csv`) — use phones you control:**
```csv
first_name,last_name,phone,email
Alex,TestOne,+1YOUR_CELL_1,alex@example.com
Blake,TestTwo,+1YOUR_CELL_2,blake@example.com
Casey,TestThree,+1YOUR_VOICEMAIL_LINE,casey@example.com
```

> **Tip:** you need at least 3 phones under your control to cover answered / voicemail / no-answer without reconfiguring mid-demo. A cell phone + Google Voice + a desk line works.

---

## 2. Test scenarios

### S1 — Answered + Qualified + Booked *(the happy path)*

| | |
|---|---|
| **Setup** | Lead in `pending` status. Calendar has an open slot in the next 7 days. |
| **Trigger** | Click **Start Campaign** in dashboard, or `POST /api/v1/campaigns/:id/start`. Answer the call. |
| **Script to speak** | "Yes, speaking." → "No, I don't have a dentist." → "Mornings work." → Pick the first offered slot → give email → "Thanks, bye." |
| **Telnyx** | `POST /v2/calls` → `call.initiated` → `call.ringing` → `call.answered` → AMD: `call.machine.detection.ended result=human` → `stream_start` REST call → MediaStream WS opens → `call.hangup`. |
| **Grok** | WS connects, `session.update` sent, audio deltas flowing both ways. On hangup, `getTranscript()` and `getSummary()` return non-empty. |
| **DB** | `campaign_contacts.status='booked'`, `appointmentId` populated. `calls.status='completed'`, `summary` non-null, `transcript` has ≥ 2 entries. `appointments` row exists with matching `contact_id` and `starts_at`. Campaign `bookedCount` incremented by 1. |
| **Dashboard** | Lead row shows green "Booked" badge with checkmark. Click row → slide-over shows appointment link, notes, transcript link. |
| **Logs** | `[twilio-stream] stream started`, `[grok] session.update sent`, `outbound-qualification-flow msg="Outbound qualification complete" newStatus="booked" appointmentId=...` |

### S2 — Answered + Qualified + No Slot Available

| | |
|---|---|
| **Setup** | Same as S1, but block all calendar slots in the offered window (create busy events). |
| **Trigger** | Start campaign, answer call. Grok will offer slots, none will fit — let the caller say "none of those work, I'll call back." |
| **Grok** | Should say something like "no problem, someone will follow up." |
| **DB** | `campaign_contacts.status='qualified'` (NOT `booked`). `appointmentId` is null. `qualificationNotes` populated. A `notifications` row with `type='staff_task'`. |
| **Dashboard** | Lead shows amber "Qualified" badge. Slide-over shows qualification notes but no appointment link. |
| **Logs** | `newStatus="qualified"` and `msg="Appointment booking failed — marking as qualified-only"` OR `msg="No slot selected — queuing staff task"`. |

### S3 — Answered + Not Qualified

| | |
|---|---|
| **Setup** | Same as S1. |
| **Trigger** | When Grok asks "Do you have a dentist?" → "Yes, I'm happy with my current one, thanks." |
| **Grok** | Should wrap up gracefully: "No problem, thanks for your time." |
| **DB** | `campaign_contacts.status='not_qualified'`. `qualificationNotes` has a 1–2 sentence summary. No `appointments` row. |
| **Dashboard** | Lead shows gray "Not Qualified" badge. |
| **Logs** | `newStatus="not_qualified"`. |

### S4 — Voicemail Detected

| | |
|---|---|
| **Setup** | Use a phone number that goes to voicemail (Google Voice "Do Not Disturb", or turn off a cell phone). |
| **Trigger** | Start campaign. |
| **Telnyx** | `call.machine.detection.ended` webhook fires with `result=machine_end_beep`. |
| **DB** | `campaign_contacts.status='voicemail'`, `voicemailCount` on campaign incremented. If `voicemailMessage` was set, an `outbound-voicemail-drop` BullMQ job appears in Redis. |
| **Dashboard** | Lead shows blue "Voicemail" badge. |
| **Logs** | `[outbound-status] machine detected, dropping voicemail`. |
| **Verify voicemail audio** | Listen to the actual voicemail on the receiving phone — TTS should play the configured message cleanly. |

### S5 — No Answer

| | |
|---|---|
| **Setup** | Use a phone that will ring out (silence ringer, don't pick up). Set campaign `maxRetries=1`. |
| **Trigger** | Start campaign. Let it ring for 30 seconds. |
| **Twilio** | Status callback: `CallStatus=no-answer`. |
| **DB (attempt 1)** | `campaign_contacts.status='pending'`, `retryCount=1`, `nextRetryAt` ≈ now + `retryDelayMinutes`. BullMQ has a delayed `outbound-dial` job. |
| **DB (attempt 2, after retry)** | Second `no-answer` → `status='failed'`, `outcome='timeout'`, `failedCount` incremented. |
| **Dashboard** | Lead shows red "Failed" badge after retries exhaust. |
| **Logs** | `[outbound-dial-job] Dial timeout — treating as no-answer`, then `processDialTimeout` retry path. |

### S6 — Busy / Failed Call

| | |
|---|---|
| **Setup** | Point `to` at a deliberately invalid number (e.g. `+19999999999`) by manually editing `campaign_contacts.phoneE164` before start, OR call a number known to be busy. |
| **Trigger** | Start campaign. |
| **Twilio** | Status callback: `CallStatus=failed` or `busy`, `ErrorCode` populated. |
| **DB** | `campaign_contacts.status='failed'`, `outcome='dial_error'`. Campaign `failedCount` incremented. |
| **Dashboard** | Red "Failed" badge, hover shows outcome reason. |
| **Logs** | `[outbound-dial-job] Twilio dial failed err=...`. |

### S7 — Opt-Out / Do-Not-Call

| | |
|---|---|
| **Setup** | Fresh lead in `pending`. |
| **Trigger** | Answer the call, say "take me off your list, do not call me again." |
| **Grok** | Should say "Absolutely, removing you now." and end the call. |
| **DB** | `campaign_contacts.status='do_not_call'`, `outcome='opted_out'`. |
| **Cross-campaign check** | Add the same phone as a lead on a **second campaign**, start it → dial job should short-circuit with `status='do_not_call'`, `outcome='dnc_prior_campaign'`. **No call is placed.** |
| **Dashboard** | Lead shows "Do Not Call" badge. |
| **Logs** | `Lead opted out — marked do_not_call`, and on the second campaign: `Phone on DNC list (prior campaign) — skipping`. |

### S8 — Callback Requested

| | |
|---|---|
| **Setup** | Fresh lead. |
| **Trigger** | Answer, say "Can you call me back Thursday afternoon?" |
| **DB** | `campaign_contacts.status='pending'` (or a `callback_requested` status if enum includes it — check schema), `qualificationNotes="Call back Thursday afternoon"`. A `notifications` row with `type='staff_task'` and the callback time in body. |
| **Dashboard** | Lead shows "Callback" or "Pending" badge; slide-over shows the callback note prominently. |
| **Logs** | `newStatus="callback_requested"`. |

### S9 — Booking Failure Fallback

| | |
|---|---|
| **Setup** | Disconnect Google Calendar integration for the tenant (`UPDATE integrations SET status='error' WHERE provider='google_calendar' AND tenant_id=...`), but leave everything else normal. |
| **Trigger** | Run S1 happy path. |
| **Expected** | Grok still collects everything, but `bookAppointment()` throws. Flow swallows the error and falls back. |
| **DB** | `campaign_contacts.status='qualified'` (NOT `booked`), `appointmentId` null, a `staff_task` notification with "booking failed, manual scheduling needed" in body. |
| **Dashboard** | Amber "Qualified" badge; slide-over shows "booking failed" note. |
| **Logs** | `err="Calendar integration not connected" msg="Appointment booking failed — marking as qualified-only"`. **This is the exact log line covered by unit test `still marks qualified if booking fails`.** |

### S10 — Existing Contact Lookup

| | |
|---|---|
| **Setup** | Insert a contact in `contacts` with the same `phoneE164` as one of your leads (`firstName='Alice'`). Lead in the CSV has same phone but `firstName='Alex'` (different). |
| **Trigger** | Run S1 happy path. |
| **Expected** | `identifyCaller()` finds the existing contact. `createContact()` is NOT called. The appointment is linked to the existing `contact_id`. |
| **DB** | `appointments.contact_id` = existing contact's ID. No new row in `contacts`. `campaign_contacts.contactId` back-populated. |
| **Logs** | No `createContact` log; appointment created with pre-existing contact. |

---

## 3. Verification checklist

### 3.1 Database (run between scenarios)

```sql
-- Campaign progression
SELECT id, status, total_leads, dialed_count, connected_count,
       qualified_count, booked_count, voicemail_count, failed_count
FROM outbound_campaigns WHERE id = '<CAMPAIGN_ID>';

-- Lead outcomes
SELECT id, phone_e164, status, outcome, retry_count, appointment_id,
       qualification_notes, last_dialed_at
FROM campaign_contacts WHERE campaign_id = '<CAMPAIGN_ID>' ORDER BY last_dialed_at DESC;

-- Call records + transcript
SELECT id, status, duration_seconds, summary,
       jsonb_array_length(transcript) AS transcript_entries
FROM calls WHERE rc_call_id = '<CALL_SID>';

-- Booked appointment
SELECT id, contact_id, starts_at, ends_at, status, calendar_event_id
FROM appointments WHERE call_id = '<CALL_ID>';

-- Staff tasks queued
SELECT id, type, channel, to_address, status, body
FROM notifications WHERE call_id = '<CALL_ID>' ORDER BY created_at DESC;
```

### 3.2 App logs (pino JSON, grep by field)

| What to check | Filter |
|---|---|
| Dial job fired | `name=outbound-dial-job msg="Processing outbound-dial job"` |
| DNC blocked | `msg="Phone on DNC list"` |
| Dial window blocked | `msg="Outside dial window — re-enqueuing"` |
| Twilio stream opened | `[twilio-stream] stream started callSid=<SID>` |
| Grok session up | `[grok] session ready sessionId=<ID>` |
| Post-call workflow | `name=outbound-qualification-flow msg="Outbound qualification complete"` |
| Transcript persisted | `[twilio-stream] persisted call record callId=<ID>` |

### 3.3 Telnyx Portal

- **Portal → Call Control → Debugging** → filter by your `fromNumber` or date
- For each call verify: Direction=Outbound, Status=answered/no-answer/busy, AMD result, Duration
- Click the call → **Event Viewer** shows every event fired (`call.initiated`, `call.answered`, `call.machine.detection.ended`, `call.hangup`) — each event has our 200 response visible
- **Streaming** section → WebSocket connection status (connected if call was answered and stream_start succeeded)

### 3.4 Dashboard UI

- [ ] `/campaigns` list row shows correct `dialed / connected / qualified / booked` counts
- [ ] Stats cards on detail page match SQL counts
- [ ] Lead table status badges match `campaign_contacts.status`
- [ ] Click lead → slide-over opens, shows notes, appointment link (if booked), call transcript link
- [ ] Transcript link → `/calls/:id` page shows non-empty transcript and AI summary
- [ ] Appointment link → `/appointments/:id` page loads with correct time and contact

---

## 4. Failure triage guide

| Symptom | Likely layer | First place to look |
|---|---|---|
| No Twilio call placed after Start Campaign | **Orchestration** | Worker logs for `outbound-dial-job`. Dial window? Concurrency cap? Campaign paused? |
| Twilio places call, but webhook never hit | **Telephony** | Twilio Request Inspector → check TwiML URL resolves. Is `APP_URL` HTTPS + reachable via ngrok? |
| Webhook hit but MediaStream never opens | **Telephony** | TwiML response body — should contain `<Connect><Stream url="wss://...">` |
| MediaStream opens but no audio | **Grok / Audio** | `[grok]` logs. Audio format mismatch (should be `pcmu` / G.711 mulaw for Twilio). `session.update` payload correct? |
| Audio flows, caller hears silence | **Grok** | `XAI_API_KEY` scope — does it have voice beta? Check for `session.error` events in logs. |
| Call ends, but `campaign_contacts` never updates | **Orchestration** | `triggerPostCallWorkflow` log line. Is `rcCallId` = `callSid`? Redis key missing → state lookup failed. |
| Call ends, transcript empty in DB | **Persistence** | `[twilio-stream] Failed to fetch transcript/summary` — Grok adapter may need a longer timeout or session is already closed |
| Lead status updated but no appointment created | **Prompt / Flow** | Check `collectedData.selectedSlotStart` in logs. Is it a parseable ISO string? Was an `appointmentType` matched? Calendar integration status=connected? |
| Appointment created but dashboard shows "Qualified" not "Booked" | **Persistence** | Race condition on campaign counter? Re-query `campaign_contacts.status` — dashboard may be reading stale via SWR cache. Hard refresh. |
| Voicemail detected but no message dropped | **Telephony** | Is `voicemailMessage` set on campaign? Check `outbound-voicemail-drop` queue in Redis. |
| Retry never happens after no-answer | **Orchestration** | `processDialTimeout` log — is `retryCount < maxRetries`? Is the delayed job actually in BullMQ? (`redis-cli KEYS bull:outbound-dialer:*`) |
| DNC lead from campaign A still gets called by campaign B | **Compliance** | Cross-campaign DNC query — check `apps/api/src/queue/jobs/outbound-dial.job.ts` step 1b is still intact |
| Dashboard lead panel shows no transcript link even after call completed | **UI** | `lead.callId` must be populated. Check `campaign_contacts.call_id` in DB. If null, post-call handler didn't fire. |

**Rule of thumb — where to look first, in order:**
1. **Twilio Console** (did the call happen at all?)
2. **API worker logs** (did our code respond to Twilio?)
3. **Redis** (is the right job queued / did a retry schedule?)
4. **Postgres** (did state persist?)
5. **Dashboard** (is it just a cache/SWR issue?)

---

## 5. Demo script (best-path, ~6 minutes)

### Pre-flight (do before the demo starts — off camera)

- [ ] All services running, health check green
- [ ] `ngrok` tunnel stable, `APP_URL` matches in `.env`
- [ ] Test tenant has Google Calendar connected
- [ ] Your test phone is charged, ringer ON, on the same desk
- [ ] Browser: two tabs — `/campaigns` and Twilio Console "Monitor → Calls"
- [ ] Terminal: worker logs tailing, filtered to `outbound-` events
- [ ] Clear prior demo data: `DELETE FROM campaign_contacts WHERE phone_e164 = '<YOUR_CELL>';`

### Live script

**1. Create the campaign** *(30s)*
- Navigate to `/campaigns/new`
- Fill: name = "Live Demo", from = Twilio number, dial window 8:00–20:00, retries = 1, concurrent = 1, voicemail message = short friendly message
- Click **Create Campaign** → lands on detail page, stats all zero

**2. Upload leads** *(30s)*
- Drag `demo-leads.csv` (1 row: your cell phone) into the upload zone
- Toast: "1 lead imported"
- Lead appears in table with status = Pending

**3. Start the campaign** *(15s)*
- Click **Start Campaign** → confirmation → status flips to Running
- *(Talking point: "Behind the scenes — dial-window check, concurrency guard, DNC lookup all ran before Twilio was touched.")*

**4. The call rings** *(~90s total)*
- Phone rings. Answer it.
- **Grok**: "Hi, may I speak with Alex? ... My name is Sarah calling from Bright Smile Dental..."
- **You**: "Yes, speaking."
- **Grok**: "Do you currently have a dentist you see regularly?"
- **You**: "No, I've been putting it off actually."
- **Grok**: "Great — we're welcoming new patients. Do mornings or afternoons work better for a cleaning?"
- **You**: "Mornings."
- **Grok**: *(offers 2 slots)*
- **You**: "The first one works."
- **Grok**: "Can I grab an email for your confirmation?"
- **You**: "alex@example.com"
- **Grok**: "Booked. Thanks for your time, Alex — have a great day!"

**5. The dashboard updates** *(30s)*
- Refresh `/campaigns/<id>` (or watch SWR auto-revalidate)
- Stats card: Booked = 1, Qualified = 1, Connected = 1
- Lead row now green with ✓ Booked badge
- Click the lead → slide-over shows:
  - Appointment link ("Cleaning, Thu 10:00 AM")
  - AI notes: "Interested in cleaning, no current dentist, prefers mornings"
  - Call transcript link

**6. The artifacts** *(60s)*
- Click transcript link → `/calls/<id>`
  - Full transcript rendered (caller + agent turns with timestamps)
  - AI-generated summary at the top
- Click appointment link → `/appointments/<id>`
  - Time, type, contact, Google Calendar event ID
  - Open Google Calendar in another tab → event is there with the same ID

**7. Close** *(15s)*
> "That was a cold lead, qualified by AI, booked on a real calendar, with a full transcript and summary stored — no human touched it. The same flow handles voicemail, no-answer, opt-out, and retry cases; all covered by the test suite and the scenarios in our runbook."

### Backup plan if the live call fails mid-demo

If Grok drops or Twilio 500s, pivot to the **dashboard walkthrough** of a pre-recorded completed campaign (seeded the night before):
- Show the completed lead table with mixed outcomes (1 booked, 1 qualified-no-slot, 1 voicemail, 1 DNC)
- Click each lead to show the slide-over + transcript
- "In production the platform handles all of these automatically — this one had an issue today but we've got it logged and will debug after the demo."

Keep the seeded campaign permanent in a non-prod tenant for this exact purpose.
