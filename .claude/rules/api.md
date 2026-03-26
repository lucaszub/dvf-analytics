# Rules — api/

- Requêtes ClickHouse paramétrées uniquement — jamais `f"SELECT ... {user_input}"`
- CORS : `allow_origins=["http://localhost:5173"]` — aucune autre origine
- Tous les paramètres query typés : `Annotated[int, Query(ge=0)]`, `Annotated[str, Path()]`, etc.
- Credentials depuis env vars — jamais hardcodés dans le code
- Shapes de réponse = interfaces TypeScript dans `docs/SPEC.md` (noms de champs identiques)
- Injection via `ClientDep` de `db.py` — pas d'instanciation directe du client dans les routers
