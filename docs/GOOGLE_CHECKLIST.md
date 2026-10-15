# Google tech checklist (Luwas)

Use this for Cup demos and production. Project: **`nice-pen-181017`** (Luwas).

Non-Google (Twilio, ElevenLabs, Open-Meteo, OSRM) is out of scope here.

## In use now

| Tech | What Luwas uses it for | Env / how |
|------|------------------------|-----------|
| **Firebase Auth** | Officer + citizen login | `NEXT_PUBLIC_FIREBASE_*`, emulators local |
| **Cloud Firestore** | Users, reports, households, command data (ops DB) | same + rules deploy |
| **BigQuery** | Warehouse mirror after report verdict (`legit` / `rejected` / `needs_review`) | `BIGQUERY_*` + ADC; skips if unset |
| **Firebase Storage** | Report media / TTS cache | Storage bucket in Firebase config |
| **Firebase App Hosting** | Prod Next.js host | Console ↔ GitHub `kd-s-t/luwas` |
| **Gemini** | Chat assist, report validation | `GEMINI_API_KEY` |
| **Vertex AI** | Photo class before Gemini (optional) | `VERTEX_PROJECT_ID`, `VERTEX_LOCATION`, `VERTEX_ENDPOINT_ID`, ADC/SA |
| **Maps JavaScript** | Situation / command map tiles | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| **Maps Platform** | Weather (+ Elevation API as elev fallback) | `GOOGLE_WEATHER_API_KEY` |
| **Earth Engine** | SRTM DEM + Cebu hazard cache (admin pull → Firebase Storage `ee-cache/`) | `EARTH_ENGINE_PROJECT_ID`, ADC, `FIREBASE_STORAGE_BUCKET` |

## Earth Engine (offline)

- [ ] Earth Engine API enabled on `nice-pen-181017`
- [ ] Cloud project registered in [Code Editor](https://code.earthengine.google.com/)
- [ ] Service account created + JSON key (gitignored, e.g. `.secrets/luwas-ee.json`)
- [ ] SA has project access (e.g. Editor) and EE can run as that SA
- [ ] `.env.local`: `EARTH_ENGINE_PROJECT_ID=nice-pen-181017` + `GOOGLE_APPLICATION_CREDENTIALS=…`
- [ ] `npm run ee:dem` → `data/cebu-ee-dem.json` + `data/nangka-ee-dem.json`
- [ ] `npm run ee:hazards` → `data/cebu-ee-hazards.json` (floods / landslides / FIRMS fires)
- [ ] `GET /api/geo/earth-engine` shows ready + cache counts
- [ ] Map refresh: flood elev uses Nangka EE cache; other brgys show nearby EE hazard pins
- [ ] Know billing: app does **not** call EE per page load; only manual `ee:dem` / `ee:hazards` spend compute (watch commercial platform fees)

## Firebase

- [ ] `NEXT_PUBLIC_USE_EMULATORS=true` local / `false` prod
- [ ] `NEXT_PUBLIC_SIMULATION_ON=true` for Tino phases + demo users (false = live only)
- [ ] Email/password Auth enabled (prod)
- [ ] Firestore rules + indexes deployed
- [ ] App Hosting connected to repo / live URL works

## Gemini + Vertex

- [ ] `GEMINI_API_KEY` set (falls back to local rules if unset)
- [ ] Vertex endpoint trained/deployed (optional)
- [ ] `VERTEX_*` + ADC/SA set if using Vertex
- [ ] Validation flow: queue → Vertex (optional) → Gemini → verdict

## BigQuery

- [ ] Dataset / table env set (`BIGQUERY_PROJECT_ID`, `BIGQUERY_DATASET`, `BIGQUERY_TABLE` or defaults)
- [ ] ADC / SA can write BigQuery on `nice-pen-181017`
- [ ] After verify / reject / needs_review, row lands in BQ (ops stay in Firestore)
- [ ] `CRON_SECRET` + `FIREBASE_STORAGE_BUCKET` on runtime for monthly Vertex labels export
- [ ] Cloud Scheduler (1st of month) → `POST https://luwasph.com/api/cron/vertex-ingest-export` (Bearer `CRON_SECRET`)
- [ ] Check `gs://luwas-media-nice-pen-181017/luwas-vision-ingest/latest/labels.csv`

## Maps / Weather

- [ ] `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` for Maps JS
- [ ] `GOOGLE_WEATHER_API_KEY` for Weather (optional; else Open-Meteo)

## Cup deploy (Google slice)

1. [ ] GCP project + Firebase linked
2. [ ] Auth email/password on
3. [ ] Firestore rules deployed
4. [ ] Gemini secret on App Hosting / runtime
5. [ ] BigQuery env + ADC on App Hosting / runtime
6. [ ] EE caches committed or regenerated before demo (`ee:dem`, `ee:hazards`)
7. [ ] App Hosting live URL verified
8. [ ] No Gemini / SA JSON / Maps keys in client bundles or git

## Demo talking points

- **Firebase** = auth + live ops data + host  
- **BigQuery** = post-verdict warehouse (analytics / Cup data story)  
- **Gemini** (+ optional **Vertex**) = triage / validation  
- **Earth Engine** = offline SRTM DEM + FIRMS fire hotspots for flood / hazard layers  
- **Maps JavaScript** = basemap; EE is the elevation / hazard cache, not a live map SDK  

### What Mangluluwas (Gemini) is fed

| Input | Source |
|-------|--------|
| Weather line | Google Weather (or Open-Meteo fallback) via `/api/weather` |
| Households / roster | Firestore |
| Flood / landslide / typhoon context | Scenario + elev-derived floods |
| Elev for flood paint / who to evac | **Earth Engine SRTM cache** (primary); Google Elevation grid only if EE cache empty |
| Map display | Google Maps JS (UI only; Gemini does not call Maps) |

See also: [README.md](./README.md), [PRODUCTION.md](./PRODUCTION.md), [report-validation-flow.md](./report-validation-flow.md), root [README.md](../README.md).
