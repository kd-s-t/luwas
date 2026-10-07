variable "project_id" {
  type        = string
  description = "GCP project ID for Luwas"
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
