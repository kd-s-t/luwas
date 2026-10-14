# Luwas docs

Day-to-day local setup lives in the root [README.md](../README.md). This folder is deeper ops / Cup notes.

## Index

| Doc | What it covers |
|-----|----------------|
| [GOOGLE_CHECKLIST.md](./GOOGLE_CHECKLIST.md) | Firebase, Gemini, Vertex, Maps, Earth Engine checklist |
| [PRODUCTION.md](./PRODUCTION.md) | Prod / Cup deploy blueprint (not for local emulators) |
| [report-validation-flow.md](./report-validation-flow.md) | Citizen report → AI verdict path |
| [vertex-dataset-ingest-flow.md](./vertex-dataset-ingest-flow.md) | Vertex training / ingest notes |

## Local emulator data

Local Auth / Firestore / Storage run in Firebase emulators (`demo-dro`).

**Backup (while emulators are up):**

```bash
npx firebase emulators:export .emulator-backup/pre-clean --project demo-dro --force
```

**Clear (wipe live emulator DB; keep the backup folder):**

```bash
curl -X DELETE "http://127.0.0.1:9099/emulator/v1/projects/demo-dro/accounts"
curl -X DELETE "http://127.0.0.1:8080/emulator/v1/projects/demo-dro/databases/(default)/documents"
```

**Restore:**

```bash
npx firebase emulators:start --project demo-dro --import=.emulator-backup/pre-clean
```

Or start fresh and reseed demo users: `npm run seed:local`.

`.emulator-backup/` is gitignored.

## Simulation flag

`NEXT_PUBLIC_SIMULATION_ON=true` (default when unset):

- Before / During / After Tino packs + scenario bar
- Demo officer / citizen login picks + auto-seed staff, households, sample reports

Set `NEXT_PUBLIC_SIMULATION_ON=false` for live ops only (no scenario bar, no dummy seeds). Restart Next after changing.

## Official Google data slice

| Tech | Role |
|------|------|
| **Firestore** | Live ops DB |
| **BigQuery** | Mirror after report verdict (`legit` / `rejected` / `needs_review`) |
| **Earth Engine** | Offline SRTM DEM + Cebu hazard caches for flood / triage |
| **Maps JS** | Basemap |

## Elevations (map flood / triage)

| Source | Role |
|--------|------|
| `data/nangka-ee-dem.json` | Active grid when present (Earth Engine SRTM, offline) |
| `lib/geo/nangkaElevationGrid.ts` | Fallback: cached **Google Elevation** samples |
| Google Maps JS | Basemap tiles only, not the DEM |

Refresh EE caches: `npm run ee:dem` / `npm run ee:hazards` (see GOOGLE_CHECKLIST).
