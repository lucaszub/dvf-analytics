---
paths: frontend/**
---
# Rules — React / TypeScript (frontend/)

- Use the `CommuneData` interface from `docs/SPEC.md` — no divergence
- Deck.gl coordinates order: `[longitude, latitude]` (NOT lat/lon)
- Color scale for prix_m2: blue (<2000) → teal (<3000) → amber (<4000) → red (≥4000)
- No mock data in production API calls (`api.ts` must call real FastAPI endpoints)
- ScatterplotLayer: radius = volume (nb_transactions), color = prix médian
- Reference implementation: `docs/base-code-frontend.md`
- Multi-stage Dockerfile: Vite build → nginx serve (no Node.js in runtime)
