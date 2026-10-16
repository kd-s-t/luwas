# Ugnai monthly cost (server / integrations + Gemini)

Project: **`nice-pen-181017`**. Estimates from Ugnai call paths + list prices (Oct 2026). Not a GCP / Twilio / ElevenLabs invoice.

**Out of this doc:** Maps JS overages, BigQuery (usually cents at barangay scale).

Default Gemini model: **`gemini-3.5-flash-lite`**  
Paid rates: **$0.30 / 1M input** · **$2.50 / 1M output**

---

## Volume scenarios

| Scenario | Reports / month | ID checks | Chat / assist | Auto SMS+call* | Speak (first plays) | EE jobs |
|----------|-----------------|-----------|---------------|----------------|---------------------|---------|
| Cup / demo month | ~80 | ~25 | ~120 | ~20 | ~40 | ~2 |
| Quiet barangay month | ~400 | ~80 | ~500 | ~80 | ~150 | ~2 |
| Active storm month | ~2500 | ~200 | ~2000 | ~500 | ~600 | ~4 |

\*Legit reports that hit `autoResponderRouteForHazard`. Sandbox still bills Twilio against `TWILIO_SANDBOX_TO` only.

### Quiet barangay month

| Line | Est. / month |
|------|----------------|
| Gemini | ~$1.05 |
| Vertex AutoML (≈1 hr serve) | ~$1–5 |
| Firebase (Blaze dribbles) | ~$8 |
| Twilio (SMS + Voice) | ~$65 |
| ElevenLabs TTS | ~$5 (Starter) |
| Resend (email) | ~$0 (Free) |
| Earth Engine (noncommercial) | $0 |
| **Estimated total** | **~$80** |

### Cup / demo month

| Line | Est. / month |
|------|----------------|
| Gemini | ~$0.25 |
| Vertex AutoML (≈1 hr serve) | ~$1–5 |
| Firebase | ~$2 |
| Twilio | ~$16 |
| ElevenLabs | ~$0–5 (Free or Starter) |
| Resend (email) | ~$0 (Free) |
| Earth Engine (noncommercial) | $0 |
| **Estimated total** | **~$20–25** |

### Active storm month

| Line | Est. / month |
|------|----------------|
| Gemini | ~$5.40 |
| Vertex AutoML (≈1 hr serve) | ~$1–5 |
| Firebase (Storage / App Hosting egress) | ~$35 |
| Twilio | ~$400 |
| ElevenLabs | ~$22 (Creator) |
| Resend (email) | ~$0–20 |
| Earth Engine (noncommercial) | $0 |
| **Estimated total** | **~$460** |

---

## Gemini (prompts)

| Call | Route | Est. tokens in / out | Cost / call (paid) |
|------|-------|----------------------|--------------------|
| Report validate | `/api/ai/validate-report` | ~1800 / 120 | ~$0.0008 |
| Register ID | `/api/ai/verify-id` | ~3000 / 100 | ~$0.0011 |
| Chat / assist | `/api/ai/chat`, assist | ~1200 / 350 | ~$0.0012 |

Report + ID calls send images inline. Video reports cost more. Free Gemini tier = $0 until free limits or paid.

```text
cost = (inputTokens × calls × 0.30 + outputTokens × calls × 2.50) / 1_000_000
```

| Scenario | Report validates | ID checks | Chat / assist | Gemini total |
|----------|------------------|-----------|---------------|--------------|
| Cup / demo | 80 | 25 | 120 | ~$0.25 |
| Quiet barangay | 400 | 80 | 500 | ~$1.05 |
| Active storm | 2500 | 200 | 2000 | ~$5.40 |

---

## Firebase (Blaze)

| Piece | Free allowance | Ugnai use |
|-------|----------------|-----------|
| Firestore reads | 50K / day | Queue + map live |
| Firestore writes | 20K / day | Reports + users |
| Storage | 5 GB store · 1 GB/day download | Photos / TTS |
| App Hosting bandwidth | 10 GiB / month | Next.js traffic |
| Auth | 50K MAU (email) | Officers + citizens |

Quiet months usually stay inside free quotas. Cost jumps when App Hosting bandwidth or Storage downloads spike (many media views).

---

## Twilio (SMS + Voice)

Used by `/api/alerts` + auto-responder after a report is marked **legit**: SMS and a short Voice call (script + TimeLimit under 1 min) to matched responders (tanod / PNP / BFP / hospital).

Rates used for PH mobile destinations (Twilio list, Oct 2026):

| Piece | Rate |
|-------|------|
| SMS outbound to PH | ~$0.241 / segment |
| Voice outbound to PH mobile | ~$0.29 / min |
| US / toll-free number rental | ~$2–5 / mo (depends on number type) |

**Per auto-dispatch (typical 2 responders × 1 SMS + ~0.5 min call each):**

```text
2 × $0.241  +  2 × 0.5 × $0.29  ≈  $0.77
```

| Scenario | Dispatches | Est. Twilio |
|----------|------------|-------------|
| Cup / demo | ~20 | ~$16 |
| Quiet barangay | ~80 | ~$65 |
| Active storm | ~500 | ~$400 |

Sandbox does **not** make Twilio free; it only redirects all SMS/calls to `TWILIO_SANDBOX_TO`. Production without sandbox multiplies by real responder count.

---

## ElevenLabs (Mangugnai Speak)

Server route: `POST /api/ai/tts`. Model: **`eleven_multilingual_v2`**. First Speak per reply hits ElevenLabs; replay uses memory / Storage `audioUrl` (no second charge).

| Plan | Monthly | Included (v2 ≈ 1 credit / char) |
|------|---------|--------------------------------|
| Free | $0 | 10k credits |
| Starter | $5–6 | 30k credits |
| Creator | $22 | 121k credits |
| API pay-as-you-go | — | ~$0.08 / 1k characters |

Assume ~250 characters per spoken reply:

| Scenario | First Speaks | Chars | Fit |
|----------|--------------|-------|-----|
| Cup / demo | ~40 | ~10k | Free or Starter |
| Quiet barangay | ~150 | ~38k | Starter (~$5) |
| Active storm | ~600 | ~150k | Creator (~$22) |

Browser TTS is the free fallback when ElevenLabs is unset or over quota.

---

## Resend (email)

Account decisions + alert email (`sendEmailBatch`). Free: **3,000 emails / month** (100 / day). Pro: **$20 / month** for 50k.

Ugnai volume (ID approvals, officer alerts) stays under Free for cup / quiet months. Storm month still usually Free; jump to Pro only if you blast many recipients per alert.

| Scenario | Est. |
|----------|------|
| Cup / quiet | **~$0** |
| Active storm | **~$0–20** |

---

## Vertex AI → Gemini Enterprise Agent Platform

**Rename (Apr 2026):** Vertex AI → **Gemini Enterprise Agent Platform** (Agent Platform). `VERTEX_*` env still works.

Ugnai: AutoML image class on report photos. Estimate if you run ~1 hour/month and keep the endpoint undeployed otherwise:

| | Est. |
|--|------|
| Serve ~1 hr / month ($1.375 / node-hour) | **~$1.40** |
| Train ~1 hr when you retrain ($3.465 / hour) | **~$3.50** (one-off) |
| **Typical month (serve only)** | **~$1–5** |
| Always-on endpoint | **~$1,000 / month** (avoid) |

---

## Earth Engine

App does **not** call EE per page load. Only manual `ee:dem` / `ee:hazards` (or admin run) spend compute. Map reads JSON caches.

| Plan | Monthly |
|------|---------|
| Noncommercial / research | $0 (quota tiers) |
| Limited (usage only) | ~$0.40 / EECU-hour |
| Basic platform | $500 / month + credits |

For Ugnai-sized Cebu / Nangka cache refreshes, Limited compute stays under a few dollars if commercial. Basic is only needed if you buy that plan.

---

## What drives the bill

1. **Twilio** - largest line once auto SMS + Voice leave sandbox and hit real PH mobiles.
2. **Firebase** - jumps when App Hosting bandwidth or Storage downloads spike.
3. **ElevenLabs** - small until Speak volume exceeds Starter; Creator covers a storm month of chat TTS.
4. **Gemini** - cheap per call; volume + images add up only a few dollars even in a storm month.
5. **Vertex AutoML** - ~$1–5/month at ~1 hr serve; ~$1k if always-on.
6. **Earth Engine** - only jumps if you buy Basic ($500). Keep-alive refreshes on Limited stay small.
