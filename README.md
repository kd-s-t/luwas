# Luwas

Barangay / LGU DRRM **command center**. Slice 1: officer **login / register** against Firebase Auth + Firestore.

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
cp .env.example .env.local   # already defaults to emulators
npm install
```

**Both processes must be running.** If you only run `npm run dev`, login shows `auth/network-request-failed`.

Terminal 1 — emulators (uses local JDK under `.tools/jdk-21` if present):

```bash
npm run emulators
```

Wait until you see `All emulators ready`.  
Emulator UI: http://127.0.0.1:4000 · Auth `:9099` · Firestore `:8080`

Terminal 2 — app:

```bash
npm run dev
```

Open http://127.0.0.1:3000 → **Register** once (demo fields auto-fill) → `/command`. After that, Login works.

**Demo account** (emulators only): `officer@nangka.consolacion.demo` / `demo1234` — Maria Santos, Brgy. Nangka MDRRMO (Consolacion, Cebu).

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js local app |
| `npm run emulators` | Auth + Firestore emulators |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |

## CI / CD

GitHub: [kd-s-t/luwas](https://github.com/kd-s-t/luwas)

- **CI** (`.github/workflows/ci.yml`) — lint, typecheck, and build on every push/PR to `main`
- **Deploy** (`.github/workflows/deploy.yml`) — optional Firestore rules/indexes deploy (secrets + `ENABLE_FIREBASE_DEPLOY`)
- **App Hosting** — connect the repo in Firebase console for Next.js CD

Details: [.github/workflows/README.md](.github/workflows/README.md)

## Production

See [docs/PRODUCTION.md](docs/PRODUCTION.md) for Google services, Terraform, and Cup deploy checklist. Keep `NEXT_PUBLIC_USE_EMULATORS=false` when pointing at a real Firebase project.
