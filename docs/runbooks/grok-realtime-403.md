# Grok realtime WebSocket 403 (silent call-me)

Homepage call-me (and every live Telnyx↔Grok call) opens:

```
wss://api.x.ai/v1/realtime?model=<XAI_REALTIME_MODEL>
Authorization: Bearer <XAI_API_KEY>
```

That matches current xAI Speech-to-Speech docs. Grok/xAI stays the brain+voice;
Telnyx stays the carrier. Do not switch to Telnyx Conversational AI or xAI Voice Builder.

A failed handshake used to log only:

```
Grok realtime connect failed … err=Unexpected server response: 403
```

`ws` puts the HTTP status on `error` and the response body on `unexpected-response`.
We now log both on the Railway `msg` line, plus key presence — never the secret:

```
Grok realtime connect failed callSid=… tenantId=… err=Unexpected server response: 403
httpStatus=403 body=… apiKeyPresent=true apiKeyLen=54 apiKeyPrefix=xai-
authHeader=true model=grok-voice-think-fast-1.0
wsUrl=wss://api.x.ai/v1/realtime?model=grok-voice-think-fast-1.0
keySanitized=false placeholder=false
```

## What the fields mean

| Field | How to read it |
|---|---|
| `httpStatus=401` | Missing/invalid token. Rotate `XAI_API_KEY` in Railway. |
| `httpStatus=403` | Key was accepted; team/ACL/credits/model permission denied. |
| `httpStatus=404` | Wrong path or retired model. Check `model=` vs xAI docs. |
| `apiKeyPresent=false` / `placeholder=true` | Env missing or still the degraded `unconfigured` sentinel. |
| `apiKeyPrefix` not `xai-` | Wrong kind of key (management key, OpenAI key, etc.). |
| `keySanitized=true` | Quotes / whitespace / doubled `Bearer ` were stripped. Redeploy is enough if that was the only issue. |
| `authHeader=false` | We opened the socket without `Authorization` — a code bug; reopen this runbook's PR. |
| `body=` | Clipped xAI error text (secrets redacted). This is the source of truth. |

## If 403 is credits / scope (not a code bug)

Joey, in [console.x.ai](https://console.x.ai):

1. **Credits** — Prepaid balance > $0. Empty credits often surface as a voice handshake 403, not a chat 402.
2. **API key ACLs** — Keys have no access by default. The production key needs both:
   - `api-key:endpoint:*` (or the realtime / audio endpoint listed under Team → Endpoints)
   - `api-key:model:*` (or `api-key:model:grok-voice-think-fast-1.0` and/or `…-2.0`)
3. **Right key type** — Inference API key (`xai-…`), not a Management API key.
4. **Model pin** — If `body` says the model is forbidden, set Railway `XAI_REALTIME_MODEL` to `grok-voice-think-fast-2.0` or `grok-voice-latest` and redeploy. Do not change the WebSocket path.
5. **Smoke test** (local, never paste the key into chat/logs):

```bash
wscat -c "wss://api.x.ai/v1/realtime?model=${XAI_REALTIME_MODEL:-grok-voice-think-fast-1.0}" \
  -H "Authorization: Bearer $XAI_API_KEY"
```

A 101 upgrade means the key+model are allowed. Then retry homepage call-me.

## What this is not

- Not a Telnyx stream bug. If logs already show `encoding=PCMU sampleRate=8000` and `streaming_start skipped (stream at dial)`, the carrier path is fine.
- Not a missing `Authorization` header in current code. `GrokVoiceAdapter.createSession` always sends `Bearer <sanitized key>`.
- Not an invitation to swap voice providers.
