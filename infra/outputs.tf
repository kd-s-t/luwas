output "project_id" {
  value       = var.project_id
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

output "next_env_hint" {
  value       = <<-EOT
    After apply, create a Firebase Web app in the console (or via Firebase CLI),
    then set in App Hosting / env:
      NEXT_PUBLIC_USE_EMULATORS=false
      NEXT_PUBLIC_FIREBASE_API_KEY=...
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
      NEXT_PUBLIC_FIREBASE_PROJECT_ID=${var.project_id}
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
      NEXT_PUBLIC_FIREBASE_APP_ID=...
  EOT
  description = "How to wire Next.js env for production"
}
