# GitHub Actions — Luwas

Repo: [kd-s-t/luwas](https://github.com/kd-s-t/luwas)

| Workflow | When | What |
|----------|------|------|
| **CI** | Push / PR → `main` | `npm ci` → lint → typecheck → Next.js build |
| **Deploy prod → luwasph.com** | Push → `prod` (or manual) | Cloud Run `luwas` + Firebase Hosting CDN refresh |
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

## App (Next.js) → https://luwasph.com

Production is **Cloud Run** (`luwas` / `asia-southeast1`) fronted by **Firebase Hosting** (`luwasph.com`).

Push to the **`prod`** branch (not only `main`) to ship:

1. Create a deploy SA (once):

```bash
gcloud iam service-accounts create github-deploy \
  --project=nice-pen-181017 \
  --display-name="GitHub Actions deploy"
# grant run.admin, cloudbuild.builds.editor, artifactregistry.writer,
# storage.admin, iam.serviceAccountUser, firebasehosting.admin
```

2. Download a JSON key and set GitHub Actions secrets on `kd-s-t/luwas`:

| Secret | Value |
|--------|--------|
| `GCP_SA_KEY` | SA JSON key |
| `GCP_PROJECT_ID` | `nice-pen-181017` |
| `NEXT_PUBLIC_FIREBASE_*` + `NEXT_PUBLIC_APP_URL` | same as `.env.production` (`https://luwasph.com`) |

3. Ship:

```bash
git push origin main:prod
# or: merge main → prod and push
```

See [docs/PRODUCTION.md](../../docs/PRODUCTION.md).
