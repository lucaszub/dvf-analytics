variable "location" {
  description = "Région Azure"
  type        = string
  default     = "francecentral"
}

variable "resource_group_name" {
  description = "Nom du resource group principal"
  type        = string
  default     = "rg-dvf-analytics"
}

variable "aks_name" {
  description = "Nom du cluster AKS"
  type        = string
  default     = "aks-dvf-analytics"
}

variable "acr_name" {
  description = "Nom du Container Registry (doit être globalement unique sur Azure, sans tirets)"
  type        = string
  # À surcharger dans terraform.tfvars avec un nom unique
  default = "acrdvfanalytics"
}

variable "storage_account_name" {
  description = "Nom du Storage Account (doit être globalement unique, 3-24 chars, minuscules)"
  type        = string
  # À surcharger dans terraform.tfvars avec un nom unique
  default = "stdvfanalytics"
}
