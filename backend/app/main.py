from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.analytics import router as analytics_router
from app.api.v1.projects import router as project_router
from app.core.config import settings


app = FastAPI(
    title="MPLAD AI Backend",
    description="Explainable MVP backend for MPLADS anomaly, fraud, duplicate, and inefficiency detection.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8443",
        "http://127.0.0.1:8443",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "environment": settings.app_env,
        "policy_version": settings.scoring_policy_version,
    }


app.include_router(project_router)
app.include_router(analytics_router)
