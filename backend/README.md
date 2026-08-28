# MPLAD AI Backend

MVP backend scaffold for SIH26102: AI-assisted detection of unusual finances, duplicate works, collusion patterns, and ghost-asset risks in MPLADS implementation.

This backend pass keeps the core logic explainable while adding a first real ML anomaly model. The route layer is FastAPI-ready, while the dataset pipeline can clean records, build features, train rule thresholds, train IsolationForest, and generate review/mock validation outputs before PostGIS, Neo4j, and SBERT are wired in.

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
- Dataset training pipeline with rule thresholds plus scikit-learn IsolationForest financial anomaly scoring.

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
- `GET /api/v1/analytics/summary`
- `GET /api/v1/analytics/state-risk`
- `GET /api/v1/predictions`
- `GET /api/v1/predictions/{project_key}`

## Model Analytics Endpoints

The frontend should use these endpoints for dashboards and investigation screens:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/api/v1/analytics/summary
```

Returns total projects, total allocation amount, GREEN/YELLOW/RED counts, duplicate flags, financial anomaly flags, IsolationForest anomaly flags, split-sanction flags, pending flags, and top risky states.

```powershell
Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:8000/api/v1/analytics/state-risk?limit=10"
```

Returns state-wise project counts, risk counts, allocation totals, mean risk score, and detector-specific counts.

```powershell
Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:8000/api/v1/predictions?risk_level=RED&limit=25"
```

Supports filters:

- `risk_level=GREEN|YELLOW|RED`
- `state=Uttar Pradesh`
- `category=Road`
- `mp=<partial MP name>`
- `ida=<partial agency name>`
- `isolation_forest_only=true`
- `limit=1..500`
- `offset=0..n`

```powershell
Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:8000/api/v1/predictions/{project_key}"
```

Returns one prediction with compact frontend fields plus the full raw model-output row.

## Dataset Preparation

The raw supplied datasets are first split under `data/splits`, then cleaned and normalized under `data/processed`.

Run the cleaning step from `backend/`:

```powershell
python scripts/clean_normalize_datasets.py --input-dir data/splits --output-dir data/processed
```

Generated processed files:

- `data/processed/projects_train_normalized.csv`
- `data/processed/projects_test_normalized.csv`
- `data/processed/mp_allocations_train_normalized.csv`
- `data/processed/mp_allocations_test_normalized.csv`
- `data/processed/cleaning_report.json`

Project normalization includes cleaned work descriptions, canonical MP keys, state/constituency/locality keys, ISO dates, numeric allocation amounts, exact-duplicate group counts, and data-quality flags.

Build model-ready feature columns and weak labels:

```powershell
python scripts/build_features.py --input-dir data/processed --output-dir data/features
```

Generated feature files:

- `data/features/projects_train_features.csv`
- `data/features/projects_test_features.csv`
- `data/features/feature_report.json`

See `docs/data_workflow.md` for the complete data-stage plan and `docs/frontend_analytics_plan.md` for dashboard graph recommendations.

Train/evaluate the current baseline plus IsolationForest model:

```powershell
.\.venv\Scripts\python.exe -X utf8 scripts/train_evaluate_models.py --input-dir data/features --output-dir data/model_outputs
```

Generated model output files:

- `data/model_outputs/baseline_model_metadata.json`
- `data/model_outputs/isolation_forest_model.joblib`
- `data/model_outputs/train_predictions.csv`
- `data/model_outputs/test_predictions.csv`
- `data/model_outputs/evaluation_report.json`

Create and verify controlled mock data:

```powershell
.\.venv\Scripts\python.exe -X utf8 scripts/create_mock_validation_data.py --predictions data/model_outputs/train_predictions.csv --model data/model_outputs/baseline_model_metadata.json --isolation-forest-model data/model_outputs/isolation_forest_model.joblib --output-dir data/mock
```

Create manual review samples for rule tuning:

```powershell
python scripts/create_rule_review_pack.py --predictions data/model_outputs/test_predictions.csv --output-dir data/review --sample-size 100
```

Auto-fill the review pack with AI-assisted first-pass labels:

```powershell
python scripts/auto_review_rule_pack.py --input-dir data/review --output-dir data/review/ai_reviewed
```

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
- Connect the trained IsolationForest artifact to an API scoring endpoint.
- Add Neo4j persistence and Cypher-based graph rules.
- Add field-evidence upload with EXIF and image integrity checks.
- Add JWT/RBAC and human decision endpoints.
