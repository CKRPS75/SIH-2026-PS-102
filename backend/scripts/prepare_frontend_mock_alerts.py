from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

import pandas as pd


DEFAULT_WORKBOOK = Path("data/mock/mplads_mock_input_only.xlsx")
DEFAULT_TRAIN_PREDICTIONS = Path("data/model_outputs/train_predictions.csv")
DEFAULT_JSON_OUTPUT = Path("data/mock/mock_input_records.json")
DEFAULT_FRONTEND_OUTPUT = Path("../Frontend/src/data/projects.ts")


def clean_text(value: Any) -> str:
    if pd.isna(value):
        return ""
    return str(value).strip()


def normalize_key(value: Any) -> str:
    text = clean_text(value).lower()
    return re.sub(r"[^a-z0-9]+", "_", text).strip("_")


def infer_project_type(work_clean: Any) -> str:
    work = clean_text(work_clean).lower()
    if any(token in work for token in ["samaj", "bhavan", "community", "hall", "trust", "society"]):
        return "Community Infrastructure"
    if any(token in work for token in ["road", "pathway", "drainage", "pcc"]):
        return "Roads and Drainage"
    if any(token in work for token in ["school", "classroom", "college"]):
        return "Education Infrastructure"
    if any(token in work for token in ["light", "solar", "electricity", "high mast"]):
        return "Lighting and Power"
    if any(token in work for token in ["water", "tank", "pipeline", "borewell", "hand pump", "tube-well"]):
        return "Water Supply"
    if any(token in work for token in ["crematorium", "burial"]):
        return "Public Facilities"
    if any(token in work for token in ["furniture", "book", "library"]):
        return "Education Supplies"
    if any(token in work for token in ["repair", "renovation", "maintenance"]):
        return "Repair and Renovation"
    if "bar association" in work:
        return "Bar and Associations"
    return "Normal/Others"


def to_number(value: Any) -> float:
    try:
        if pd.isna(value) or value == "":
            return 0.0
        return float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return 0.0


def to_date(value: Any) -> pd.Timestamp | None:
    parsed = pd.to_datetime(value, errors="coerce")
    if pd.isna(parsed):
        return None
    return parsed


def month_key(value: Any) -> str:
    date = to_date(value)
    if date is None:
        return ""
    return str(date.to_period("M"))


def format_date(value: Any) -> str:
    date = to_date(value)
    if date is None:
        return clean_text(value) or "Unavailable"
    return date.strftime("%d %b %Y")


def format_amount(amount: float) -> str:
    return f"Rs {amount / 100000:.1f}L"


def status_from_level(level: str) -> str:
    level = level.upper()
    if level == "RED":
        return "HIGH RISK"
    if level == "YELLOW":
        return "REVIEW"
    return "VERIFIED"


def anomaly_from_scores(scores: dict[str, float]) -> str:
    thresholded = [
        ("Duplicate", scores["duplicate"], 65),
        ("Overpricing", scores["financial"], 45),
        ("Split Sanction", scores["split"], 60),
    ]
    matches = [(label, score) for label, score, threshold in thresholded if score >= threshold]
    if matches:
        return max(matches, key=lambda item: item[1])[0]
    if scores["pending"] > 0:
        return "Pending Approval"
    return "None"


def prepare_records(workbook_path: Path) -> pd.DataFrame:
    df = pd.read_excel(workbook_path, sheet_name="Mock_Input_Data")
    required = [
        "project_key",
        "mp_name",
        "state",
        "constituency",
        "ida",
        "category",
        "work_clean",
        "locality",
        "ward",
        "recommended_date",
        "sanction_date",
        "status",
        "ida_approval",
        "allocation_amount_numeric",
    ]
    missing = [column for column in required if column not in df.columns]
    if missing:
        raise ValueError(f"Workbook is missing required columns: {missing}")

    df = df[required].copy()
    for column in required:
        if column != "allocation_amount_numeric":
            df[column] = df[column].map(clean_text)
    df["allocation_amount_numeric"] = df["allocation_amount_numeric"].map(to_number)
    return df


def build_reference_frame(train_predictions_path: Path, mock: pd.DataFrame) -> pd.DataFrame:
    train = pd.read_csv(train_predictions_path, dtype=str).fillna("")
    columns = [
        "project_key",
        "mp_name",
        "state",
        "constituency",
        "ida",
        "category",
        "work_clean",
        "locality",
        "ward",
        "recommended_date",
        "allocation_amount_numeric",
    ]
    train = train[[column for column in columns if column in train.columns]].copy()
    for column in columns:
        if column not in train:
            train[column] = ""
        if column not in mock:
            mock[column] = ""

    train["source_dataset"] = "training"
    mock_ref = mock[columns].copy()
    mock_ref["source_dataset"] = "mock_input"
    ref = pd.concat([train[columns + ["source_dataset"]], mock_ref], ignore_index=True)
    ref["allocation_amount_numeric"] = ref["allocation_amount_numeric"].map(to_number)
    for column in ["mp_name", "state", "constituency", "ida", "category", "work_clean", "locality", "ward"]:
        ref[f"{column}_key"] = ref[column].map(normalize_key)
    ref["work_type"] = ref["work_clean"].map(infer_project_type)
    ref["work_type_key"] = ref["work_type"].map(lambda value: normalize_key(value) if value != "Normal/Others" else "")
    ref["duplicate_location_key"] = (ref["locality"].map(clean_text) + "|" + ref["ward"].map(clean_text)).map(normalize_key)
    ref["recommended_month"] = ref["recommended_date"].map(month_key)
    return ref


def score_mock_records(mock: pd.DataFrame, ref: pd.DataFrame) -> list[dict[str, Any]]:
    category_medians = ref[ref["source_dataset"].eq("training")].groupby("category")["allocation_amount_numeric"].median()
    state_category_medians = (
        ref[ref["source_dataset"].eq("training")]
        .groupby(["state_key", "category"])["allocation_amount_numeric"]
        .median()
    )
    constituency_category_medians = (
        ref[ref["source_dataset"].eq("training")]
        .groupby(["constituency_key", "category"])["allocation_amount_numeric"]
        .median()
    )
    amount_p99 = float(ref[ref["source_dataset"].eq("training")]["allocation_amount_numeric"].quantile(0.99))

    records = []
    for _, row in mock.iterrows():
        amount = to_number(row["allocation_amount_numeric"])
        category = clean_text(row["category"])
        work_type = infer_project_type(row["work_clean"])
        state_key = normalize_key(row["state"])
        constituency_key = normalize_key(row["constituency"])
        work_key = normalize_key(row["work_clean"])
        work_type_key = normalize_key(work_type) if work_type != "Normal/Others" else ""
        locality_key = normalize_key(row["locality"])
        loc_ward_key = normalize_key(f"{row['locality']}|{row['ward']}")
        mp_key = normalize_key(row["mp_name"])
        ida_key = normalize_key(row["ida"])
        recommended_month = month_key(row["recommended_date"])

        category_median = float(category_medians.get(category, 0) or 0)
        state_median = float(state_category_medians.get((state_key, category), 0) or 0)
        constituency_median = float(constituency_category_medians.get((constituency_key, category), 0) or 0)

        ratio_category = amount / category_median if category_median else 0
        ratio_state = amount / state_median if state_median else 0
        ratio_constituency = amount / constituency_median if constituency_median else 0
        strongest_ratio = max(ratio_category, ratio_state, ratio_constituency)

        same_work_loc = ref[(ref["work_clean_key"].eq(work_key)) & (ref["duplicate_location_key"].eq(loc_ward_key))]
        same_category_loc = (
            ref[(ref["work_type_key"].eq(work_type_key)) & (ref["duplicate_location_key"].eq(loc_ward_key))]
            if work_type_key
            else ref.iloc[0:0]
        )
        same_type_month = (
            ref[
                ref["mp_name_key"].eq(mp_key)
                & ref["ida_key"].eq(ida_key)
                & ref["work_type_key"].eq(work_type_key)
                & ref["duplicate_location_key"].eq(loc_ward_key)
                & ref["recommended_month"].eq(recommended_month)
            ]
            if work_type_key
            else ref.iloc[0:0]
        )

        near_5_lakh = 450000 <= amount <= 500000
        split_refs = pd.DataFrame()
        current_date = to_date(row["recommended_date"])
        if near_5_lakh and current_date is not None and locality_key:
            ref_dates = pd.to_datetime(ref["recommended_date"], errors="coerce")
            close_dates = (ref_dates - current_date).abs().dt.days.le(7)
            split_refs = ref[
                close_dates
                & ref["duplicate_location_key"].eq(loc_ward_key)
                & ref["allocation_amount_numeric"].between(450000, 500000, inclusive="both")
                & (ref["mp_name_key"].eq(mp_key) | ref["ida_key"].eq(ida_key))
            ]

        same_work_count = len(same_work_loc)
        same_category_count = len(same_category_loc)
        same_type_month_count = len(same_type_month)
        split_count = len(split_refs)

        duplicate_score = min(
            100,
            (65 if same_work_count > 1 else 0)
            + (55 if same_type_month_count > 1 else 0)
            + min(same_work_count, 5) * 3
            + min(same_type_month_count, 5) * 5
            + min(same_category_count, 5) * 2,
        )
        financial_score = min(
            100,
            (45 if strongest_ratio >= 2.5 else 0)
            + (55 if ratio_category >= 4.0 else 0)
            + (15 if amount >= amount_p99 else 0),
        )
        split_score = min(100, (20 if near_5_lakh and locality_key else 0) + (65 if split_count >= 3 else 0))
        pending_score = 45 if row["status"].lower() == "unsanctioned" and "pending" in row["ida_approval"].lower() else 0
        risk = round(0.30 * duplicate_score + 0.35 * financial_score + 0.25 * split_score + 0.10 * pending_score, 2)
        if duplicate_score >= 65 or financial_score >= 45 or split_score >= 60:
            risk = max(risk, 30)
        level = "RED" if risk > 65 else "YELLOW" if risk >= 30 else "GREEN"

        reasons = []
        if duplicate_score >= 65:
            reasons.append(f"{same_work_count} same-work or {same_type_month_count} same-work-type records share locality and ward")
        if financial_score >= 45:
            baseline = constituency_median or state_median or category_median
            reasons.append(f"Amount is {amount / baseline:.2f}x the closest trained median" if baseline else "Amount is high against trained baselines")
        if split_score >= 60:
            reasons.append(f"{split_count} near-Rs-5L records cluster in the same locality and ward")
        if pending_score:
            reasons.append("Project is unsanctioned and IDA approval is pending")
        if not reasons:
            reasons.append("No trained baseline threshold crossed")

        records.append(
            {
                **{column: clean_text(row[column]) if column != "allocation_amount_numeric" else amount for column in mock.columns},
                "model_risk_score": risk,
                "model_risk_level": level,
                "model_duplicate_score": float(duplicate_score),
                "model_financial_score": float(financial_score),
                "model_split_sanction_score": float(split_score),
                "model_pending_score": float(pending_score),
                "model_reasons": reasons,
            }
        )
    return records


def write_frontend_projects(records: list[dict[str, Any]], output_path: Path) -> None:
    projects = []
    for index, record in enumerate(records):
        scores = {
            "duplicate": float(record["model_duplicate_score"]),
            "financial": float(record["model_financial_score"]),
            "split": float(record["model_split_sanction_score"]),
            "pending": float(record["model_pending_score"]),
        }
        level = clean_text(record["model_risk_level"])
        amount = to_number(record["allocation_amount_numeric"])
        locality = clean_text(record["locality"])
        ward = clean_text(record["ward"])
        state = clean_text(record["state"])
        reasons = [clean_text(reason) for reason in record.get("model_reasons", []) if clean_text(reason)]
        projects.append(
            {
                "id": clean_text(record["project_key"]),
                "short": clean_text(record["project_key"])[-8:] or f"MOCK-{index + 1:03d}",
                "title": clean_text(record["work_clean"]) or "Untitled project",
                "location": ", ".join(part for part in [locality, f"Ward {ward}" if ward else "", state] if part),
                "district": locality or "Unknown",
                "constituency": clean_text(record["constituency"]) or "Unknown",
                "amount": format_amount(amount),
                "amountNum": round(amount / 100000, 2),
                "bsr": "Median based",
                "bsrNum": 0,
                "risk": round(float(record["model_risk_score"])),
                "status": status_from_level(level),
                "anomaly": anomaly_from_scores(scores),
                "contractor": "Not provided",
                "agency": clean_text(record["ida"]) or "Unknown",
                "coords": "Coordinates not provided",
                "submitted": format_date(record["recommended_date"]),
                "description": "; ".join(reasons),
                "duplicateScore": round(scores["duplicate"], 2),
                "financialScore": round(scores["financial"], 2),
                "splitSanctionScore": round(scores["split"], 2),
                "pendingScore": round(scores["pending"], 2),
                "reasons": reasons,
            }
        )

    header = """// Generated from backend/data/mock/mplads_mock_input_only.xlsx.
// Run backend/scripts/prepare_frontend_mock_alerts.py after replacing the workbook.

type ProjectStatus = "HIGH RISK" | "REVIEW" | "VERIFIED";
type ProjectAnomaly = "Duplicate" | "Overpricing" | "Split Sanction" | "Pending Approval" | "None";

type Project = {
  id: string;
  short: string;
  title: string;
  location: string;
  district: string;
  constituency: string;
  amount: string;
  amountNum: number;
  bsr: string;
  bsrNum: number;
  risk: number;
  status: ProjectStatus;
  anomaly: ProjectAnomaly;
  contractor: string;
  agency: string;
  coords: string;
  submitted: string;
  description: string;
  duplicateScore: number;
  financialScore: number;
  splitSanctionScore: number;
  pendingScore: number;
  reasons: string[];
};

"""
    body = f"const PROJECTS: Project[] = {json.dumps(projects, indent=2)};\n\n"
    footer = 'type Tab = "home" | "audits" | "judge" | "field";\ntype Filter = "All" | "Duplicates" | "Overpricing" | "Split Sanctions";\n\nexport { PROJECTS };\nexport type { Project, Tab, Filter };\n'
    output_path.write_text(header + body + footer, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare mock MPLADS records for the frontend alert feed.")
    parser.add_argument("--workbook", type=Path, default=DEFAULT_WORKBOOK)
    parser.add_argument("--train-predictions", type=Path, default=DEFAULT_TRAIN_PREDICTIONS)
    parser.add_argument("--json-output", type=Path, default=DEFAULT_JSON_OUTPUT)
    parser.add_argument("--frontend-output", type=Path, default=DEFAULT_FRONTEND_OUTPUT)
    args = parser.parse_args()

    mock = prepare_records(args.workbook)
    ref = build_reference_frame(args.train_predictions, mock)
    records = score_mock_records(mock, ref)

    args.json_output.parent.mkdir(parents=True, exist_ok=True)
    args.json_output.write_text(json.dumps(records, indent=2), encoding="utf-8")
    write_frontend_projects(records, args.frontend_output)
    print(json.dumps({"records": len(records), "json_output": str(args.json_output), "frontend_output": str(args.frontend_output)}, indent=2))


if __name__ == "__main__":
    main()
