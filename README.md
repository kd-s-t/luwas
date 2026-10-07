# Luwas

**Logistics & Unified Workflow for Aid & Safety** — barangay / LGU DRRM command center (Next.js, Tailwind, Lucide, shadcn/ui).

Slice 1: officer **login / register** against Firebase Auth + Firestore.

- **Local (now):** Next.js + Firebase Auth & Firestore **emulators**
- **Production:** documented in [docs/PRODUCTION.md](docs/PRODUCTION.md); Terraform blueprint in `infra/` (do not apply for local)

## Prerequisites

- Node.js 20+
- **Java 21+** for Firebase emulators (`auth/network-request-failed` means the emulator is not running)

If you do not have a system JDK, this repo can use a local one under `.tools/jdk-21` (gitignored). After it exists:

```bash
export JAVA_HOME="$PWD/.tools/jdk-21"
export PATH="$JAVA_HOME/bin:$PATH"
java -version
```

Or install system-wide: `brew install openjdk@21` and link it per Homebrew’s caveats.

## Local setup

```bash
cp .env.example .env.local && npm install && npm run start:local
```

That one line starts **Firestore/Auth emulators + Next.js**.  
App: http://127.0.0.1:3000 · Emulator UI: http://127.0.0.1:4000

(First time only needs `cp` + `npm install`; after that just `npm run start:local`.)

Open http://127.0.0.1:3000 → **Register** once (demo fields auto-fill) → `/command`. After that, Login works.

**Demo officer** (emulators only): `officer@nangka.consolacion.demo` / `demo1234` — Maria Santos, Brgy. Nangka MDRRMO.

**Demo citizens** (emulators only, password `demo1234`) — login at `/login/citizen`:

| Email | Name | Purok |
|-------|------|-------|
| `juan.delacruz@nangka.citizen.demo` | Juan Dela Cruz | Purok 1 |
| `ana.reyes@nangka.citizen.demo` | Ana Reyes | Purok 2 |
| `carlo.bautista@nangka.citizen.demo` | Carlo Bautista | Purok 3 |
| `liza.mendez@nangka.citizen.demo` | Liza Mendez | Purok 4 |
| `marco.tan@nangka.citizen.demo` | Marco Tan | Purok 5 |

Citizens upload photo/video hazard reports → AI validation queue (`queued` → Gemini/local verdict) → officers review on `/command`.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run start:local` | Emulators + Next.js (one command) |
| `npm run dev` | Next.js only |
| `npm run emulators` | Auth + Firestore + Storage emulators |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |

## CI / CD

GitHub: [kd-s-t/luwas](https://github.com/kd-s-t/luwas)

- **CI** (`.github/workflows/ci.yml`) — lint, typecheck, and build on every push/PR to `main`
- **Deploy** (`.github/workflows/deploy.yml`) — optional Firestore rules/indexes deploy (secrets + `ENABLE_FIREBASE_DEPLOY`)
- **App Hosting** — connect the repo in Firebase console for Next.js CD

Details: [.github/workflows/README.md](.github/workflows/README.md)

## Weather

Set `GOOGLE_WEATHER_API_KEY` for live Brgy. Nangka conditions via `/api/weather` (Maps Platform Weather). Responses are cached ~30 minutes so refreshes do not bill on every load. Falls back to free Open-Meteo if the key is unset.

## Production

See [docs/PRODUCTION.md](docs/PRODUCTION.md) for Google services, Terraform, and Cup deploy checklist. Keep `NEXT_PUBLIC_USE_EMULATORS=false` when pointing at a real Firebase project.
