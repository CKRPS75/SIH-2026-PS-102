from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

from train_evaluate_models import load_isolation_forest_model, score_with_model


def load_model(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def set_common_mock_fields(row: pd.Series, index: int, case_type: str, expected_level: str, expected_reason: str) -> dict:
    row = row.to_dict()
    row["project_key"] = f"MOCK-{case_type.upper()}-{index:03d}"
    row["source_dataset"] = "MOCK_VALIDATION"
    row["mock_case_type"] = case_type
    row["expected_risk_level"] = expected_level
    row["minimum_expected_risk_level"] = expected_level
    row["expected_reason"] = expected_reason
    return row


def normal_rows(source: pd.DataFrame, count: int) -> list[dict]:
    candidates = source[
        (source["model_risk_level"].eq("GREEN"))
        & (source["weak_label_any_risk"].astype(str).str.lower().eq("false"))
        & (source["data_quality_flags"].fillna("").eq(""))
    ].head(count)
    rows = []
    for index, (_, row) in enumerate(candidates.iterrows(), start=1):
        rows.append(set_common_mock_fields(row, index, "normal", "GREEN", "No planted anomaly"))
    return rows


def duplicate_rows(source: pd.DataFrame, count: int) -> list[dict]:
    candidates = source[
        (source["locality_key"].fillna("").astype(str).ne(""))
        & (source["work_clean"].fillna("").astype(str).ne(""))
    ].head(count)
    rows = []
    for index, (_, row) in enumerate(candidates.iterrows(), start=1):
        mocked = set_common_mock_fields(
            row,
            index,
            "duplicate",
            "YELLOW",
            "Same work repeated in same locality",
        )
        mocked["work_raw"] = f"NA - {row['work_clean']}"
        mocked["work_clean"] = f"{row['work_clean']} - duplicate recommendation"
        mocked["same_work_same_locality_count"] = 5
        mocked["same_work_same_duplicate_location_count"] = 5
        mocked["same_work_same_block_count"] = max_int(row.get("same_work_same_block_count"), 5)
        mocked["same_work_same_constituency_count"] = max_int(row.get("same_work_same_constituency_count"), 5)
        mocked["same_category_same_locality_count"] = max_int(row.get("same_category_same_locality_count"), 5)
        mocked["same_category_same_block_count"] = max_int(row.get("same_category_same_block_count"), 5)
        mocked["same_category_same_constituency_count"] = max_int(row.get("same_category_same_constituency_count"), 5)
        mocked["same_mp_category_locality_count"] = max_int(row.get("same_mp_category_locality_count"), 5)
        mocked["same_ida_category_locality_count"] = max_int(row.get("same_ida_category_locality_count"), 5)
        mocked["same_type_location_month_count"] = max_int(row.get("same_type_location_month_count"), 5)
        mocked["exact_duplicate_group_count"] = 5
        mocked["location_duplicate_group_count"] = 5
        mocked["is_exact_duplicate_candidate"] = "true"
        mocked["weak_label_duplicate"] = "true"
        mocked["weak_label_any_risk"] = "true"
        rows.append(mocked)
    return rows


def cost_outlier_rows(source: pd.DataFrame, count: int) -> list[dict]:
    candidates = source[source["allocation_amount_numeric"].astype(float).gt(0)].head(count)
    rows = []
    for index, (_, row) in enumerate(candidates.iterrows(), start=1):
        mocked = set_common_mock_fields(
            row,
            index,
            "cost_outlier",
            "YELLOW",
            "Allocation amount is inflated against trained medians",
        )
        base_amount = max(float(row.get("category_median_amount") or 400000), 400000)
        mocked["allocation_amount"] = str(int(base_amount * 8))
        mocked["allocation_amount_numeric"] = base_amount * 8
        mocked["amount_vs_category_median_ratio"] = 8.0
        mocked["amount_vs_state_category_median_ratio"] = 8.0
        mocked["amount_vs_constituency_category_median_ratio"] = 8.0
        mocked["is_high_value_project"] = "true"
        mocked["weak_label_cost_outlier"] = "true"
        mocked["weak_label_any_risk"] = "true"
        rows.append(mocked)
    return rows


def split_sanction_rows(source: pd.DataFrame, count: int) -> list[dict]:
    candidates = source[
        (source["locality_key"].fillna("").astype(str).ne(""))
        & (source["ida_key"].fillna("").astype(str).ne(""))
    ].head(count)
    rows = []
    for index, (_, row) in enumerate(candidates.iterrows(), start=1):
        mocked = set_common_mock_fields(
            row,
            index,
            "split_sanction",
            "YELLOW",
            "Near Rs 5 lakh work appears in a repeated short-window cluster",
        )
        mocked["work_raw"] = f"NA - Phase {index % 3 + 1} continuation work"
        mocked["work_clean"] = f"Phase {index % 3 + 1} continuation work"
        mocked["allocation_amount"] = "490000"
        mocked["allocation_amount_numeric"] = 490000
        mocked["is_sub_5_lakh"] = "true"
        mocked["is_near_5_lakh"] = "true"
        mocked["same_ida_same_day_count"] = 3
        mocked["same_mp_same_day_count"] = 3
        mocked["same_ida_locality_7day_sub5l_count"] = 4
        mocked["same_mp_locality_7day_sub5l_count"] = 4
        mocked["status_unsanctioned_flag"] = "true"
        mocked["ida_pending_flag"] = "true"
        mocked["weak_label_split_sanction"] = "true"
        mocked["weak_label_pending"] = "true"
        mocked["weak_label_any_risk"] = "true"
        rows.append(mocked)
    return rows


def max_int(value: object, minimum: int) -> int:
    try:
        return max(int(float(value)), minimum)
    except (TypeError, ValueError):
        return minimum


def validation_report(scored: pd.DataFrame) -> dict:
    exact_matched = scored["model_risk_level"].eq(scored["expected_risk_level"])
    severity = {"GREEN": 0, "YELLOW": 1, "RED": 2}
    minimum_matched = scored.apply(
        lambda row: severity.get(row["model_risk_level"], -1)
        >= severity.get(row["minimum_expected_risk_level"], 99),
        axis=1,
    )
    case_summary = {}
    for case_type, group in scored.groupby("mock_case_type"):
        group_minimum_matched = group.apply(
            lambda row: severity.get(row["model_risk_level"], -1)
            >= severity.get(row["minimum_expected_risk_level"], 99),
            axis=1,
        )
        case_summary[case_type] = {
            "rows": int(len(group)),
            "expected_levels": group["expected_risk_level"].value_counts().to_dict(),
            "predicted_levels": group["model_risk_level"].value_counts().to_dict(),
            "matched_expected_level": int(group["model_risk_level"].eq(group["expected_risk_level"]).sum()),
            "met_minimum_expected_level": int(group_minimum_matched.sum()),
            "mean_model_risk_score": round(float(group["model_risk_score"].mean()), 2),
            "isolation_forest_anomaly_flags": int(group["isolation_forest_anomaly_flag"].astype(bool).sum()),
        }
    return {
        "rows": int(len(scored)),
        "overall_exact_expected_level_match_rate": round(float(exact_matched.mean()), 4),
        "overall_minimum_expected_level_match_rate": round(float(minimum_matched.mean()), 4),
        "case_summary": case_summary,
        "notes": [
            "Mock data is based on real feature rows, then controlled anomalies are injected.",
            "Mock expected labels are validation targets, not real fraud labels.",
            "Mock data intentionally follows the supplied dataset schema and value style.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Create mock validation records and score them.")
    parser.add_argument("--predictions", type=Path, default=Path("data/model_outputs/train_predictions.csv"))
    parser.add_argument("--model", type=Path, default=Path("data/model_outputs/baseline_model_metadata.json"))
    parser.add_argument(
        "--isolation-forest-model",
        type=Path,
        default=Path("data/model_outputs/isolation_forest_model.joblib"),
    )
    parser.add_argument("--output-dir", type=Path, default=Path("data/mock"))
    parser.add_argument("--normal-count", type=int, default=70)
    parser.add_argument("--duplicate-count", type=int, default=10)
    parser.add_argument("--cost-count", type=int, default=10)
    parser.add_argument("--split-count", type=int, default=10)
    args = parser.parse_args()

    source = pd.read_csv(args.predictions, dtype=str).fillna("")
    model = load_model(args.model)
    isolation_forest_bundle = load_isolation_forest_model(args.isolation_forest_model)
    rows = (
        normal_rows(source, args.normal_count)
        + duplicate_rows(source, args.duplicate_count)
        + cost_outlier_rows(source, args.cost_count)
        + split_sanction_rows(source, args.split_count)
    )
    mock = pd.DataFrame(rows).reset_index(drop=True)
    scored = score_with_model(mock, model, isolation_forest_bundle)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    mock.to_csv(args.output_dir / "mock_projects_features.csv", index=False)
    scored.to_csv(args.output_dir / "mock_predictions.csv", index=False)
    report = validation_report(scored)
    (args.output_dir / "mock_validation_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
