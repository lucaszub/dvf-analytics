# Kubernetes — Guide DVF

Référence archi : [../ARCHITECTURE.md](../ARCHITECTURE.md)
Commandes : [../CLAUDE.md](../CLAUDE.md)

---

## C'est quoi un manifest K8s ?

En Docker Compose tu écris ce que tu veux lancer.
En Kubernetes tu écris ce que tu veux que **l'état du cluster soit**.

```yaml
# Docker Compose — "lance ce container"
services:
  api:
    image: mon-api
    ports: ["8000:8000"]

# Kubernetes — "je veux qu'il y ait toujours 1 pod api qui tourne"
kind: Deployment
spec:
  replicas: 1
  template:
    spec:
      containers:
        - image: mon-api
```

K8s lit ton manifest, compare avec l'état actuel, et fait le nécessaire pour
atteindre l'état désiré. Si le pod crashe, K8s en recrée un automatiquement.

---

## Les objets K8s utilisés dans ce projet

### Namespace

Espace de nommage qui isole les ressources. Tous nos objets sont dans `dvf`.

```
Sans namespace : tous les projets du cluster se mélangent
Avec namespace : kubectl get pods -n dvf ne montre que DVF
```

### Deployment

Pour les workloads **stateless** (sans données à conserver) : API, frontend.

```
Deployment api
└── ReplicaSet (géré automatiquement)
    └── Pod api-7d9f8b-xyz   ← nom aléatoire, recréé si mort
        └── Container api
```

Si le pod meurt → K8s en recrée un avec un nouveau nom. Pas de problème
car l'API ne stocke rien localement.

### StatefulSet

Pour les workloads **stateful** : ClickHouse.

```
StatefulSet clickhouse
└── Pod clickhouse-0   ← nom STABLE, toujours clickhouse-0
    └── Container clickhouse
        └── Volume /var/lib/clickhouse → PVC → Managed Disk Azure
```

Différence clé avec Deployment :
- Nom du pod fixe (`clickhouse-0`, pas `clickhouse-7d9f8b-xyz`)
- Volume attaché au pod par nom — si le pod est recréé, il retrouve ses données

### PersistentVolumeClaim (PVC)

Demande de stockage. K8s appelle l'API Azure pour créer un Managed Disk
et le monter dans le pod.

```
PVC clickhouse-data (50 Go, managed-premium)
  → Azure crée un Managed Disk Premium SSD
    → monté dans clickhouse-0 à /var/lib/clickhouse
```

Le disque existe indépendamment du pod. Pod détruit → disque intact.
`terraform destroy` → disque détruit avec le reste.

### Service

Adresse réseau stable pour atteindre un pod. Les pods ont des IPs éphémères
(changent à chaque recréation). Le Service a une IP fixe.

```
                    ClusterIP (interne uniquement)
Pod api        →    Service clickhouse :8123   →   Pod clickhouse-0
Pod ingest     →         (IP stable)
Pod dbt        →

Internet       →    Service api (LoadBalancer)  →   Pod api
                         (IP publique Azure)
```

Deux types utilisés ici :

| Type | Accessible depuis | Cas d'usage |
|------|------------------|-------------|
| `ClusterIP` | Pods du cluster uniquement | ClickHouse (pas besoin d'être public) |
| `LoadBalancer` | Internet | API, Frontend |

### Job

Pod qui tourne **une fois** jusqu'à complétion, puis s'arrête.
Différent d'un Deployment qui tourne en permanence.

```
Job ingest
└── Pod ingest-xxxxx
    ├── Init container : attend que ClickHouse réponde sur :8123
    └── Container ingest : charge les CSV → ClickHouse
        └── Terminé → pod passe en "Completed", plus de facturation CPU
```

`ttlSecondsAfterFinished: 3600` → K8s supprime automatiquement le pod
1h après complétion (évite l'accumulation de pods terminés).

### ConfigMap

Fichier de config injecté dans un pod. Utilisé ici pour la config
utilisateur ClickHouse (`default-user.xml`).

```
ConfigMap clickhouse-users
└── default-user.xml  → monté dans /etc/clickhouse-server/users.d/
```

Alternative aux variables d'environnement pour les configs complexes (XML, YAML...).

---

## DNS interne K8s

Chaque Service crée une entrée DNS automatique :

```
<service>.<namespace>.svc.cluster.local
```

Dans notre cas :
```
clickhouse.dvf.svc.cluster.local:8123
```

Mais K8s résout aussi le nom court depuis le même namespace :
```
CLICKHOUSE_HOST=clickhouse  ← suffit pour api, ingest, dbt dans le namespace dvf
```

C'est pourquoi les variables d'env dans les manifests font juste `value: "clickhouse"`.

---

## Ordre de démarrage

K8s ne garantit pas l'ordre de démarrage des pods — tout démarre en parallèle.
Les Jobs ingest et dbt ont un **init container** qui bloque jusqu'à ce que
ClickHouse réponde :

```
kubectl apply -f k8s/
        │
        ├── clickhouse-0 démarre (prend ~30s)
        ├── api démarre (attend readinessProbe /health)
        ├── frontend démarre
        └── jobs ingest/dbt : init container boucle sur /ping ClickHouse
                              └── dès que ClickHouse répond → container principal démarre
```

---

## Ressources (requests / limits)

Chaque container déclare ses besoins en RAM/CPU :

```yaml
resources:
  requests:    # K8s garantit ces ressources au pod
    memory: "1Gi"
    cpu: "250m"
  limits:      # K8s tue le pod s'il dépasse ces valeurs
    memory: "6Gi"
    cpu: "1500m"
```

`250m` CPU = 0.25 cœur. `6Gi` = 6 gigaoctets.

Répartition sur notre node de 8 Go :

| Pod | RAM request | RAM limit |
|-----|------------|-----------|
| clickhouse | 1 Go | 6 Go |
| api | 128 Mo | 512 Mo |
| frontend | 64 Mo | 256 Mo |
| job ingest/dbt | 256 Mo | 1 Go |

Au repos : ~1,5 Go utilisés. Pic ingest+ClickHouse : ~7 Go. Ça tient sur 8 Go.

---

## Appliquer les manifests

```bash
# 1. Récupérer le kubeconfig
az aks get-credentials --resource-group rg-dvf-analytics --name aks-dvf-analytics

# 2. Déployer tout (ordre : K8s s'en charge)
kubectl apply -f infra/k8s/

# 3. Vérifier
kubectl get all -n dvf
```

Résultat attendu :
```
NAME                READY   STATUS
pod/clickhouse-0    1/1     Running
pod/api-xxx         1/1     Running
pod/frontend-xxx    1/1     Running

NAME                TYPE           EXTERNAL-IP
service/clickhouse  ClusterIP      <none>
service/api         LoadBalancer   20.x.x.x    ← IP publique Azure
service/frontend    LoadBalancer   20.x.x.x    ← IP publique Azure
```
