# Production blueprint — do not apply for local emulator development.
# See docs/PRODUCTION.md

locals {
  apis = [
    "firebase.googleapis.com",
    "firestore.googleapis.com",
    "identitytoolkit.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "serviceusage.googleapis.com",
  ]
}

resource "google_project_service" "required" {
  for_each = toset(local.apis)

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_firebase_project" "default" {
  provider = google-beta
  project  = var.project_id

  depends_on = [google_project_service.required]
}

resource "google_firestore_database" "default" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.firestore_location
  type        = "FIRESTORE_NATIVE"

  depends_on = [
    google_project_service.required,
    google_firebase_project.default,
  ]
}
