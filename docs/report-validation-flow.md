# Citizen report validation flow

Vertex sits **after the queue, before Gemini**. It scores what is in the photo. Gemini combines that with text, GPS/place, and trust to decide the verdict.

```mermaid
flowchart LR
  U["Citizen<br/>guest or registered"] -->|report incident| DB[(Firestore)]
  DB -->|queue| V["Vertex AI<br/>vision: class + confidence"]
  V -->|image signal| G["Google Gemini<br/>Next.js API"]
  G -->|Validated / legit| T["Twilio<br/>SMS + voice"]
  T --> R["Nearest police / hospital / fire"]
  G -->|Rejected| H["Human review"]
  G -->|needs_review| H
```

| Step | Who | Job |
|---|---|---|
| 1 | Citizen | Photo + GPS + place text |
| 2 | Firestore | Save report, status `queued` |
| 3 | **Vertex AI** | Image only: flood / accident / unrelated / … |
| 4 | **Gemini** | Match claim + location + trust → legit / rejected / needs_review |
| 5a | Twilio | Alerts / calls when validated (officer-triggered) |
| 5b | Officer | Human review when rejected or unsure |

Do **not** call Vertex for location. Location is GPS + place text (and Maps if needed). Vertex is vision only.
