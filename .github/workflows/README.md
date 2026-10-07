# GitHub Actions — Luwas

Repo: [kd-s-t/luwas](https://github.com/kd-s-t/luwas)

| Workflow | When | What |
|----------|------|------|
| **CI** | Push / PR → `main` | `npm ci` → lint → typecheck → Next.js build |
| **Deploy** | Manual, or push changing Firestore files | `firebase deploy` rules + indexes (opt-in) |

## CI

No secrets required. Build uses placeholder `NEXT_PUBLIC_FIREBASE_*` values.

## Deploy (optional)

1. Create a Firebase CI token: `npx firebase-tools login:ci`
2. In GitHub → **Settings → Secrets and variables → Actions**:
   - Secret `FIREBASE_TOKEN` — token from step 1
   - Secret `FIREBASE_PROJECT_ID` — GCP / Firebase project id
   - Variable `ENABLE_FIREBASE_DEPLOY` = `true`
3. Run **Deploy** via **Actions → Deploy → Run workflow**, or push changes under `firestore.*`

## App (Next.js) hosting

Prefer **Firebase App Hosting** connected to this GitHub repo (builds on push to `main`). Set production env there (`NEXT_PUBLIC_USE_EMULATORS=false`, real Firebase web config, optional `GEMINI_API_KEY`). See [docs/PRODUCTION.md](../../docs/PRODUCTION.md).
