terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }

  required_version = ">= 1.1.0"
}

provider "azurerm" {
  features {}
}

data "azurerm_client_config" "current" {}

# ── Resource Group ────────────────────────────────────────────────────────────

resource "azurerm_resource_group" "dvf" {
  name     = var.resource_group_name
  location = var.location

  tags = {
    project = "dvf-analytics"
  }
}

# ── Container Registry ────────────────────────────────────────────────────────
# Stocke les images Docker : api, frontend, ingest

resource "azurerm_container_registry" "acr" {
  name                = var.acr_name
  resource_group_name = azurerm_resource_group.dvf.name
  location            = azurerm_resource_group.dvf.location
  sku                 = "Basic"
  admin_enabled       = true # permet docker login sans role assignment Owner
}

# ── Blob Storage ──────────────────────────────────────────────────────────────
# Stocke les CSV DVF bruts (~2 Go compressé pour la France entière)

resource "azurerm_storage_account" "dvf" {
  name                     = var.storage_account_name
  resource_group_name      = azurerm_resource_group.dvf.name
  location                 = azurerm_resource_group.dvf.location
  account_tier             = "Standard"
  account_replication_type = "LRS"

  tags = {
    project = "dvf-analytics"
  }
}

resource "azurerm_storage_container" "raw" {
  name                  = "dvf-raw"
  storage_account_name  = azurerm_storage_account.dvf.name
  container_access_type = "private"
}

# ── AKS Cluster ───────────────────────────────────────────────────────────────
# 1 node Standard_B2ms (2 vCPU, 8 Go RAM) — burstable, ~61 €/mois
# Tous les workloads sur ce node : ClickHouse, API, frontend, jobs ingest/dbt

resource "azurerm_kubernetes_cluster" "dvf" {
  name                = var.aks_name
  location            = azurerm_resource_group.dvf.location
  resource_group_name = azurerm_resource_group.dvf.name
  dns_prefix          = "dvf"

  default_node_pool {
    name       = "default"
    node_count = 1
    vm_size    = "Standard_B2ms"

    os_disk_size_gb = 30
  }

  # Managed Identity : pas de service principal à gérer manuellement
  identity {
    type = "SystemAssigned"
  }

  tags = {
    project = "dvf-analytics"
  }
}

# Note : AcrPull role assignment supprimé — nécessite le rôle Owner sur la subscription.
# À la place : admin_enabled = true sur l'ACR, login via az acr login --name <acr>
