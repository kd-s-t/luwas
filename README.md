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

Open http://127.0.0.1:3000 → **Register** once (demo fields auto-fill) → `/admin/overview`. After that, Login works.

**Demo officer** (emulators only): `officer@nangka.consolacion.demo` / `demo1234` — Maria Santos, Brgy. Nangka MDRRMO.

**Demo citizens** (emulators only, password `demo1234`) — login at `/login/citizen`:

| Email | Name | Purok |
|-------|------|-------|
| `juan.delacruz@nangka.citizen.demo` | Juan Dela Cruz | Purok 1 |
| `ana.reyes@nangka.citizen.demo` | Ana Reyes | Purok 2 |
| `carlo.bautista@nangka.citizen.demo` | Carlo Bautista | Purok 3 |
| `liza.mendez@nangka.citizen.demo` | Liza Mendez | Purok 4 |
| `marco.tan@nangka.citizen.demo` | Marco Tan | Purok 5 |

Citizens upload photo/video hazard reports → AI validation queue (`queued` → Gemini/local verdict) → officers review on `/admin/overview`.

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

## Google tech checklist

See [docs/GOOGLE_CHECKLIST.md](docs/GOOGLE_CHECKLIST.md) for Firebase, Gemini, Vertex, Maps, and Earth Engine setup boxes.

## Earth Engine (offline Cebu DEM)

Flood footprints use a cached elevation grid. Optionally refresh from Google Earth Engine (SRTM) in **one** offline call (whole Cebu coarse + Nangka fine):

1. Enable Earth Engine API on project `nice-pen-181017` and register a **service account** for EE ([guide](https://developers.google.com/earth-engine/guides/service_account)).
2. Set `EARTH_ENGINE_PROJECT_ID=nice-pen-181017` and `GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json` in `.env.local`.
3. Run `npm run ee:dem` once → writes `data/cebu-ee-dem.json` + Nangka slice `data/nangka-ee-dem.json`.
4. Run `npm run ee:hazards` → floods/landslides from DEM cache + one FIRMS fire pull → `data/cebu-ee-hazards.json` (map shows nearby pins per barangay).
5. Map / flood elev logic prefers the Nangka JSON when `samples` is non-empty; otherwise falls back to `lib/geo/nangkaElevationGrid.ts`.

Check auth only (no DEM job): `GET /api/geo/earth-engine`.

## Production

See [docs/PRODUCTION.md](docs/PRODUCTION.md) for Google services, Terraform, and Cup deploy checklist. Keep `NEXT_PUBLIC_USE_EMULATORS=false` when pointing at a real Firebase project.
