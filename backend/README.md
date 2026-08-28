# MPLAD AI Backend

MVP backend scaffold for SIH26102: AI-assisted detection of unusual finances, duplicate works, collusion patterns, and ghost-asset risks in MPLADS implementation.

This first backend pass intentionally keeps the core logic dependency-light and explainable. The route layer is FastAPI-ready, while the detectors run as pure Python services so they can be tested before PostGIS, Neo4j, SBERT, and IsolationForest are wired in.

## What Is Implemented

- Project ingestion contracts with Pydantic.
- In-memory repository with idempotent `external_work_id` handling.
- Deterministic preprocessing for text normalization and required-field policy checks.
- Duplicate detection using geospatial radius first, then text similarity.
- Financial risk checks using BSR ratio and split-sanction detection.
- Basic graph-style concentration risk for repeat awards and single-bid patterns.
- Composite risk scoring using the documented weights: duplicate 40%, cost 40%, graph 20%.
- Audit events for mutations.
- FastAPI endpoints for health, project create/list/detail, preprocess, evaluate, audit, and demo seed.
- Unit tests for the core risk logic.

## Intended Tech Stack

The documents point to this backend stack:

- FastAPI + Pydantic for the API and contracts.
- PostgreSQL + PostGIS as the canonical project store and geospatial search layer.
- Neo4j for vendor/agency relationship analytics.
- sentence-transformers/all-MiniLM-L6-v2 for semantic duplicate detection.
- scikit-learn IsolationForest plus BSR rules for financial anomaly detection.
- OpenCV + ExifRead for field-photo verification.
- Redis/Celery, MinIO/S3, and Express RBAC edge as follow-on integration pieces.

## Local Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\uvicorn app.main:app --reload
```

OpenAPI will be available at:

```text
http://127.0.0.1:8000/docs
```

## Core Endpoints

- `GET /health`
- `POST /api/v1/demo/seed`
- `POST /api/v1/projects`
- `GET /api/v1/projects`
- `GET /api/v1/projects/{project_id}`
- `POST /api/v1/projects/{project_id}/preprocess`
- `POST /api/v1/projects/{project_id}/evaluate`
- `GET /api/v1/projects/{project_id}/audit`

## Requirements Needed From Your Side

- Sample MPLADS project records, preferably 50+ rows.
- Historical project title, description, latitude, longitude, district, agency, contractor, cost, and award date fields.
- BSR/rate table for common work items by district/region and version.
- Contractor and agency metadata needed for graph checks: legal names, director names, masked PAN/GSTIN/bank identifiers if available.
- Rules for official risk action labels, role permissions, and who can approve/suspend/request audit.
- Any available e-SAKSHI, PFMS, or public dataset access details; if unavailable, we will keep mock adapters.
- Example geotagged field photos for validating EXIF/GPS workflows.

## Next Backend Steps

- Replace in-memory storage with PostgreSQL/PostGIS models and migrations.
- Replace the token-similarity placeholder with SBERT embeddings.
- Add IsolationForest once enough historical cost data is available.
- Add Neo4j persistence and Cypher-based graph rules.
- Add field-evidence upload with EXIF and image integrity checks.
- Add JWT/RBAC and human decision endpoints.
