# ML Model And Backend Logic Report

Project: MPLADS anomaly and fraud detection prototype  
Backend: FastAPI + pandas + scikit-learn  
Current report date: 2026-08-29

## 1. Purpose Of The System

The backend is designed as an explainable AI-assisted risk detection system for MPLADS project records. Its current goal is not to legally prove fraud. Its goal is to identify projects that deserve review because they show unusual financial, duplicate-work, split-sanction, or administrative-risk patterns.

The implemented system supports two main flows:

1. Offline dataset pipeline:
   - split supplied datasets into train/test sets
   - clean and normalize MPLADS records
   - create model-ready features
   - train/scoring baseline models
   - export predictions and dashboard-ready files

2. Live JSON evaluation:
   - accept one proposed project as JSON
   - compare it against trained/mock reference records
   - return flag, rating, component scores, explanation, and reference records

## 2. Current Backend Architecture

The backend is implemented under `backend/app` and the data/model pipeline is implemented under `backend/scripts`.

Main backend modules:

- `app/main.py`
  - creates the FastAPI app
  - enables CORS for frontend dev servers
  - exposes `/health`
  - includes project and analytics routers

- `app/api/v1/analytics.py`
  - exposes dashboard analytics and model prediction endpoints
  - exposes the live JSON evaluation endpoint: `POST /api/v1/evaluate-json`

- `app/services/json_evaluation_service.py`
  - implements live JSON scoring
  - loads training predictions, mock records, and the saved IsolationForest model
  - calculates duplicate, financial, split-sanction, pending, and final risk scores
  - returns explainable references

- `app/services/prediction_analytics_service.py`
  - reads generated prediction CSVs
  - provides summary, state-risk, prediction list, and prediction detail responses

- `app/api/v1/projects.py`
  - supports older in-memory project creation, preprocessing, evaluation, and audit endpoints
  - useful for MVP/demo but not persistent yet

- `app/repositories/in_memory.py`
  - stores project/evaluation/audit state in memory
  - data disappears when backend restarts

## 3. Data Inputs Used

The project currently uses these supplied datasets:

- `MPLADS.csv`
  - main MPLADS project-level data
  - contains project work, MP, state, constituency, implementing agency, locality fields, date, amount, status, and approval information

- `Allocated Limit for Honble MPs.xlsx`
  - MP allocation limit data

- `Allocated Limit for Honble MPs (1).xlsx`
  - second allocation limit workbook

Important limitation:

- The supplied MPLADS dataset does not contain latitude/longitude.
- Because of that, duplicate detection currently uses normalized location names, mainly locality plus ward.
- True geospatial matching can be added later when coordinates are available.

## 4. Dataset Pipeline

### 4.1 Train/Test Split

The raw data is split into:

- 80 percent training data
- 20 percent testing data

The split uses deterministic seed `42`, so the output is reproducible.

Outputs:

- `backend/data/splits/MPLADS_train.csv`
- `backend/data/splits/MPLADS_test.csv`
- train/test split files for MP allocation workbooks
- `backend/data/splits/split_manifest.json`

### 4.2 Cleaning And Normalization

Implemented in:

- `backend/scripts/clean_normalize_datasets.py`

Main cleaning operations:

- removes encoding artifacts such as BOM characters
- normalizes repeated whitespace
- strips `NA -` and administrative prefix patterns from work text
- expands short work terms such as `const.` to `construction`
- converts dates to ISO format: `yyyy-mm-dd`
- converts allocation amount strings into numeric-compatible values
- canonicalizes MP names by removing common titles such as `Shri`, `Smt`, `Dr`, `Adv`, `Prof`
- creates normalized keys for MP, state, constituency, IDA, work, and locality
- builds a stable `project_key` using project attributes
- creates a `duplicate_group_key` for exact duplicate grouping
- adds data quality flags

Important normalized fields:

- `project_key`
- `mp_key`
- `work_clean`
- `work_key`
- `state_key`
- `constituency_key`
- `ida_key`
- `locality`
- `locality_key`
- `recommended_date`
- `allocation_amount`
- `data_quality_flags`

Cleaning outputs:

- `backend/data/processed/projects_train_normalized.csv`
- `backend/data/processed/projects_test_normalized.csv`
- `backend/data/processed/mp_allocations_train_normalized.csv`
- `backend/data/processed/mp_allocations_test_normalized.csv`
- `backend/data/processed/cleaning_report.json`

## 5. Feature Engineering

Implemented in:

- `backend/scripts/build_features.py`

Feature outputs:

- `backend/data/features/projects_train_features.csv`
- `backend/data/features/projects_test_features.csv`
- `backend/data/features/feature_report.json`

The feature pipeline creates features in these groups.

### 5.1 Amount Features

Key fields:

- `allocation_amount_numeric`
- `category_median_amount`
- `state_category_median_amount`
- `constituency_category_median_amount`
- `amount_vs_category_median_ratio`
- `amount_vs_state_category_median_ratio`
- `amount_vs_constituency_category_median_ratio`

Median logic:

- category median is calculated from training rows with the same category
- state/category median is calculated from training rows with the same state and category
- constituency/category median is calculated from training rows with the same constituency and category
- test medians are computed from training medians to avoid test-data leakage

Current financial trigger:

- a project is treated as financially suspicious when the strongest local median ratio crosses `2.5x`
- category-level extreme ratio `>= 4.0x` can also add risk
- very high absolute amount at or above the 99th percentile adds supporting risk

### 5.2 MP Allocation Features

The MP allocation workbooks are used to estimate how large a project is relative to the MP's allocation.

Key fields:

- `mp_allocated_amount`
- `project_amount_as_pct_of_mp_allocation`
- `mp_project_count`
- `mp_total_recommended_amount`
- `mp_remaining_estimated_allocation`

This helps identify unusually large projects relative to available allocation.

### 5.3 Duplicate And Repetition Features

Because coordinates are missing, duplicate detection uses location-name keys.

Current generated duplicate-location key:

- `duplicate_location_key = normalized(locality + ward)`

Offline feature columns include:

- `same_work_same_locality_count`
- `same_work_same_duplicate_location_count`
- `same_work_same_block_count`
- `same_work_same_constituency_count`
- `same_category_same_locality_count`
- `same_category_same_block_count`
- `same_category_same_constituency_count`
- `same_mp_category_locality_count`
- `same_ida_category_locality_count`
- `same_type_location_month_count`
- `location_duplicate_group_count`

Interpretation:

- exact or near-exact repeated work in the same locality/ward is the strongest duplicate signal
- same project type in the same locality/ward and month is a weaker duplicate signal
- broader category repetition is treated carefully because many records use generic categories such as `Normal/Others`

### 5.4 Split-Sanction Features

Split-sanction logic looks for many near-Rs-5L projects in the same location/time window.

Key fields:

- `is_near_5_lakh`
- `same_ida_locality_7day_sub5l_count`
- `same_mp_locality_7day_sub5l_count`
- `same_ida_same_day_count`

Current rule:

- amount must be between Rs 450,000 and Rs 500,000
- locality must be present
- at least 3 near-Rs-5L projects must appear in a 7-day window for the same IDA/locality or same MP/locality

This rule was tightened because same-day IDA repetition alone created too many false positives.

### 5.5 Pending/Administrative Risk Features

Key fields:

- `status_unsanctioned_flag`
- `ida_pending_flag`
- `possible_pending_risk`

Current pending signal:

- if status is `unsanctioned` and IDA approval contains `pending`, the pending score is activated

This is not fraud by itself. It is an administrative review signal.

## 6. Weak Labels

The project does not currently have verified real-world fraud labels.

Therefore, the training/evaluation pipeline creates weak labels. These are rule-based labels used for review and prototype validation, not final fraud truth.

Weak label columns:

- `weak_label_duplicate`
- `weak_label_cost_outlier`
- `weak_label_split_sanction`
- `weak_label_pending`
- `weak_label_any_risk`

Important interpretation:

- A weak label means "this row matches a suspicious pattern."
- It does not mean "this row is confirmed fraud."
- True supervised fraud classification will require verified audit/fraud outcome labels.

## 7. ML Models Implemented

### 7.1 Rule-Based Baseline Model

Implemented in:

- `backend/scripts/train_evaluate_models.py`

Model family:

- `baseline_rules_plus_trained_thresholds`

Current version:

- `v0.6-locality-ward-duplicates`

This model is a structured scoring system. It uses trained distribution thresholds from the training set plus explainable risk rules.

Risk components:

- duplicate score
- financial score
- split-sanction score
- pending score

Current component weights:

- duplicate: `0.30`
- financial: `0.35`
- split sanction: `0.25`
- pending: `0.10`

Final score:

```text
model_risk_score =
  0.30 * duplicate_score
  + 0.35 * financial_score
  + 0.25 * split_sanction_score
  + 0.10 * pending_score
```

Risk level:

```text
GREEN  = score < 30
YELLOW = 30 <= score <= 65
RED    = score > 65
```

Major anomaly floor:

- if any major duplicate, financial, split-sanction, or IsolationForest anomaly is detected, final risk score is raised to at least `30`
- this ensures that one serious signal does not stay green just because other components are clean

### 7.2 IsolationForest Financial Anomaly Model

Implemented in:

- `backend/scripts/train_evaluate_models.py`

Model:

- `sklearn.ensemble.IsolationForest`

Current version:

- `v0.1-financial-anomaly`

Parameters:

- `n_estimators = 200`
- `contamination = 0.03`
- `random_state = 42`
- `n_jobs = 1`

Preprocessing pipeline:

- `SimpleImputer(strategy="median")`
- `RobustScaler()`
- `IsolationForest(...)`

Purpose:

- detect statistically unusual records across numeric project features
- supplement explainable financial rules
- catch unusual combinations, not only high absolute amount

IsolationForest features include:

- allocation amount
- amount-to-median ratios
- MP allocation ratio
- repeated work counts
- same locality/ward counts
- same IDA/MP/time-window counts
- locality project concentration counts

Risk score conversion:

- raw IsolationForest decision score is converted into percentile position against the training score distribution
- higher `isolation_forest_risk_score` means more unusual
- current high-risk cutoff is `>= 97`

### 7.3 Duplicate Detection Logic

There are two duplicate paths in the project:

1. Offline scoring in `train_evaluate_models.py`
2. Live JSON scoring in `json_evaluation_service.py`

Offline duplicate score uses:

- same cleaned work in same locality/ward
- exact duplicate location group
- same type/location/month
- category-locality and category-block supporting counts

Live JSON duplicate score currently uses a stricter rule:

- excludes the submitted `project_key` from reference matching so a case cannot match itself
- exact `work_clean + locality + ward` match is strong evidence
- inferred work type plus same locality/ward is supporting evidence
- unknown generic work type is not allowed to match all other unknown rows

Live duplicate score formula:

```text
duplicate_score =
  65 if same_work_count > 1
  + 55 if same_type_month_count > 1
  + 20 if exact_count > 1
  + min(same_work_count, 5) * 3
  + min(same_type_month_count, 5) * 5
  + min(same_work_type_count, 5) * 2
```

Threshold:

- duplicate anomaly if `duplicate_score >= 65`

Important demo behavior:

- a standalone JSON case cannot be detected as duplicate unless another matching record already exists in the reference/mock data
- this is why a database or batch-evaluation endpoint is needed for repeated user-submitted JSON test cases

### 7.4 Split-Sanction Detection Logic

Split-sanction risk is based on clustering near Rs 5 lakh.

Live JSON split score:

```text
split_score =
  20 if amount is between Rs 450,000 and Rs 500,000 and locality exists
  + 65 if at least 3 near-Rs-5L records match the locality/ward time window
```

Threshold:

- split-sanction anomaly if `split_score >= 60`

Matching conditions:

- recommended date must be valid
- compared records must be within 7 days
- same locality/ward
- amount between Rs 450,000 and Rs 500,000
- same MP or same IDA

### 7.5 Financial Anomaly Logic

Financial anomaly is based on:

- median ratios from training data
- absolute high-value threshold from training distribution
- IsolationForest percentile risk

Live JSON financial rule:

```text
rule_financial_score =
  45 if strongest median ratio >= 2.5
  + 55 if category ratio >= 4.0
  + 15 if amount >= training p99 amount
```

Then:

```text
financial_score = max(rule_financial_score, isolation_forest_score if isolation_forest_score >= 97 else 0)
```

Threshold:

- financial anomaly if `financial_score >= 45`

Median context returned by API:

- `category`
- `state_category`
- `constituency_category`

Ratio context returned by API:

- `category`
- `state_category`
- `constituency_category`

## 8. Model Outputs

Main model output files:

- `backend/data/model_outputs/baseline_model_metadata.json`
- `backend/data/model_outputs/isolation_forest_model.joblib`
- `backend/data/model_outputs/train_predictions.csv`
- `backend/data/model_outputs/test_predictions.csv`
- `backend/data/model_outputs/evaluation_report.json`

Important prediction columns:

- `model_duplicate_score`
- `model_financial_rule_score`
- `model_financial_isolation_score`
- `model_financial_score`
- `model_split_sanction_score`
- `model_pending_score`
- `model_risk_score`
- `model_risk_level`
- `model_reasons`
- `isolation_forest_raw_score`
- `isolation_forest_risk_score`
- `isolation_forest_anomaly_flag`

## 9. Current Evaluation Snapshot

Current generated training prediction summary:

- train rows: `48,287`
- train GREEN: `26,266`
- train YELLOW: `20,745`
- train RED: `1,276`
- train mean model risk score: `22.59`
- train IsolationForest anomaly count: `1,446`

Current generated test prediction summary:

- test rows: `12,072`
- test GREEN: `8,655`
- test YELLOW: `3,378`
- test RED: `39`
- test mean model risk score: `15.98`
- test IsolationForest anomaly count: `22`
- additional financial cases from IsolationForest: `10`

Weak-label metrics from the current evaluation report:

- duplicate precision/recall vs weak labels: `1.0000 / 1.0000`
- rule financial precision/recall vs weak cost-outlier labels: `1.0000 / 1.0000`
- combined financial precision/recall vs weak cost-outlier labels: `0.9945 / 1.0000`
- split-sanction precision/recall vs weak labels: `1.0000 / 1.0000`
- any-risk precision/recall vs weak labels: `1.0000 / 1.0000`

Important caution:

- these are metrics against weak labels generated by the system rules
- these are not true fraud-detection accuracy metrics
- true precision/recall requires verified fraud or audit labels

## 10. Live JSON Evaluation API

Endpoint:

```text
POST /api/v1/evaluate-json
```

Input schema:

```json
{
  "project_key": "TEST-0001",
  "mp_name": "Rajesh Sharma",
  "state": "Maharashtra",
  "constituency": "Mumbai North East",
  "ida": "District Planning Officer, Mumbai Suburban",
  "category": "Community Infrastructure",
  "work_clean": "Construction of community hall",
  "locality": "Kurla West",
  "ward": "12",
  "block": "Kurla",
  "recommended_date": "2026-08-10",
  "sanction_date": "",
  "status": "Proposed",
  "ida_approval": "Pending",
  "allocation_amount_numeric": 1500000
}
```

Required fields:

- `work_clean`
- `allocation_amount_numeric`

Recommended fields for meaningful detection:

- `project_key`
- `mp_name`
- `state`
- `constituency`
- `ida`
- `category`
- `locality`
- `ward`
- `recommended_date`
- `status`
- `ida_approval`

Response schema:

```json
{
  "project_key": "TEST-0001",
  "flag": "GREEN",
  "flag_color": "#10B981",
  "rating": 0.5,
  "risk_score": 5.0,
  "comment": "No major anomaly found against the current trained and mock reference data.",
  "reason_description": "...",
  "reasons": ["..."],
  "component_scores": {
    "duplicate": 3.0,
    "financial": 0.0,
    "financial_rule": 0.0,
    "isolation_forest": 63.59,
    "split_sanction": 0.0,
    "pending": 45.0
  },
  "median_context": {},
  "ratio_context": {},
  "references": {
    "financial": [],
    "duplicates": [],
    "split_sanctions": []
  }
}
```

Frontend display requirement currently supported:

- flag as color
- rating out of 10
- comment
- reason/description
- component scores
- reference records used for comparison

## 11. Analytics API Endpoints

Implemented analytics endpoints:

```text
GET /api/v1/analytics/summary
GET /api/v1/analytics/state-risk
GET /api/v1/predictions
GET /api/v1/predictions/{project_key}
POST /api/v1/evaluate-json
```

`GET /api/v1/analytics/summary` returns:

- total project count
- total allocation amount
- risk-level counts
- duplicate count
- financial anomaly count
- IsolationForest anomaly count
- split-sanction count
- pending count
- top states by yellow/red records

`GET /api/v1/analytics/state-risk` returns state-level dashboard rows:

- total projects
- GREEN/YELLOW/RED counts
- total allocation
- mean model risk score
- duplicate/financial/split/pending counts

`GET /api/v1/predictions` supports filters:

- risk level
- state
- category
- MP
- IDA
- IsolationForest-only
- limit/offset pagination

## 12. Frontend Integration

The frontend currently uses:

- static generated mock records for the live alert feed
- live backend call for the evaluate section

Static frontend data is generated by:

- `backend/scripts/prepare_frontend_mock_alerts.py`

Generated files:

- `backend/data/mock/mock_input_records.json`
- `Frontend/src/data/projects.ts`

Frontend evaluation path:

```text
Frontend JSON input
  -> POST /api/v1/evaluate-json
  -> backend JsonEvaluationService
  -> response with flag/rating/comment/reasons/references
  -> frontend displays result
```

Current frontend anomaly label logic:

- uses component score thresholds
- picks the strongest detected component among split sanction, financial, and duplicate
- avoids labeling every mixed-signal case as duplicate

## 13. Mock Data Implementation

Current mock data files:

- `backend/data/mock/mplads_mock_input_only.xlsx`
- `backend/data/mock/mplads_mock_input_scored.xlsx`
- `backend/data/mock/mock_input_records.json`
- `backend/data/mock/mock_predictions.csv`
- `backend/data/mock/mock_validation_report.json`

Mock data purpose:

- support prototype demo
- test clean, financial, duplicate, split-sanction, and pending behavior
- populate static frontend alert feed

Important rule:

- mock data should not be random
- it should follow the structure, value ranges, locations, work descriptions, and amount distributions of the supplied MPLADS data

For duplicate testing:

- at least two records must share same/similar work and same locality/ward
- if evaluating one JSON at a time, the earlier matching record must already exist in the reference dataset or database

For financial testing:

- amount should exceed the relevant median by the configured threshold
- current primary trigger is `>= 2.5x` strongest local median ratio

For split-sanction testing:

- create 3 or more near-Rs-5L projects
- keep same locality/ward
- keep dates within 7 days
- use same MP or same IDA

## 14. Tests Implemented

Current backend test files:

- `backend/tests/test_feature_builder.py`
- `backend/tests/test_model_scoring.py`
- `backend/tests/test_prediction_analytics_service.py`
- `backend/tests/test_risk_logic.py`
- `backend/tests/test_json_evaluation_service.py`

Recently added JSON evaluator tests:

- verifies a JSON case does not match its own reference record
- verifies a different project with the same work/locality/ward is detected as duplicate

Current verified test result:

```text
15 passed
```

Frontend TypeScript check:

```text
npx.cmd tsc --noEmit
```

Current verified result:

```text
passed
```

Frontend production build:

```text
npm.cmd run build
```

Current verified result after dependency cleanup:

```text
built successfully
```

## 15. Current Limitations

### 15.1 No Verified Fraud Labels

The current model is trained and evaluated against weak labels, not confirmed fraud labels. This means:

- the system can detect suspicious patterns
- it cannot claim legal fraud accuracy
- precision and recall are only meaningful against the internal weak-label rules

Required future data:

- verified audit outcome
- confirmed fraud/not-fraud label
- reason for fraud confirmation
- recovery/action status

### 15.2 No Persistent Database Yet

Current live JSON evaluation is mostly stateless.

Problem:

- if user submits `DUP-001-A`, then submits `DUP-001-B`, the second case cannot compare against the first unless the first is stored somewhere

Recommended next backend milestone:

- add MongoDB storage for submitted projects and evaluations

Recommended collections:

- `projects`
- `evaluations`
- `reference_projects`
- `model_runs`

### 15.3 No Batch JSON Evaluation Yet

Current endpoint evaluates one JSON project at a time.

Missing endpoint:

```text
POST /api/v1/evaluate-json-batch
```

Why needed:

- uploaded/mock test cases often contain related rows
- duplicate and split-sanction detection improves when all submitted rows can be compared together

### 15.4 No Coordinates Yet

Current duplicate logic uses locality and ward text.

Future coordinate fields:

- latitude
- longitude
- geocoding confidence
- source of coordinates

Once available, duplicate matching can use:

- distance radius
- same work similarity
- same MP/IDA/vendor
- locality text as supporting evidence

### 15.5 Limited Semantic Matching

Current semantic matching is lightweight and rule-based.

Future upgrade:

- TF-IDF cosine similarity
- Sentence-BERT embeddings such as `all-MiniLM-L6-v2`
- text similarity threshold for duplicate detection

This will help detect:

- "construction of community hall"
- "construction of samaj bhavan"
- "public meeting hall building"

as similar work types.

### 15.6 No Contractor/Vendor Graph Persistence

The project includes early graph/collusion logic, but full graph analysis is not connected to a persistent graph database yet.

Future upgrade:

- MongoDB for document storage
- Neo4j or graph projection layer for MP/IDA/vendor/project relationships

## 16. Recommended Next Implementation Steps

Priority order:

1. Add MongoDB persistence.
   - save every submitted JSON project
   - save every evaluation result
   - use previously submitted records as duplicate/split reference evidence

2. Add batch JSON evaluation.
   - accept array of project JSON objects
   - score each record against training data plus the submitted batch
   - return per-record results

3. Align offline and live duplicate logic.
   - current live JSON duplicate logic is stricter than the offline training script
   - update feature builder/model scorer to use the same inferred work-type approach
   - reduce reliance on broad `Normal/Others` category repetition

4. Add verified-label workflow.
   - manual reviewer marks cases as `valid_flag`, `false_positive`, or `confirmed_fraud`
   - store label source and reviewer notes
   - retrain/evaluate against real labels when enough labels exist

5. Add coordinates.
   - geocode locality/ward/block/village
   - store lat/lng and confidence
   - add radius-based duplicate matching

6. Improve semantic text matching.
   - add text embeddings
   - compare work descriptions semantically
   - return matched similar-record references

7. Build dashboard APIs from database.
   - replace static alert feed with stored evaluations
   - support filters by state, MP, constituency, anomaly type, date, and flag

## 17. How To Run The Current Pipeline

From backend folder:

```powershell
cd "C:\Users\barha\OneDrive\Documents\SIH\SIH-2026-PS-102\backend"
```

Clean and normalize:

```powershell
.\.venv\Scripts\python.exe scripts\clean_normalize_datasets.py --input-dir data\splits --output-dir data\processed
```

Build features:

```powershell
.\.venv\Scripts\python.exe scripts\build_features.py --input-dir data\processed --output-dir data\features
```

Train and evaluate models:

```powershell
.\.venv\Scripts\python.exe scripts\train_evaluate_models.py --input-dir data\features --output-dir data\model_outputs
```

Generate frontend mock alert feed:

```powershell
.\.venv\Scripts\python.exe scripts\prepare_frontend_mock_alerts.py --workbook data\mock\mplads_mock_input_only.xlsx --train-predictions data\model_outputs\train_predictions.csv --json-output data\mock\mock_input_records.json --frontend-output ..\Frontend\src\data\projects.ts
```

Run backend:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Run backend tests:

```powershell
.\.venv\Scripts\python.exe -m pytest
```

Run frontend:

```powershell
cd "C:\Users\barha\OneDrive\Documents\SIH\SIH-2026-PS-102\Frontend"
npm.cmd run dev
```

Build frontend:

```powershell
npm.cmd run build
```

## 18. Summary

The current backend has a working explainable ML/rule hybrid anomaly detection pipeline. It can:

- clean and normalize MPLADS records
- create train/test features
- train a baseline scoring model
- train an IsolationForest anomaly model
- generate train/test predictions
- expose dashboard analytics
- evaluate live JSON project proposals
- return flags, 0-10 ratings, comments, component scores, and explanation references

The strongest implemented capabilities are:

- financial outlier detection using medians and IsolationForest
- split-sanction cluster detection
- locality/ward duplicate detection
- explainable API output for frontend display

The main missing pieces for a stronger prototype are:

- MongoDB persistence
- batch JSON evaluation
- verified fraud labels
- coordinate-based matching
- semantic duplicate matching
- alignment between offline and live duplicate scoring logic
