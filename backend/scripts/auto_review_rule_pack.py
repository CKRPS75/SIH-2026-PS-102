from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd


REVIEW_FILES = [
    "high_risk_review_sample.csv",
    "duplicate_review_sample.csv",
    "cost_outlier_review_sample.csv",
    "split_sanction_review_sample.csv",
    "pending_review_sample.csv",
]


def to_number(value: object) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def is_true(value: object) -> bool:
    return str(value).strip().lower() == "true"


def label_row(row: pd.Series, review_type: str) -> tuple[str, str, str]:
    locality = str(row.get("locality", "")).strip()
    amount = to_number(row.get("allocation_amount_numeric"))
    duplicate_score = to_number(row.get("model_duplicate_score"))
    financial_score = to_number(row.get("model_financial_score"))
    split_score = to_number(row.get("model_split_sanction_score"))
    pending_score = to_number(row.get("model_pending_score"))
    same_locality = to_number(row.get("same_work_same_locality_count"))
    same_duplicate_location = to_number(row.get("same_work_same_duplicate_location_count"))
    location_duplicate_group = to_number(row.get("location_duplicate_group_count"))
    same_block = to_number(row.get("same_work_same_block_count"))
    same_category_locality = to_number(row.get("same_category_same_locality_count"))
    same_category_block = to_number(row.get("same_category_same_block_count"))
    same_type_month = to_number(row.get("same_type_location_month_count"))
    same_ida_7day = to_number(row.get("same_ida_locality_7day_sub5l_count"))
    same_mp_7day = to_number(row.get("same_mp_locality_7day_sub5l_count"))
    same_ida_day = to_number(row.get("same_ida_same_day_count"))
    category_ratio = to_number(row.get("amount_vs_category_median_ratio"))
    state_ratio = to_number(row.get("amount_vs_state_category_median_ratio"))
    constituency_ratio = to_number(row.get("amount_vs_constituency_category_median_ratio"))
    near_5_lakh = is_true(row.get("is_near_5_lakh"))
    status = str(row.get("status", "")).lower()
    ida_approval = str(row.get("ida_approval", "")).lower()

    has_pending = "unsanctioned" in status and "pending" in ida_approval

    if review_type == "duplicate":
        if not locality:
            return "unsure", "Cannot validate duplicate signal because locality is missing.", "needs_location_data"
        if same_duplicate_location >= 2 and duplicate_score >= 65:
            return "valid_flag", "Same cleaned work appears multiple times for the same locality and ward.", "keep_duplicate_rule"
        if location_duplicate_group >= 2 and duplicate_score >= 65:
            return "valid_flag", "Exact duplicate group repeats for the same locality and ward.", "keep_duplicate_rule"
        if same_category_locality >= 2 and duplicate_score >= 65:
            if same_type_month >= 2:
                return "valid_flag", "Similar project category repeats for the same locality and ward within the same MP/IDA month.", "keep_type_location_rule"
            return "unsure", "Similar project category repeats for the same locality and ward, but timing or MP/IDA continuity needs review.", "review_after_coordinates"
        if same_block >= 10 and duplicate_score >= 65:
            return "unsure", "Repeated work appears at block level, but exact local duplication is not proven.", "review_after_coordinates"
        if same_category_block >= 10 and duplicate_score >= 65:
            return "unsure", "Similar project category repeats at block level, but exact local duplication is not proven.", "review_after_coordinates"
        return "false_positive", "Duplicate score appears driven by broad/generic repetition rather than same-locality evidence.", "reduce_duplicate_weight"

    if review_type == "cost_outlier":
        if financial_score >= 70 or category_ratio >= 4 or state_ratio >= 2.5 or constituency_ratio >= 2.5 or amount >= 2_500_000:
            return "valid_flag", "Amount is high compared with trained category/state or constituency amount distribution.", "keep_cost_rule"
        if financial_score >= 45:
            return "unsure", "Amount is above threshold but not extreme; needs BSR/rate table validation.", "review_with_bsr"
        return "false_positive", "Financial evidence is weak without stronger amount ratio or BSR support.", "reduce_cost_weight"

    if review_type == "split_sanction":
        if not locality:
            return "unsure", "Cannot validate split-sanction cluster because locality is missing.", "needs_location_data"
        if near_5_lakh and (same_ida_7day >= 3 or same_mp_7day >= 3):
            return "valid_flag", "Near-Rs 5 lakh project appears in a same-locality short-window cluster.", "keep_split_rule"
        if same_ida_day >= 3 and not near_5_lakh:
            return "false_positive", "Same-day agency repetition alone is too broad without near-Rs 5 lakh/locality evidence.", "tighten_split_rule"
        if split_score >= 60:
            return "unsure", "Cluster signal exists but needs date/locality details before treating as split sanction.", "manual_review"
        return "false_positive", "Split-sanction evidence is weak.", "reduce_split_weight"

    if review_type == "pending":
        if has_pending and (duplicate_score >= 65 or financial_score >= 45 or split_score >= 60):
            return "valid_flag", "Pending/unsanctioned status is combined with another risk signal.", "prioritize_admin_review"
        if has_pending:
            return "unsure", "Pending/unsanctioned status is an operational risk, but not enough to imply fraud alone.", "monitor_pending_case"
        return "false_positive", "Pending signal is not supported by status and approval fields.", "drop_pending_flag"

    if review_type == "high_risk":
        strong_signals = sum(
            [
                duplicate_score >= 65,
                financial_score >= 45,
                split_score >= 60,
                pending_score > 0,
            ]
        )
        if strong_signals >= 3:
            return "valid_flag", "Multiple independent risk signals are active.", "priority_review"
        if strong_signals == 2:
            return "unsure", "Two risk signals are active; needs supporting documents or locality confirmation.", "secondary_review"
        return "false_positive", "High-risk sample has insufficient independent evidence.", "reduce_composite_score"

    return "unsure", "Unknown review type.", "manual_review"


def review_type_from_file(path: Path) -> str:
    name = path.name
    if name.startswith("duplicate"):
        return "duplicate"
    if name.startswith("cost_outlier"):
        return "cost_outlier"
    if name.startswith("split_sanction"):
        return "split_sanction"
    if name.startswith("pending"):
        return "pending"
    return "high_risk"


def review_file(path: Path, output_dir: Path) -> dict[str, object]:
    review_type = review_type_from_file(path)
    df = pd.read_csv(path, dtype=str).fillna("")
    labels = df.apply(lambda row: label_row(row, review_type), axis=1)
    df["manual_review_label"] = [label for label, _, _ in labels]
    df["manual_review_notes"] = [note for _, note, _ in labels]
    df["recommended_action"] = [action for _, _, action in labels]
    df["review_source"] = "ai_assisted_first_pass"

    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / path.name.replace("_sample.csv", "_ai_reviewed.csv")
    df.to_csv(output_path, index=False)
    return {
        "source_file": str(path),
        "output_file": str(output_path),
        "review_type": review_type,
        "rows": int(len(df)),
        "label_counts": df["manual_review_label"].value_counts().to_dict(),
        "recommended_action_counts": df["recommended_action"].value_counts().to_dict(),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply AI-assisted first-pass labels to review samples.")
    parser.add_argument("--input-dir", type=Path, default=Path("data/review"))
    parser.add_argument("--output-dir", type=Path, default=Path("data/review/ai_reviewed"))
    args = parser.parse_args()

    report = []
    for file_name in REVIEW_FILES:
        path = args.input_dir / file_name
        if path.exists():
            report.append(review_file(path, args.output_dir))

    report_path = args.output_dir / "ai_review_summary.json"
    report_path.write_text(json.dumps({"files": report}, indent=2), encoding="utf-8")
    print(json.dumps({"files": report}, indent=2))


if __name__ == "__main__":
    main()
