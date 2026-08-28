from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import pandas as pd


MOCK_COLUMNS = [
    "mock_case_type",
    "expected_label",
    "expected_risk_type",
    "project_key",
    "mp_name",
    "state",
    "constituency",
    "ida",
    "category",
    "work_clean",
    "locality",
    "recommended_date",
    "status",
    "ida_approval",
    "allocation_amount_numeric",
    "amount_vs_category_median_ratio",
    "amount_vs_state_category_median_ratio",
    "same_work_same_locality_count",
    "same_ida_locality_7day_sub5l_count",
    "same_mp_locality_7day_sub5l_count",
    "model_risk_level",
    "model_risk_score",
    "model_duplicate_score",
    "model_financial_score",
    "model_split_sanction_score",
    "model_pending_score",
    "isolation_forest_risk_score",
    "isolation_forest_anomaly_flag",
    "model_reasons",
    "how_to_create_more",
]


def text(value: Any) -> str:
    return str(value or "").strip()


def number(value: Any) -> float:
    try:
        if value in ("", None):
            return 0.0
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def base_row(row: pd.Series, case_type: str, label: str, risk_type: str, guidance: str, index: int) -> dict[str, Any]:
    return {
        "mock_case_type": case_type,
        "expected_label": label,
        "expected_risk_type": risk_type,
        "project_key": f"MOCK-{case_type.upper()}-{index:03d}",
        "mp_name": text(row.get("mp_name")),
        "state": text(row.get("state")),
        "constituency": text(row.get("constituency")),
        "ida": text(row.get("ida")),
        "category": text(row.get("category")),
        "work_clean": text(row.get("work_clean")),
        "locality": text(row.get("locality")),
        "recommended_date": text(row.get("recommended_date")),
        "status": text(row.get("status")),
        "ida_approval": text(row.get("ida_approval")),
        "allocation_amount_numeric": number(row.get("allocation_amount_numeric")),
        "amount_vs_category_median_ratio": number(row.get("amount_vs_category_median_ratio")),
        "amount_vs_state_category_median_ratio": number(row.get("amount_vs_state_category_median_ratio")),
        "same_work_same_locality_count": number(row.get("same_work_same_locality_count")),
        "same_ida_locality_7day_sub5l_count": number(row.get("same_ida_locality_7day_sub5l_count")),
        "same_mp_locality_7day_sub5l_count": number(row.get("same_mp_locality_7day_sub5l_count")),
        "model_risk_level": text(row.get("model_risk_level")),
        "model_risk_score": number(row.get("model_risk_score")),
        "model_duplicate_score": number(row.get("model_duplicate_score")),
        "model_financial_score": number(row.get("model_financial_score")),
        "model_split_sanction_score": number(row.get("model_split_sanction_score")),
        "model_pending_score": number(row.get("model_pending_score")),
        "isolation_forest_risk_score": number(row.get("isolation_forest_risk_score")),
        "isolation_forest_anomaly_flag": text(row.get("isolation_forest_anomaly_flag")).lower() == "true",
        "model_reasons": text(row.get("model_reasons")),
        "how_to_create_more": guidance,
    }


def clean_rows(source: pd.DataFrame, count: int) -> list[dict[str, Any]]:
    candidates = source[
        (source["model_risk_level"].eq("GREEN"))
        & (source["weak_label_any_risk"].astype(str).str.lower().eq("false"))
        & (source["data_quality_flags"].fillna("").eq(""))
        & (source["model_duplicate_score"].astype(float).lt(65))
        & (source["model_financial_score"].astype(float).lt(45))
        & (source["model_split_sanction_score"].astype(float).lt(60))
        & (source["model_pending_score"].astype(float).eq(0))
        & (source["isolation_forest_anomaly_flag"].astype(str).str.lower().eq("false"))
    ].head(count)
    return [
        base_row(
            row,
            "clean",
            "not_fraud",
            "none",
            "Use real GREEN rows with no weak risk label and no data-quality flags.",
            index,
        )
        for index, (_, row) in enumerate(candidates.iterrows(), start=1)
    ]


def fraud_rows(source: pd.DataFrame) -> list[dict[str, Any]]:
    usable = source[
        (source["locality"].fillna("").astype(str).ne(""))
        & (source["ida"].fillna("").astype(str).ne(""))
        & (source["allocation_amount_numeric"].astype(float).gt(0))
    ].head(20)
    rows: list[dict[str, Any]] = []
    for index, (_, row) in enumerate(usable.iterrows(), start=1):
        bucket = (index - 1) // 5
        if bucket == 0:
            mocked = base_row(
                row,
                "duplicate_work",
                "needs_investigation",
                "duplicate",
                "Keep MP/state/locality/IDA similar, then repeat the same work text 3-5 times in the same locality.",
                index,
            )
            mocked.update(
                {
                    "work_clean": f"{text(row.get('work_clean'))} - repeated entry",
                    "model_risk_level": "YELLOW",
                    "model_risk_score": 38.5,
                    "model_duplicate_score": 100,
                    "same_work_same_locality_count": 5,
                    "model_reasons": "Repeated work appears in same locality or exact duplicate group",
                }
            )
        elif bucket == 1:
            mocked = base_row(
                row,
                "cost_outlier",
                "needs_investigation",
                "financial",
                "Use the same category/state pattern, then raise amount to 5-8x the category median or normal amount.",
                index,
            )
            mocked.update(
                {
                    "allocation_amount_numeric": max(number(row.get("allocation_amount_numeric")) * 8, 800000),
                    "amount_vs_category_median_ratio": 8,
                    "amount_vs_state_category_median_ratio": 8,
                    "model_risk_level": "YELLOW",
                    "model_risk_score": 42.25,
                    "model_financial_score": 100,
                    "isolation_forest_risk_score": max(number(row.get("isolation_forest_risk_score")), 97.5),
                    "isolation_forest_anomaly_flag": True,
                    "model_reasons": "Allocation amount is high compared with trained category/state distribution",
                }
            )
        elif bucket == 2:
            mocked = base_row(
                row,
                "split_sanction",
                "needs_investigation",
                "split_sanction",
                "Create several near-Rs 5 lakh rows for the same MP/IDA/locality within a 7-day window.",
                index,
            )
            mocked.update(
                {
                    "allocation_amount_numeric": 490000,
                    "amount_vs_category_median_ratio": 1,
                    "amount_vs_state_category_median_ratio": 1,
                    "model_risk_level": "YELLOW",
                    "model_risk_score": 43.25,
                    "model_split_sanction_score": 95,
                    "model_pending_score": 45,
                    "same_ida_locality_7day_sub5l_count": 4,
                    "same_mp_locality_7day_sub5l_count": 4,
                    "model_reasons": "Near Rs 5 lakh cluster appears within a short time window",
                }
            )
        else:
            mocked = base_row(
                row,
                "pending_ai_anomaly",
                "needs_investigation",
                "pending_and_ai_anomaly",
                "Use Action Pending/Unsanctioned status with an unusual low/high amount and repeated agency/locality behavior.",
                index,
            )
            mocked.update(
                {
                    "model_risk_level": "RED",
                    "model_risk_score": 68.61,
                    "model_financial_score": 97.47,
                    "model_pending_score": 45,
                    "status": "Unsanctioned",
                    "ida_approval": "Action Pending",
                    "isolation_forest_risk_score": 97.47,
                    "isolation_forest_anomaly_flag": True,
                    "model_reasons": "Financial pattern is unusual against the IsolationForest train distribution | Project is unsanctioned with action pending",
                }
            )
        rows.append(mocked)
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare 80/20 mock workbook JSON from trained predictions.")
    parser.add_argument("--predictions", type=Path, default=Path("data/model_outputs/train_predictions.csv"))
    parser.add_argument("--output", type=Path, default=Path("data/mock/mock_workbook_data.json"))
    args = parser.parse_args()

    source = pd.read_csv(args.predictions, dtype=str).fillna("")
    mock_rows = clean_rows(source, 80) + fraud_rows(source)
    mock_rows = [{column: row.get(column, "") for column in MOCK_COLUMNS} for row in mock_rows]
    payload = {
        "summary": {
            "total_mock_rows": len(mock_rows),
            "clean_rows": sum(row["mock_case_type"] == "clean" for row in mock_rows),
            "fraud_example_rows": sum(row["mock_case_type"] != "clean" for row in mock_rows),
            "source_predictions": str(args.predictions),
            "principle": "Mock rows should follow real dataset structure; only anomaly fields are controlled.",
        },
        "mock_columns": MOCK_COLUMNS,
        "mock_rows": mock_rows,
        "fraud_patterns": [
            {
                "pattern": "duplicate_work",
                "example": "Same/similar work repeated for the same locality, MP, and implementing agency.",
                "important_fields": "work_clean, locality, mp_name, ida, recommended_date, model_duplicate_score",
            },
            {
                "pattern": "cost_outlier",
                "example": "Project amount is far higher than category/state median or normal project amount.",
                "important_fields": "allocation_amount_numeric, category, state, model_financial_score, isolation_forest_risk_score",
            },
            {
                "pattern": "split_sanction",
                "example": "Multiple near-Rs 5 lakh projects in the same locality and 7-day window.",
                "important_fields": "allocation_amount_numeric, locality, ida, recommended_date, model_split_sanction_score",
            },
            {
                "pattern": "pending_ai_anomaly",
                "example": "Unsanctioned/action-pending project also looks statistically unusual to IsolationForest.",
                "important_fields": "status, ida_approval, model_pending_score, isolation_forest_anomaly_flag",
            },
        ],
        "user_input_fields": user_input_fields(),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps(payload["summary"], indent=2))


def user_input_fields() -> list[dict[str, str]]:
    return [
        {"field": "project_title_or_work_description", "required": "Yes", "why_needed": "Primary text for duplicate and semantic similarity checks."},
        {"field": "project_category", "required": "Yes", "why_needed": "Needed for category-median cost comparison."},
        {"field": "estimated_or_sanctioned_amount", "required": "Yes", "why_needed": "Core financial anomaly input."},
        {"field": "state", "required": "Yes", "why_needed": "Used for state/category median and dashboard filters."},
        {"field": "constituency", "required": "Yes", "why_needed": "Used for constituency-level risk concentration."},
        {"field": "mp_name", "required": "Yes", "why_needed": "Used for MP allocation utilization and repeated patterns."},
        {"field": "implementing_agency_ida", "required": "Yes", "why_needed": "Used for agency concentration, pending risk, and split-sanction checks."},
        {"field": "block_village_or_locality", "required": "Yes", "why_needed": "Used for duplicate locality and split-sanction cluster detection."},
        {"field": "recommended_or_sanction_date", "required": "Yes", "why_needed": "Used for same-day and 7-day cluster features."},
        {"field": "project_status", "required": "Yes", "why_needed": "Used to identify unsanctioned/pending workflow risk."},
        {"field": "ida_approval_status", "required": "Yes", "why_needed": "Used for pending/action-required risk."},
        {"field": "mp_allocated_amount", "required": "Recommended", "why_needed": "Needed for allocation-utilization ratio and remaining-allocation checks."},
        {"field": "contractor_or_vendor_name", "required": "Future", "why_needed": "Required for graph/collusion detection."},
        {"field": "latitude_longitude", "required": "Future", "why_needed": "Required for 2 km duplicate/geospatial checks and map view."},
        {"field": "geotagged_photos", "required": "Future", "why_needed": "Required for field-photo and EXIF verification."},
        {"field": "actual_completion_date", "required": "Future", "why_needed": "Required for delay/non-completion prediction."},
        {"field": "official_human_review_label", "required": "Future", "why_needed": "Required for real model accuracy, precision, recall, and F1."},
    ]


if __name__ == "__main__":
    main()
