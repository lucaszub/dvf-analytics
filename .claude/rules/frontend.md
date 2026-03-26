# Rules — frontend/

- Coordonnées Deck.gl : `[longitude, latitude]` — toujours longitude en premier
- Scale couleur : <2000→bleu [59,130,246], <3000→teal [20,184,166], <4000→amber [245,158,11], ≥4000→rouge [239,68,68]
- Interfaces TypeScript = shapes exactes de `docs/SPEC.md` — noms de champs identiques
- Pas de mock data dans les appels API production — `mockData.ts` = dev isolé uniquement
- `BASE_URL = ''` dans `api.ts` — URLs relatives uniquement
