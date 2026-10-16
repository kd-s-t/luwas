# Ugnai — Production architecture

This document is the **production / Cup deploy** blueprint. Day-to-day development uses **Firebase emulators** (see root [README.md](../README.md)). Do not apply Terraform until a real GCP project is ready.

Local emulators require a JDK (Java 21+). Production does not run emulators.

## Product

**Ugnai** (*Unified Guidance for Needs, Alerts & Incidents*) — barangay / LGU DRRM command center. Theme: Sustainability and social impact (AI Builder Cup 2026).

Gemini orchestrates needs and resources; Firebase hosts auth, data, and the live app. Frame as **orchestration + guidance for responders**, not realtime life-safety guarantees.

## Google services

| Service | Role |
|---------|------|
| **Firebase Auth** | Officer login / register (email + password) |
| **Cloud Firestore** | Officer profiles; later barangays, contacts, incidents, resources, alert logs |
| **Firebase App Hosting** | Host Next.js command center (Cup-valid deploy target) |
| **Gemini 2.5 Flash** | Needs triage, resource allocation suggestions, alert copy (later) |
| **Earth Engine** | Offline Cebu DEM + hazards (`npm run ee:dem`, `npm run ee:hazards` → `data/cebu-ee-*.json`); map reads cache only |
| **Vertex AI** | Optional report photo classification before Gemini |
| **Maps Platform** | Optional Weather / Elevation (`GOOGLE_WEATHER_API_KEY`) |
| **Cloud Functions for Firebase** | Server-side Gemini + multi-channel dispatch (later) |
| **Firebase Cloud Messaging** | Push alerts to resident devices (later) |
| **Trigger Email** (Firebase Extension) | Email alerts (later) |

**Checklist:** [GOOGLE_CHECKLIST.md](./GOOGLE_CHECKLIST.md) (Firebase, Gemini, Vertex, Maps, Earth Engine, Cup Google slice).

**Non-Google:** Twilio SMS for barangay phones (`/api/alerts/sms`); Twilio Voice for outbound calls (`/api/alerts/call`) — household evacuate blasts **and** officer-triggered BFP/PNP/hospital/tanod dials from `responderStations`. Without the matching env vars each channel runs in **demo mode** (logs only). Never auto-dial 911. Google FCM is push-to-app, not SMS to MSISDNs.

## ElevenLabs TTS (Mangugnai Speak)

Server route: `POST /api/ai/tts`. Set `ELEVENLABS_API_KEY` (and optional `ELEVENLABS_VOICE_ID` / `ELEVENLABS_MODEL_ID`) in App Hosting secrets / `.env.local`. First play per reply is cached (memory + Storage `audioUrl` + process LRU) so Speak replay does not regenerate.

| Voice | Voice ID | Notes |
|-------|----------|--------|
| **Si Airmac** (default) | `V9wXgxyhEFNo2WPR5uBy` | Voice Library; needs **paid** plan for API (e.g. Starter) |
| **Grandpa Spuds Oxley** | `NOpBlnGInO9m6vDvFkFC` | Library; paid API |
| **Bertch - Travel Buddy** | `2YPDVPh2YeXiRMgJXtvc` | Library; paid API |
| **George** (fallback) | `JBFqnCBsd6RMkjVDRZzb` | Premade; used if library returns `paid_plan_required` |

```bash
# Default (Si Airmac). Override with Spuds / Bertch / George as needed.
ELEVENLABS_VOICE_ID=V9wXgxyhEFNo2WPR5uBy
# ELEVENLABS_VOICE_ID=NOpBlnGInO9m6vDvFkFC
# ELEVENLABS_VOICE_ID=2YPDVPh2YeXiRMgJXtvc
# ELEVENLABS_VOICE_ID=JBFqnCBsd6RMkjVDRZzb
```

Free tier: library voices often return `paid_plan_required`; client falls back to George, then browser `speechSynthesis`.

## Data (Firestore)

Slice 1 collections:

- `users/{uid}` — `{ uid, email, displayName, orgName, role: "officer", createdAt }`

Planned later: `barangays`, `contacts`, `incidents`, `resources`, `alerts`.

## Local vs production

| | Local (now) | Production |
|--|-------------|------------|
| App | `npm run dev` | Firebase App Hosting |
| Auth | Auth emulator `:9099` | Firebase Auth |
| DB | Firestore emulator `:8080` | Cloud Firestore |
| Infra | No apply | `infra/` Terraform |
| Env | `.env.local` + `NEXT_PUBLIC_USE_EMULATORS=true` | Real web config, emulators off |

```
Officer browser
    │
    ▼
Next.js (App Hosting)
    ├── Firebase Auth
    ├── Cloud Firestore
    └── (later) HTTPS → Cloud Functions
                            ├── Gemini 2.5 Flash
                            ├── FCM
                            ├── Trigger Email
                            ├── Twilio SMS
                            └── Twilio Voice
```

## Terraform (`infra/`)

Providers: `hashicorp/google`, `hashicorp/google-beta`.

**Intended to provision:**

- Required GCP APIs (Identity Toolkit, Firestore, Firebase Management, etc.)
- Firebase project linkage
- Firestore database
- Outputs for Next.js env (`project_id`, web API key / config fields when available)

**Apply (fresh free Firebase / GCP account):**

```bash
# 1) Auth (once)
gcloud auth login
gcloud auth application-default login

# 2) Terraform
cd infra
cp terraform.tfvars.example terraform.tfvars   # set project_id (globally unique)
# Optional: billing_account = "01XXXX-..." if API enable / Firestore requires Blaze
terraform init
terraform plan
terraform apply

# 3) Print Next.js env from outputs
terraform output -raw next_env_hint
```

With `create_project = true` (default in the example), Terraform creates the GCP project, enables APIs, adds Firebase, creates Firestore, and a web app config.

Map outputs into App Hosting / `.env` with `NEXT_PUBLIC_USE_EMULATORS=false`. Enable **Email/Password** in Firebase Auth console after apply.

**Caveats:** App Hosting, Extensions, and some Auth console settings remain partial in the provider. Terraform owns project + core services; use Firebase CLI for gaps. Spark (free) works for Auth + Firestore; some GCP API enable calls may ask for a billing account — set `billing_account` if apply fails.

## CI / CD (GitHub)

Repo: [kd-s-t/ugnai](https://github.com/kd-s-t/ugnai)

- Push/PR to `main` runs **CI** (lint, typecheck, build)
- Optional **Deploy** workflow publishes Firestore rules/indexes when Actions secrets are set (see `.github/workflows/README.md`)
- Wire **Firebase App Hosting** to the same GitHub repo for Next.js CD on `main`

## Cup deploy checklist

Full Google tech boxes: **[GOOGLE_CHECKLIST.md](./GOOGLE_CHECKLIST.md)**.

1. GCP project + billing; `terraform apply` (or console equivalent)
2. Enable email/password in Firebase Auth
3. Deploy Firestore rules (`gh` Actions Deploy, or `firebase deploy --only firestore`)
4. Set Gemini API key in Secret Manager / App Hosting secrets
5. Refresh EE caches before demo if needed (`npm run ee:dem`, `npm run ee:hazards`)
6. Deploy Next.js via Firebase App Hosting (connect [kd-s-t/ugnai](https://github.com/kd-s-t/ugnai))
7. Verify live URL for submission package
8. Keep demo framing: orchestration for barangay responders

## Security notes

- Never ship Gemini or Twilio secrets to the browser
- Tighten Firestore rules as collections grow (org-scoped officers)
- Rate-limit alert dispatch in production Functions
