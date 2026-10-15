# Luwas monthly cost (server only)

Project: **`nice-pen-181017`**. Server / hosting estimates from Luwas usage + Google list prices (Oct 2026). Not a GCP invoice.

**Out of this doc:** Gemini / AI prompt spend, Twilio SMS/voice, ElevenLabs TTS, Maps JS overages, Vertex endpoint hosting, BigQuery (usually cents at barangay scale).

---

## Volume scenarios (server)

| Scenario | Reports / month | Media views | EE cache jobs |
|----------|-----------------|-------------|---------------|
| Cup / demo month | ~80 | Low | ~2 (~1.5 EECU-h) |
| Quiet barangay month | ~400 | Moderate | ~2 (~2 EECU-h) |
| Active storm month | ~2500 | High | ~4 (~4 EECU-h) |

### Quiet barangay month

| Line | Est. / month |
|------|----------------|
| Firebase (Blaze dribbles) | ~$8 |
| Earth Engine (noncommercial) | $0 |
| **Estimated total** | **~$8** |

### Cup / demo month

| Line | Est. / month |
|------|----------------|
| Firebase | ~$2 |
| Earth Engine (noncommercial) | $0 |
| **Estimated total** | **~$2** |

### Active storm month

| Line | Est. / month |
|------|----------------|
| Firebase (Storage / App Hosting egress) | ~$35 |
| Earth Engine (noncommercial) | $0 |
| **Estimated total** | **~$35** |

---

## Firebase (Blaze)

| Piece | Free allowance | Luwas use |
|-------|----------------|-----------|
| Firestore reads | 50K / day | Queue + map live |
| Firestore writes | 20K / day | Reports + users |
| Storage | 5 GB store · 1 GB/day download | Photos / TTS |
| App Hosting bandwidth | 10 GiB / month | Next.js traffic |
| Auth | 50K MAU (email) | Officers + citizens |

Quiet months usually stay inside free quotas. Cost jumps when App Hosting bandwidth or Storage downloads spike (many media views).

---

## Earth Engine

App does **not** call EE per page load. Only manual `ee:dem` / `ee:hazards` (or admin run) spend compute. Map reads JSON caches.

| Plan | Monthly |
|------|---------|
| Noncommercial / research | $0 (quota tiers) |
| Limited (usage only) | ~$0.40 / EECU-hour |
| Basic platform | $500 / month + credits |

For Luwas-sized Cebu / Nangka cache refreshes, Limited compute stays under a few dollars if commercial. Basic is only needed if you buy that plan.

---

## What drives the bill

1. **Firebase** - dominates when App Hosting bandwidth or Storage downloads spike.
2. **Earth Engine** - only jumps if you buy Basic ($500). Keep-alive refreshes on Limited stay small.
