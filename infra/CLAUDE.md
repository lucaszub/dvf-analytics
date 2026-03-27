# infra/ — Terraform + AKS

IaC pour déployer DVF Analytics sur Azure.
Contexte global : voir [CLAUDE.md racine](../CLAUDE.md) · Archi détaillée : [ARCHITECTURE.md](./ARCHITECTURE.md)

## Stack retenue

| Outil | Rôle |
|-------|------|
| Terraform | Provisionner AKS, ACR, Blob Storage |
| AKS | 1 node pool, 2× Standard_D2s_v3 |
| K8s manifests | Déployer les workloads (à venir) |

## Fichiers

| Fichier | Rôle |
|---------|------|
| `main.tf` | Ressources Azure |
| `variables.tf` | Déclaration des variables |
| `outputs.tf` | Valeurs exportées (kube_config, acr url...) |
| `terraform.tfvars` | Valeurs concrètes — **ne pas committer** |
| `.terraform.lock.hcl` | Lockfile providers — **à committer** |
| `ARCHITECTURE.md` | Explication des choix d'archi |

## Commandes essentielles

```bash
# Initialiser (télécharge le provider azurerm)
terraform init

# Voir ce qui va être créé/modifié sans toucher à rien
terraform plan

# Appliquer
terraform apply

# Tout supprimer (coût = 0 après)
terraform destroy

# Valider la syntaxe HCL
terraform validate

# Formatter le code
terraform fmt

# Voir l'état courant de l'infra
terraform show

# Récupérer le kubeconfig AKS après apply
az aks get-credentials --resource-group rg-dvf-analytics --name aks-dvf-analytics
```

## Règles

- `terraform.tfvars` et `*.tfstate` ne sont jamais commités (voir `.gitignore` racine)
- Pas de secrets hardcodés dans les `.tf` — variables uniquement
- `terraform fmt` avant chaque commit
- Toujours faire `terraform plan` avant `terraform apply`

## Statut

| Composant | Statut |
|-----------|--------|
| Provider azurerm + resource group | ✅ Tuto init done |
| AKS + ACR + Blob Storage | ❌ À faire |
| K8s manifests (StatefulSet CH, Deployments) | ❌ À faire |
| CI/CD GitLab | ❌ À faire |
