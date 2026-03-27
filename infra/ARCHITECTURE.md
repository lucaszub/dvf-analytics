# Infrastructure DVF Analytics — Architecture Cloud

## C'est quoi AKS exactement ?

AKS = **Azure Kubernetes Service**. Pour comprendre, il faut remonter d'un cran.

### Sans AKS : le monde "VM classique"

Tu loues une VM Azure (une machine virtuelle). Tu te connectes en SSH, tu installes
Docker, tu lances tes containers. C'est simple, mais :

- Si la VM plante → tout est mort, tu dois relancer à la main
- Si tu veux scaler → tu dois créer une 2e VM, installer Docker, copier ta config...
- Les mises à jour de l'OS, les patches sécu → tu gères toi-même
- Redémarrer un container crashé → tu écris un script systemd ou cron

### Avec Kubernetes (K8s) : l'orchestrateur

Kubernetes est un logiciel qui tourne sur un groupe de VMs et qui gère les containers
à ta place. Tu lui dis "je veux 2 instances de mon API qui tournent" et il :

- Choisit sur quelle VM les démarrer
- Les redémarre automatiquement si elles crashent
- Répartit le trafic entre les 2 instances
- En lance une 3e si le CPU monte trop (HPA)

Le problème : installer et maintenir Kubernetes soi-même est **très complexe**
(etcd, control plane, certificates...). C'est un métier à part entière.

### AKS = Kubernetes managé par Azure

Azure installe et maintient Kubernetes pour toi. Tu paies uniquement les VMs
(les nodes). Le control plane K8s est gratuit et géré par Azure.

```
Ce que TU gères          Ce qu'AZURE gère
─────────────────        ─────────────────────────────────
Tes containers           Le control plane Kubernetes
La config K8s (YAML)     Les mises à jour de K8s
Les VMs (nodes)          La haute dispo du cluster
                         Les certificats TLS internes
```

Résultat : tu bénéficies de toute la puissance de K8s sans en gérer l'infra.

---

## Terraform vs Ansible — lequel choisir ?

### Ce que fait chaque outil

```
Terraform                        Ansible
─────────────────────────────    ──────────────────────────────
"Crée une VM Azure"              "Installe nginx sur cette VM"
"Crée un réseau"                 "Copie ce fichier de config"
"Crée un cluster K8s"            "Lance ce service systemd"
"Crée un bucket S3"              "Mets à jour ces packages"

→ Provisionner de l'infra        → Configurer des serveurs existants
→ Ressources cloud (API Azure)   → Contenu des machines (SSH)
→ Déclaratif : "état désiré"     → Impératif : "fais ces étapes"
```

### La règle d'or

> **Terraform crée les machines. Ansible configure ce qu'il y a dedans.**

### Pourquoi Ansible est moins pertinent ici

Avec AKS, on ne configure jamais les VMs à la main — K8s s'en charge.
Ansible aurait du sens si on faisait des VMs classiques + Docker Compose.

| Outil | Rôle dans DVF | Pertinence |
|-------|---------------|------------|
| Terraform | Créer AKS, Blob, ACR | ✅ Indispensable |
| Ansible | Configurer les nodes AKS | ❌ K8s le fait à ta place |

---

## Pourquoi passer de Docker Compose à AKS ?

Docker Compose fonctionne très bien en local pour Bretagne (~500k transactions).
Pour toute la France (~7M transactions, fichier DVF ~2 Go), on a besoin :

- **Plus de RAM/CPU** pour ClickHouse — impossible à faire tourner sur un laptop
- **Stockage objet** pour les fichiers CSV bruts (Blob Storage)
- **Orchestration des jobs** : ingest + dbt ne tournent pas H24, juste à la demande

---

## Architecture retenue (équilibre apprentissage / complexité)

```
Terraform
├── AKS — 1 node pool, 1× Standard_B2ms (2 vCPU, 8 Go RAM)
├── Container Registry (ACR)
└── Blob Storage (CSV DVF bruts)
```

**1 seul node, 1 seul node pool.** Tous les workloads cohabitent sur la même VM.
Pas de HA — si le node tombe, tout est down le temps que K8s le redémarre (~2 min).
Acceptable pour un projet perso sans SLA.

**Pourquoi Standard_B2ms plutôt que D2s_v3 ?** Même RAM (8 Go), ~15 % moins cher.
VM "burstable" : accumule des crédits CPU au repos, les dépense lors des pics
(ingest, GROUP BY ClickHouse). Parfait pour une charge ponctuelles.

### Hiérarchie des ressources

```
Azure Subscription
└── Resource Group  rg-dvf-analytics
    │
    ├── AKS Cluster  aks-dvf-analytics
    │   └── Node Pool (1× Standard_B2ms — 2 vCPU, 8 Go RAM)
    │       ├── StatefulSet : clickhouse-0
    │       │   └── PersistentVolumeClaim → Azure Managed Disk (50 Go)
    │       ├── Deployment : api (FastAPI)
    │       ├── Deployment : frontend (React)
    │       ├── Job : ingest (déclenché manuellement ou par CI)
    │       └── Job : dbt (enchaîné après ingest)
    │
    ├── Managed Disk  50 Go Premium SSD
    │   └── monté dans clickhouse-0 via PVC
    │
    ├── Container Registry  acr-dvf-analytics
    │   └── Images : api:v1.0, frontend:v1.0, ingest:v1.0
    │
    └── Storage Account  st-dvf-analytics
        └── Container Blob  dvf-raw/
            └── dvf-france-2024.csv.gz
```

**Ce qu'on enlève par rapport à une archi prod** : node pools séparés,
node pool Spot, Key Vault, nodeSelector, HPA. Ce sont des optimisations
pertinentes en prod mais qui n'apportent rien à l'apprentissage ici.

---

## ClickHouse sur Kubernetes — le cas particulier

ClickHouse n'est pas un service managé Azure. Il tourne comme un pod K8s,
avec une contrainte : **les données doivent survivre aux redémarrages du pod**.

### StatefulSet vs Deployment

Les pods classiques (`Deployment`) sont stateless : si K8s en recrée un sur
un autre node, pas de problème. Une base de données ne peut pas faire ça —
les données doivent suivre le pod.

On utilise un `StatefulSet` + un `PersistentVolumeClaim` :

```
StatefulSet clickhouse
└── Pod clickhouse-0  (nom stable, toujours le même)
    └── PersistentVolumeClaim
        └── Azure Managed Disk (50 Go, Premium SSD)
            └── /var/lib/clickhouse  ← données persistées ici
```

Le Managed Disk est une ressource Azure indépendante du pod. Si le pod est
détruit et recréé, le disque est re-attaché automatiquement.

### Comment dbt et l'API atteignent ClickHouse

K8s crée un DNS interne pour chaque Service. ClickHouse est accessible depuis
n'importe quel pod du cluster à cette adresse :

```
clickhouse-service.default.svc.cluster.local:8123
```

dbt et l'API envoient leur SQL à cette adresse — le compute se passe
entièrement dans ClickHouse, pas dans le pod appelant.

```
Job dbt           →  SELECT ... GROUP BY ...  →  ClickHouse (agrège 7M lignes)
                  ←  96 communes × 5 colonnes  ←

Pod API           →  SELECT * WHERE commune=...  →  ClickHouse (filtre)
                  ←  JSON 20 lignes              ←
```

Réseau interne au cluster → latence en millisecondes.

### Sizing pour la France entière

| Métrique | Valeur |
|----------|--------|
| Transactions DVF France | ~7M lignes |
| Taille sur disque | ~3-5 Go (compression ClickHouse ~5:1) |
| RAM pour les agrégations Gold | 4-6 Go |
| VM choisie | Standard_D2s_v3 (2 vCPU, 8 Go) |

---

## Pourquoi Blob Storage pour les CSV bruts ?

- Les CSV DVF sont publiés 1x/an par data.gouv.fr, ~2 Go compressé
- Coût : ~0,02 €/Go/mois
- L'ingest Job télécharge depuis Blob → charge dans ClickHouse → terminé
- Le stockage brut est découplé du compute

---

## Flux de déploiement

```
1. terraform apply
       └── crée AKS + ACR + Blob Storage

2. CI/CD (GitLab CI)
       ├── docker build + docker push → ACR
       └── kubectl apply → déploie sur AKS

3. Ingest (Job K8s déclenché manuellement ou par CI)
       ├── télécharge CSV depuis Blob
       ├── charge dans ClickHouse (bronze)
       └── déclenche le Job dbt (silver + gold)

4. API + Frontend tournent en permanence
```

---

## Structure des fichiers Terraform

```
infra/
├── main.tf           # AKS, ACR, Blob Storage
├── variables.tf      # noms, tailles, région
├── outputs.tf        # kube_config, acr_login_server...
├── terraform.tfvars  # valeurs concrètes — NE PAS COMMITTER
└── .terraform.lock.hcl  # lockfile versions providers — à committer
```

### Remote state (étape suivante)

Par défaut le tfstate est local. Pour travailler depuis plusieurs machines,
le stocker dans Blob Storage :

```hcl
# backend.tf
terraform {
  backend "azurerm" {
    resource_group_name  = "rg-terraform-state"
    storage_account_name = "sttfstatedvf"
    container_name       = "tfstate"
    key                  = "dvf-analytics.tfstate"
  }
}
```

---

## Coût estimé

| Ressource | Config | €/mois |
|-----------|--------|--------|
| Node pool | 1× Standard_B2ms | ~61 € |
| Managed Disk ClickHouse | 50 Go Premium SSD | ~5 € |
| Container Registry | SKU Basic | ~5 € |
| Blob Storage | 10 Go LRS | < 1 € |
| **Total** | | **~72 €/mois** |

> Avec `terraform destroy` quand tu ne travailles pas : ~0 €.
> Azure propose 200 € de crédits gratuits à l'inscription → ~2,5 mois H24 gratuits.

---

## Ce que ce projet démontre (angle recruteur)

- **IaC reproductible** : un `terraform apply` recrée tout l'environnement
- **Stateful workload sur K8s** : StatefulSet + PVC + Managed Disk
- **Pipeline de données cloud** : ingest → dbt → API, orchestré sur K8s
- **Séparation compute/stockage** : Blob pour les bruts, Disk pour la DB
