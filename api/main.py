from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import communes, departements, kpis

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
app.include_router(departements.router)
app.include_router(kpis.router)
