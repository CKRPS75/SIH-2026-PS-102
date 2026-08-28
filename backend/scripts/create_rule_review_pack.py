from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd


REVIEW_COLUMNS = [
    "project_key",
    "mp_name_canonical",
    "work_clean",
    "category",
    "state",
    "constituency",
    "ida",
    "block",
    "village",
    "locality",
    "recommended_date",
    "allocation_amount_numeric",
    "model_risk_level",
    "model_risk_score",
    "model_duplicate_score",
    "model_financial_score",
    "model_split_sanction_score",
    "model_pending_score",
    "same_work_same_locality_count",
    "same_work_same_block_count",
    "same_work_same_constituency_count",
    "same_ida_locality_7day_sub5l_count",
    "same_mp_locality_7day_sub5l_count",
    "same_ida_same_day_count",
    "amount_vs_category_median_ratio",
    "amount_vs_state_category_median_ratio",
    "is_near_5_lakh",
    "status",
    "ida_approval",
    "model_reasons",
]


def load_predictions(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, dtype=str).fillna("")


def to_number(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").fillna(0.0)


def review_frame(df: pd.DataFrame, extra_columns: list[str] | None = None) -> pd.DataFrame:
    columns = REVIEW_COLUMNS[:]
    if extra_columns:
        columns.extend(extra_columns)
    available = [column for column in columns if column in df.columns]
    return df[available].copy()


def add_review_columns(df: pd.DataFrame) -> pd.DataFrame:
    result = df.copy()
    result["manual_review_label"] = ""
    result["manual_review_notes"] = ""
    result["recommended_action"] = ""
    return result


def create_samples(df: pd.DataFrame, sample_size: int) -> dict[str, pd.DataFrame]:
    numeric = df.copy()
    for column in [
        "model_risk_score",
        "model_duplicate_score",
        "model_financial_score",
        "model_split_sanction_score",
        "model_pending_score",
        "allocation_amount_numeric",
        "same_ida_locality_7day_sub5l_count",
        "same_mp_locality_7day_sub5l_count",
    ]:
        if column in numeric.columns:
            numeric[column] = to_number(numeric[column])

    high_risk = numeric[numeric["model_risk_level"].isin(["RED", "YELLOW"])].sort_values(
        ["model_risk_level", "model_risk_score"],
        ascending=[False, False],
    )
    duplicate = numeric[numeric["model_duplicate_score"].ge(65)].sort_values(
        "model_duplicate_score",
        ascending=False,
    )
    cost = numeric[numeric["model_financial_score"].ge(45)].sort_values(
        ["model_financial_score", "allocation_amount_numeric"],
        ascending=False,
    )
    split = numeric[numeric["model_split_sanction_score"].ge(60)].sort_values(
        ["model_split_sanction_score", "same_ida_locality_7day_sub5l_count"],
        ascending=False,
    )
    pending = numeric[numeric["model_pending_score"].gt(0)].sort_values(
        "model_risk_score",
        ascending=False,
    )

    return {
        "high_risk_review_sample": add_review_columns(review_frame(high_risk.head(sample_size))),
        "duplicate_review_sample": add_review_columns(review_frame(duplicate.head(sample_size))),
        "cost_outlier_review_sample": add_review_columns(review_frame(cost.head(sample_size))),
        "split_sanction_review_sample": add_review_columns(review_frame(split.head(sample_size))),
        "pending_review_sample": add_review_columns(review_frame(pending.head(sample_size))),
    }


def summarize(df: pd.DataFrame) -> dict[str, object]:
    numeric = df.copy()
    for column in [
        "model_risk_score",
        "model_duplicate_score",
        "model_financial_score",
        "model_split_sanction_score",
        "model_pending_score",
    ]:
        numeric[column] = to_number(numeric[column])

    return {
        "rows": int(len(df)),
        "risk_level_counts": df["model_risk_level"].value_counts().to_dict(),
        "flag_counts": {
            "duplicate_score_ge_65": int(numeric["model_duplicate_score"].ge(65).sum()),
            "financial_score_ge_45": int(numeric["model_financial_score"].ge(45).sum()),
            "split_score_ge_60": int(numeric["model_split_sanction_score"].ge(60).sum()),
            "pending_score_gt_0": int(numeric["model_pending_score"].gt(0).sum()),
        },
        "top_states_by_yellow_red": df[df["model_risk_level"].isin(["YELLOW", "RED"])]
        .groupby("state")["project_key"]
        .count()
        .sort_values(ascending=False)
        .head(10)
        .to_dict(),
        "review_guidance": [
            "Open each review CSV and fill manual_review_label with valid_flag, false_positive, or unsure.",
            "Use manual_review_notes for the reason: generic repeated work, same locality, amount looks too high, missing data, etc.",
            "Tune rules only after reviewing at least 20 rows from each sample file.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Create CSV review samples for rule tuning.")
    parser.add_argument("--predictions", type=Path, default=Path("data/model_outputs/test_predictions.csv"))
    parser.add_argument("--output-dir", type=Path, default=Path("data/review"))
    parser.add_argument("--sample-size", type=int, default=100)
    args = parser.parse_args()

    predictions = load_predictions(args.predictions)
    samples = create_samples(predictions, args.sample_size)
    args.output_dir.mkdir(parents=True, exist_ok=True)

    for name, sample in samples.items():
        sample.to_csv(args.output_dir / f"{name}.csv", index=False)

    report = {
        "source_predictions": str(args.predictions),
        "sample_size_per_file": args.sample_size,
        "summary": summarize(predictions),
        "outputs": {name: str(args.output_dir / f"{name}.csv") for name in samples},
    }
    (args.output_dir / "rule_review_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
