# Luwas features

Barangay DRRM command + citizen hazard reporting. Reference area: **Brgy. Nangka, Consolacion, Cebu** (also onboards other Cebu barangays, e.g. **Brgy. Apas, Cebu City**).

---

## Citizen

| Feature | What it does |
|---------|----------------|
| Report incident | Multi-step wizard: myself / someone else, situation, required photo, location, review |
| Guest report | No login; gets a `LUW-…` reference ID |
| Registered citizen | ID + face verify (Gemini), household roster match |
| Track report | Look up by reference; status timeline (queued → review → assigned → done) |
| Voice note | Optional record + Gemini / local transcript |
| iOS ingest | Native app path into the same report queue |
| Multi-language | EN / TL / CEB citizen copy |

---

## Officer command

| Feature | What it does |
|---------|----------------|
| Officer login | Email/password; prod quick roles (Nangka captain, Apas captain, MDRRMO, LGU) |
| Area switcher | Onboarded barangays + add barangay; profile home area stays listed |
| Overview map | Situation map, households, hazards, Tino phases (when simulation on) |
| Incident board | Kanban by status; assign investigator; shows report ref |
| Validation queue | AI + human verify / reject / needs review |
| Incident detail | Media, trust score, AI reason, dispatch hooks |
| Households | Roster, CSV import, curated pins, presence |
| Staff / users | Hierarchy, hire/fire (captain), pending account approvals |
| Alerts | SMS / email / voice (Twilio + templates) when validated |
| Support | Bug / feedback tickets |
| Earth Engine admin | Manual DEM / hazard cache runs (offline JSON for map) |
| Onboard barangay | Pick Cebu barangay, hall pin, org profile, activate + seed |

---

## AI / validation

| Feature | What it does |
|---------|----------------|
| Report validate | Vertex (optional photo class) → Gemini verdict: `legit` / `rejected` / `needs_review` |
| Register ID | Gemini checks DL / Passport / UMID + selfie match |
| Mangluluwas chat | Command assist (weather, roster, triage context) |
| Local fallback | Rule-based validate / chat when Gemini unavailable |
| Trust score | Registered + ID + contacts + AI confidence |

See [report-validation-flow.md](./report-validation-flow.md).

---

## Geo / map

| Feature | What it does |
|---------|----------------|
| Google Maps JS | Basemap for command + public situation |
| Earth Engine caches | SRTM DEM + FIRMS / flood / landslide pins (offline) |
| Flood / triage paint | Elev from EE cache (Elevation API fallback) |
| Weather | Google Weather or Open-Meteo |
| Evac / safe points | Hall + nearby centers |

---

## Data / platform

| Feature | What it does |
|---------|----------------|
| Firebase Auth | Officers + citizens |
| Cloud Firestore | Live ops DB (users, reports, households, staff) |
| Firebase Storage | Report media, TTS cache |
| Firebase App Hosting | Prod Next.js (`luwasph.com`) |
| BigQuery | Post-verdict warehouse mirror |
| Multi-barangay | Area id e.g. `consolacion/nangka`, `cebu-city/apas` |

---

## Simulation (optional)

When `NEXT_PUBLIC_SIMULATION_ON=true`:

- Tino Before / During / After scenario packs
- Demo officers / citizens + sample queue reports
- Auto-seed staff / households for Cup demos

Set `false` for live ops only. Restart Next after changing.
