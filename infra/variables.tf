variable "project_id" {
  type        = string
  description = "GCP / Firebase project ID (globally unique, e.g. luwas-drrm)"
}

variable "project_name" {
  type        = string
  description = "Human-readable project name"
  default     = "Luwas"
}

variable "create_project" {
  type        = bool
  description = "Create the GCP project (true for a fresh free account with no project yet)"
  default     = true
}

variable "billing_account" {
  type        = string
  description = "Billing account ID (optional on Spark; required for some GCP APIs / Blaze). Format: 01XXXX-XXXXXX-XXXXXX"
  default     = ""
}

variable "region" {
  type        = string
  description = "Default GCP region"
  default     = "asia-southeast1"
}

variable "firestore_location" {
  type        = string
  description = "Firestore location (nam5, eur3, or a regional location)"
  default     = "asia-southeast1"
}
