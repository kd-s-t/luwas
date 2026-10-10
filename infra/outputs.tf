output "project_id" {
  value       = local.effective_project_id
  description = "GCP / Firebase project ID — set NEXT_PUBLIC_FIREBASE_PROJECT_ID"
}

output "firestore_name" {
  value       = google_firestore_database.default.name
  description = "Firestore database name"
}

output "firebase_project_number" {
  value       = try(google_firebase_project.default.project_number, null)
  description = "Firebase project number when available"
}

output "firebase_web_app_id" {
  value       = google_firebase_web_app.luwas.app_id
  description = "Firebase web app id"
}

output "firebase_web_config" {
  value = {
    apiKey            = data.google_firebase_web_app_config.luwas.api_key
    authDomain        = data.google_firebase_web_app_config.luwas.auth_domain
    projectId         = local.effective_project_id
    storageBucket     = data.google_firebase_web_app_config.luwas.storage_bucket
    messagingSenderId = data.google_firebase_web_app_config.luwas.messaging_sender_id
    appId             = google_firebase_web_app.luwas.app_id
  }
  description = "Firebase web config for Next.js env"
  sensitive   = true
}

output "next_env_hint" {
  value = <<-EOT
    Set in App Hosting / .env.production:
      NEXT_PUBLIC_USE_EMULATORS=false
      NEXT_PUBLIC_FIREBASE_API_KEY=${data.google_firebase_web_app_config.luwas.api_key}
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${data.google_firebase_web_app_config.luwas.auth_domain}
      NEXT_PUBLIC_FIREBASE_PROJECT_ID=${local.effective_project_id}
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${data.google_firebase_web_app_config.luwas.storage_bucket}
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${data.google_firebase_web_app_config.luwas.messaging_sender_id}
      NEXT_PUBLIC_FIREBASE_APP_ID=${google_firebase_web_app.luwas.app_id}
  EOT
  description = "How to wire Next.js env for production"
  sensitive   = true
}
