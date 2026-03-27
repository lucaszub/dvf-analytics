from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import communes, code_postaux, departements, kpis, h3_cells
from routers.mutations import router as mutations_router
from routers.sections import router as sections_router
from routers.parcelles import router as parcelles_router

app = FastAPI(
    title="DVF Analytics API",
    description="Prix immobiliers DVF — Bretagne 2018-2024",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(communes.router)
app.include_router(code_postaux.router)
app.include_router(departements.router)
app.include_router(kpis.router)
app.include_router(h3_cells.router)
app.include_router(mutations_router)
app.include_router(sections_router)
app.include_router(parcelles_router)
