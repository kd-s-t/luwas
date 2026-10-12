# Vertex AI dataset ingest flow

One-time (or batch retrain) path. Separate from live report predict.

```mermaid
flowchart LR
  A["Officer / team<br/>labeled photos"] -->|upload| B["Cloud Storage<br/>gs://…/training/{class}/"]
  B --> C["Import CSV<br/>path, label"]
  C --> D["Vertex AI Dataset<br/>image classification"]
  D --> E["Train AutoML"]
  E --> F["Deploy endpoint"]
  F --> G["Predict API<br/>used on each report"]

  H["Citizen reports<br/>officer-reviewed"] -.->|curate good/bad| A
```

## Steps

1. Collect labeled images (`flood`, `accident`, `fire`, `landslide`, `unrelated`, …)
2. Store in GCS under class folders (or any layout + CSV)
3. Import into a **Vertex image dataset** (Console or API) via CSV:
   `gs://bucket/…/img.jpg,accident`
4. **Train** AutoML image classification
5. **Deploy** model to an endpoint
6. App calls **predict** on submit (see report validation flow)

## When to ingest again

| Trigger | Action |
|---|---|
| First setup | Full dataset → train → deploy |
| Officers labeled +50–100 / class | Append to GCS + CSV → re-import → retrain → new endpoint |
| Live citizen submit | **Do not** auto-ingest; predict only |

Live path stays: `queue → Vertex predict → Gemini → verdict`.
