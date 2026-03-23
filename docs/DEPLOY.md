# Plan de déploiement — VPS Hostinger + Ansible

## Stack cible

```
VPS Hostinger 4GB
├── Nginx (reverse proxy + SSL Let's Encrypt)
├── ClickHouse (Docker)
├── FastAPI (Docker)
└── Frontend (statique servi par Nginx)

CI/CD : GitHub Actions → Ansible → VPS
```

---

## Structure Ansible à créer

```
ansible/
├── inventory.ini          # IP du VPS + user
├── ansible.cfg
├── playbooks/
│   ├── setup.yml          # provisioning initial (une seule fois)
│   └── deploy.yml         # déploiement continu (CI/CD)
└── roles/
    ├── common/            # updates, user, SSH hardening
    ├── docker/            # install Docker + Compose
    ├── nginx/             # reverse proxy + SSL
    ├── clickhouse/        # config ClickHouse
    ├── fastapi/           # déploiement image FastAPI
    └── frontend/          # build statique + copie dans Nginx
```

---

## Phases

### Phase 1 — Setup initial (une fois)
- [ ] Créer un user non-root avec sudo
- [ ] Désactiver login root SSH
- [ ] Désactiver auth par mot de passe (SSH keys only)
- [ ] Installer Docker + Docker Compose
- [ ] Installer Nginx
- [ ] Configurer UFW : ouvrir 80, 443, 22 seulement
- [ ] SSL Let's Encrypt via Certbot (auto-renew)

### Phase 2 — Déploiement app
- [ ] Copier `docker-compose.prod.yml` sur le VPS
- [ ] Injecter les secrets via Ansible Vault (`.env` prod)
- [ ] `docker compose up -d`
- [ ] Configurer Nginx comme reverse proxy vers FastAPI (:8000)
- [ ] Servir le frontend statique depuis `/var/www/dvf`

### Phase 3 — CI/CD GitHub Actions
- [ ] Job build : `docker build` + push vers GitHub Container Registry (ghcr.io)
- [ ] Job deploy : `ansible-playbook deploy.yml` depuis Actions
- [ ] Stocker la clé SSH privée dans GitHub Secrets

---

## Sécurité — checklist

### Système
- [ ] SSH port non-standard (ex: 2222) — ou fail2ban sur port 22
- [ ] fail2ban installé et configuré
- [ ] `unattended-upgrades` pour les patches de sécurité automatiques
- [ ] User dédié `deploy` avec droits limités (pas de sudo full)

### ClickHouse
- [ ] Pas exposé publiquement (bind sur 127.0.0.1 uniquement)
- [ ] Mot de passe fort sur le user par défaut
- [ ] User dédié en lecture seule pour FastAPI
- [ ] Accès uniquement depuis le réseau Docker interne

### FastAPI
- [ ] Variables d'env via Ansible Vault (jamais en clair dans le repo)
- [ ] CORS restreint au domaine frontend uniquement
- [ ] Rate limiting Nginx (ex: 10 req/s par IP)
- [ ] HTTPS only, redirection HTTP → HTTPS

### Nginx
- [ ] Headers sécurité : `X-Frame-Options`, `X-Content-Type-Options`, `HSTS`
- [ ] SSL : TLS 1.2+ uniquement, ciphers modernes
- [ ] Pas de server tokens (`server_tokens off`)

### Secrets
- [ ] Tous les secrets dans **Ansible Vault** (jamais committé en clair)
- [ ] Clé SSH deploy dans GitHub Secrets (jamais dans le repo)
- [ ] `.env.prod` dans `.gitignore`

---

## Commandes clés

```bash
# Setup initial (une seule fois)
ansible-playbook -i inventory.ini playbooks/setup.yml --ask-vault-pass

# Déploiement
ansible-playbook -i inventory.ini playbooks/deploy.yml --ask-vault-pass

# Chiffrer un secret
ansible-vault encrypt_string 'mon_secret' --name 'db_password'

# Vérifier la config Nginx
ansible -i inventory.ini all -m command -a "nginx -t"
```

---

## À faire avant de commencer

1. Avoir un domaine pointant sur l'IP du VPS
2. Générer une paire de clés SSH dédiée deploy
3. Créer un fichier `ansible/vault.yml` avec les secrets (chiffré)
4. Créer `docker-compose.prod.yml` (version sans volumes de dev, avec restart policies)
