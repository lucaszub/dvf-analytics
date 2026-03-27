# Commande à lancer après terraform apply pour configurer kubectl
output "aks_get_credentials_cmd" {
  description = "Commande pour récupérer le kubeconfig AKS"
  value       = "az aks get-credentials --resource-group ${azurerm_resource_group.dvf.name} --name ${azurerm_kubernetes_cluster.dvf.name}"
}

# URL du registry Docker pour les docker push/pull
output "acr_login_server" {
  description = "URL du Container Registry (ex: acrdvfanalytics.azurecr.io)"
  value       = azurerm_container_registry.acr.login_server
}

# Commande de login ACR
output "acr_login_cmd" {
  description = "Commande pour se connecter à l'ACR"
  value       = "az acr login --name ${azurerm_container_registry.acr.name}"
}

output "acr_admin_username" {
  description = "Username admin ACR (pour docker login depuis K8s)"
  value       = azurerm_container_registry.acr.admin_username
}

output "resource_group_name" {
  value = azurerm_resource_group.dvf.name
}

output "storage_account_name" {
  value = azurerm_storage_account.dvf.name
}
