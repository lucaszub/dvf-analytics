---
globs: ["**/*"]
---

# Règle : mettre à jour le statut quand c'est terminé

Quand tu termines un module, un endpoint, ou un modèle dbt :

1. **Met à jour le tableau `## Statut` dans `CLAUDE.md` racine** — c'est l'unique source de vérité sur l'avancement.
2. **Met à jour le `CLAUDE.md` du module concerné** si les endpoints/modèles/fichiers ont changé.

## Ce qu'on NE fait PAS

- Ne pas répéter la même info dans plusieurs fichiers (pas de statut dans SPEC.md ET CLAUDE.md).
- Ne pas laisser un statut "🔄 À faire" après avoir fini.
- Ne pas recoder quelque chose déjà marqué ✅ — lire CLAUDE.md en début de session.
