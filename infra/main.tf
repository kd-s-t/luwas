# Production blueprint — see docs/PRODUCTION.md
# Creates (or attaches to) a GCP project, enables APIs, adds Firebase, creates Firestore.

locals {
  apis = [
    "firebase.googleapis.com",
    "firestore.googleapis.com",
    "identitytoolkit.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "serviceusage.googleapis.com",
    "firebasehosting.googleapis.com",
  ]

  effective_project_id = var.create_project ? google_project.luwas[0].project_id : var.project_id
}

resource "google_project" "luwas" {
  count = var.create_project ? 1 : 0

  name            = var.project_name
  project_id      = var.project_id
  billing_account = var.billing_account != "" ? var.billing_account : null

  labels = {
    app     = "luwas"
    managed = "terraform"
  }
}

resource "google_project_service" "required" {
  for_each = toset(local.apis)

  project            = local.effective_project_id
  service            = each.value
  disable_on_destroy = false

  depends_on = [google_project.luwas]
}

resource "google_firebase_project" "default" {
  provider = google-beta
  project  = local.effective_project_id

  depends_on = [google_project_service.required]
}

resource "google_firestore_database" "default" {
  project     = local.effective_project_id
  name        = "(default)"
  location_id = var.firestore_location
  type        = "FIRESTORE_NATIVE"

  depends_on = [
    google_project_service.required,
    google_firebase_project.default,
  ]
}

# Web app config for Next.js NEXT_PUBLIC_FIREBASE_* env vars
resource "google_firebase_web_app" "luwas" {
  provider     = google-beta
  project      = local.effective_project_id
  display_name = var.project_name

  depends_on = [google_firebase_project.default]
}

data "google_firebase_web_app_config" "luwas" {
  provider   = google-beta
  project    = local.effective_project_id
  web_app_id = google_firebase_web_app.luwas.app_id
}
