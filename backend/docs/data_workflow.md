# Dataset Workflow

This document tracks the stage-wise dataset work for the SIH26102 backend.

## Stage 0 - Raw Dataset Split

Status: completed.

Inputs:

- `MPLADS.csv`
- `Allocated Limit for Honble MPs (1).xlsx`
- `Allocated Limit for Honble MPs.xlsx`

Outputs:

- `data/splits/*_train.csv`
- `data/splits/*_test.csv`
- `data/splits/split_manifest.json`

Split rule:

- 80% training
- 20% testing
- deterministic seed: `42`

## Stage 1 - Cleaning And Normalization

Status: completed.

Outputs:

- `data/processed/projects_train_normalized.csv`
- `data/processed/projects_test_normalized.csv`
- `data/processed/mp_allocations_train_normalized.csv`
- `data/processed/mp_allocations_test_normalized.csv`
- `data/processed/cleaning_report.json`

Cleaning performed:

- cleaned whitespace and encoding artifacts
- stripped `NA -` and administrative work-code prefixes
- normalized MP names into canonical keys
- normalized state, constituency, agency, work, and locality keys
- converted dates to `yyyy-mm-dd`
- converted allocation amounts to numeric-compatible values
- added data quality flags

Known limitation:

- the supplied datasets do not contain latitude/longitude, so 2 km geospatial matching is deferred.

## Stage 2 - Feature Columns And Weak Labels

Status: completed.

Outputs:

- `data/features/projects_train_features.csv`
- `data/features/projects_test_features.csv`
- `data/features/feature_report.json`

Feature groups:

- amount features
- MP allocation usage features
- MP, IDA, state, constituency, and locality count features
- repeated-work features
- same-day and 7-day temporal cluster features
- pending/unsanctioned workflow flags
- weak labels for duplicate, cost outlier, split sanction, pending risk, and any risk
- rule-based risk score and risk level

Important: weak labels are not confirmed fraud labels. They are review targets for model training and demo validation.

## Stage 3 - Model Training

Status: completed for the baseline plus IsolationForest financial anomaly model.

Models:

- Trained threshold baseline for financial anomaly detection.
- scikit-learn IsolationForest for unusual financial/project numeric patterns.
- Repeated-work locality model for duplicate risk until SBERT is installed.
- Rule-based split-sanction detector for sub-Rs 5 lakh repeated clusters.
- Rule-based graph/concentration detector until Neo4j is connected.
- Composite risk scoring service for GREEN/YELLOW/RED triage.

Run:

```powershell
.\.venv\Scripts\python.exe -X utf8 scripts/train_evaluate_models.py --input-dir data/features --output-dir data/model_outputs
```

Outputs:

- `data/model_outputs/baseline_model_metadata.json`
- `data/model_outputs/isolation_forest_model.joblib`
- `data/model_outputs/train_predictions.csv`
- `data/model_outputs/test_predictions.csv`
- `data/model_outputs/evaluation_report.json`

Current model columns:

- `model_financial_rule_score`: explainable threshold-based financial score.
- `isolation_forest_risk_score`: percentile unusualness against the training distribution.
- `isolation_forest_anomaly_flag`: native IsolationForest anomaly flag.
- `model_financial_isolation_score`: IsolationForest contribution after the 97th percentile cutoff.
- `model_financial_score`: combined financial score used in final risk scoring.

Current evaluation snapshot:

- Test rows: `12,072`.
- Test risk levels: `10,419 GREEN`, `1,636 YELLOW`, `17 RED`.
- Test IsolationForest anomalies: `136`.
- Additional financial cases from IsolationForest beyond the rule score: `13`.
- Combined financial score precision/recall vs weak cost-outlier labels: `0.9890 / 1.0000`.

Future model upgrades:

- TF-IDF + cosine similarity for stronger text duplicate matching.
- Sentence-BERT `all-MiniLM-L6-v2` for semantic duplicate matching.
- Neo4j graph queries for contractor/agency pattern detection.
- XGBoost for unspent-fund or delay prediction after milestone data is available.
- Graph neural network only after enough verified graph history exists.

## Stage 4 - Test Evaluation

Status: completed for the dependency-light baseline.

Evaluation should report:

- train/test flag distribution
- top duplicate candidates
- top cost outliers
- top split-sanction candidates
- risk score distribution
- sampled false-positive review candidates

Do not report model accuracy until manually verified labels exist.

## Stage 4A - Manual Rule Review Pack

Status: completed.

Run:

```powershell
python scripts/create_rule_review_pack.py --predictions data/model_outputs/test_predictions.csv --output-dir data/review --sample-size 100
```

Outputs:

- `data/review/high_risk_review_sample.csv`
- `data/review/duplicate_review_sample.csv`
- `data/review/cost_outlier_review_sample.csv`
- `data/review/split_sanction_review_sample.csv`
- `data/review/pending_review_sample.csv`
- `data/review/rule_review_report.json`

Human review columns:

- `manual_review_label`
- `manual_review_notes`
- `recommended_action`

Allowed `manual_review_label` values:

- `valid_flag`
- `false_positive`
- `unsure`

Review at least 20 rows from each file before tuning thresholds.

AI-assisted first-pass review can be generated with:

```powershell
python scripts/auto_review_rule_pack.py --input-dir data/review --output-dir data/review/ai_reviewed
```

Outputs:

- `data/review/ai_reviewed/high_risk_review_ai_reviewed.csv`
- `data/review/ai_reviewed/duplicate_review_ai_reviewed.csv`
- `data/review/ai_reviewed/cost_outlier_review_ai_reviewed.csv`
- `data/review/ai_reviewed/split_sanction_review_ai_reviewed.csv`
- `data/review/ai_reviewed/pending_review_ai_reviewed.csv`
- `data/review/ai_reviewed/ai_review_summary.json`

This is useful for fast prototype tuning, but it remains an AI-assisted evidence review, not an official fraud determination.

## Stage 4B - Split-Sanction Rule Tuning

Status: completed.

Reason for tuning:

- The earlier split-sanction rule treated `same_ida_same_day_count >= 3` as a strong signal.
- AI-assisted review marked most of those cases as false positives because same-day agency repetition can happen for normal batch processing.

Updated rule:

- Require `is_near_5_lakh = true`.
- Require non-empty locality.
- Require `same_ida_locality_7day_sub5l_count >= 3` or `same_mp_locality_7day_sub5l_count >= 3`.
- Same-day agency repetition can add small supporting weight only when the locality cluster already exists.

Result after tuning:

- Test split-sanction weak labels dropped from `1,516` to `30`.
- Test split-sanction model flags dropped from `8,368` to `30`.
- AI-assisted split-sanction review changed from `93 false_positive / 7 valid_flag` to `30 valid_flag`.

## Stage 5 - Mock Data And System Verification

Status: completed for initial mock validation.

Mock data should follow the supplied dataset schema and value patterns. It should not be random.

Recommended mix:

- 70% normal realistic rows sampled or adapted from the cleaned dataset
- 10% duplicate-work cases
- 10% cost-outlier cases
- 10% split-sanction/pending-risk cases

Mock rows should include these extra expected-result columns:

- `mock_case_type`
- `expected_risk_level`
- `expected_reason`

These expected columns are only for testing; they are not real fraud labels.

Run:

```powershell
.\.venv\Scripts\python.exe -X utf8 scripts/create_mock_validation_data.py --predictions data/model_outputs/train_predictions.csv --model data/model_outputs/baseline_model_metadata.json --isolation-forest-model data/model_outputs/isolation_forest_model.joblib --output-dir data/mock
```

Outputs:

- `data/mock/mock_projects_features.csv`
- `data/mock/mock_predictions.csv`
- `data/mock/mock_validation_report.json`
