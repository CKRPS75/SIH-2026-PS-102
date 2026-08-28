from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from joblib import dump, load
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import RobustScaler


FEATURE_COLUMNS = [
    "allocation_amount_numeric",
    "amount_vs_category_median_ratio",
    "amount_vs_state_category_median_ratio",
    "amount_vs_constituency_category_median_ratio",
    "same_work_same_locality_count",
    "same_work_same_block_count",
    "same_work_same_constituency_count",
    "same_mp_same_work_count",
    "same_ida_same_work_count",
    "same_mp_same_day_count",
    "same_ida_same_day_count",
    "same_work_same_day_count",
    "same_ida_locality_7day_sub5l_count",
    "same_mp_locality_7day_sub5l_count",
    "project_amount_as_pct_of_mp_allocation",
    "mp_project_count",
    "ida_project_count",
    "locality_project_count",
]

BOOLEAN_FEATURES = [
    "is_sub_5_lakh",
    "is_near_5_lakh",
    "is_high_value_project",
    "missing_locality_flag",
    "status_unsanctioned_flag",
    "ida_pending_flag",
]

ISOLATION_FOREST_FEATURES = [
    "allocation_amount_numeric",
    "amount_vs_category_median_ratio",
    "amount_vs_state_category_median_ratio",
    "amount_vs_constituency_category_median_ratio",
    "project_amount_as_pct_of_mp_allocation",
    "same_work_same_locality_count",
    "same_work_same_block_count",
    "same_work_same_constituency_count",
    "same_ida_locality_7day_sub5l_count",
    "same_mp_locality_7day_sub5l_count",
    "mp_project_count",
    "ida_project_count",
    "locality_project_count",
]

GENERATED_SCORE_COLUMNS = [
    "model_duplicate_score",
    "model_financial_rule_score",
    "model_financial_isolation_score",
    "model_financial_score",
    "model_split_sanction_score",
    "model_pending_score",
    "model_risk_score",
    "model_risk_level",
    "model_reasons",
    "isolation_forest_raw_score",
    "isolation_forest_risk_score",
    "isolation_forest_anomaly_flag",
]


def to_number(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").fillna(0.0)


def to_bool(series: pd.Series) -> pd.Series:
    return series.astype(str).str.lower().eq("true")


def percentile(values: pd.Series, q: float) -> float:
    return float(np.percentile(to_number(values), q))


def fit_baseline_model(train: pd.DataFrame) -> dict[str, Any]:
    amount = to_number(train["allocation_amount_numeric"])
    model = {
        "model_family": "baseline_rules_plus_trained_thresholds",
        "version": "v0.2-data-baseline",
        "notes": [
            "Thresholds are fitted from the train feature distribution only.",
            "Rule scores are combined with an IsolationForest financial anomaly model.",
            "Weak labels are review targets, not confirmed fraud labels.",
        ],
        "feature_columns": FEATURE_COLUMNS,
        "boolean_features": BOOLEAN_FEATURES,
        "thresholds": {
            "amount_p95": percentile(amount, 95),
            "amount_p99": percentile(amount, 99),
            "state_category_ratio_p95": percentile(train["amount_vs_state_category_median_ratio"], 95),
            "state_category_ratio_p99": percentile(train["amount_vs_state_category_median_ratio"], 99),
            "same_work_locality_p95": percentile(train["same_work_same_locality_count"], 95),
            "split_cluster_p95": percentile(train["same_ida_locality_7day_sub5l_count"], 95),
            "mp_allocation_pct_p95": percentile(train["project_amount_as_pct_of_mp_allocation"], 95),
        },
        "risk_weights": {
            "duplicate": 0.30,
            "financial": 0.35,
            "split_sanction": 0.25,
            "pending": 0.10,
        },
    }
    return model


def numeric_matrix(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    return pd.DataFrame({column: to_number(df[column]) if column in df else 0.0 for column in columns})


def fit_isolation_forest(train: pd.DataFrame) -> dict[str, Any]:
    pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", RobustScaler()),
            (
                "model",
                IsolationForest(
                    n_estimators=200,
                    contamination=0.03,
                    random_state=42,
                    n_jobs=1,
                ),
            ),
        ]
    )
    train_features = numeric_matrix(train, ISOLATION_FOREST_FEATURES)
    pipeline.fit(train_features)
    train_raw_scores = -pipeline.decision_function(train_features)
    return {
        "pipeline": pipeline,
        "feature_columns": ISOLATION_FOREST_FEATURES,
        "train_raw_score_distribution": np.sort(train_raw_scores),
        "metadata": {
            "model_family": "IsolationForest",
            "version": "v0.1-financial-anomaly",
            "feature_columns": ISOLATION_FOREST_FEATURES,
            "n_estimators": 200,
            "contamination": 0.03,
            "random_state": 42,
            "n_jobs": 1,
            "score_direction": "Higher isolation_forest_risk_score means more unusual against train distribution.",
        },
    }


def load_isolation_forest_model(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    return load(path)


def score_isolation_forest(df: pd.DataFrame, bundle: dict[str, Any]) -> pd.DataFrame:
    features = numeric_matrix(df, bundle["feature_columns"])
    raw_scores = -bundle["pipeline"].decision_function(features)
    distribution = bundle["train_raw_score_distribution"]
    risk_scores = np.searchsorted(distribution, raw_scores, side="right") / len(distribution) * 100
    anomaly_flags = bundle["pipeline"].predict(features) == -1
    return pd.DataFrame(
        {
            "isolation_forest_raw_score": np.round(raw_scores, 6),
            "isolation_forest_risk_score": np.round(risk_scores, 2),
            "isolation_forest_anomaly_flag": anomaly_flags,
        },
        index=df.index,
    )


def score_with_model(
    df: pd.DataFrame,
    model: dict[str, Any],
    isolation_forest_bundle: dict[str, Any] | None = None,
) -> pd.DataFrame:
    scored = df.copy()
    scored = scored.drop(columns=[column for column in GENERATED_SCORE_COLUMNS if column in scored], errors="ignore")
    thresholds = model["thresholds"]
    amount = to_number(scored["allocation_amount_numeric"])
    state_ratio = to_number(scored["amount_vs_state_category_median_ratio"])
    category_ratio = to_number(scored["amount_vs_category_median_ratio"])
    locality_repeats = to_number(scored["same_work_same_locality_count"])
    exact_duplicates = to_number(scored["exact_duplicate_group_count"])
    split_7day = to_number(scored["same_ida_locality_7day_sub5l_count"]).combine(
        to_number(scored["same_mp_locality_7day_sub5l_count"]),
        max,
    )
    same_ida_day = to_number(scored["same_ida_same_day_count"])
    has_locality = scored["locality_key"].astype(str).str.len().gt(0)
    mp_allocation_pct = to_number(scored["project_amount_as_pct_of_mp_allocation"])

    duplicate_score = (
        (locality_repeats.gt(1) * 65)
        + (exact_duplicates.gt(1) * 20)
        + (locality_repeats.clip(0, 5) * 3)
    ).clip(0, 100)

    rule_financial_score = (
        (state_ratio.ge(thresholds["state_category_ratio_p95"]) * 45)
        + (state_ratio.ge(thresholds["state_category_ratio_p99"]) * 25)
        + (state_ratio.ge(3.0) * 45)
        + (category_ratio.ge(4.0) * 55)
        + (amount.ge(thresholds["amount_p99"]) * 15)
        + (mp_allocation_pct.ge(thresholds["mp_allocation_pct_p95"]) * 10)
    ).clip(0, 100)

    isolation_forest_risk = pd.Series(0.0, index=scored.index)
    if isolation_forest_bundle:
        if_scores = score_isolation_forest(scored, isolation_forest_bundle)
        scored = pd.concat([scored, if_scores], axis=1)
        isolation_forest_risk = to_number(scored["isolation_forest_risk_score"])
    else:
        scored["isolation_forest_raw_score"] = 0.0
        scored["isolation_forest_risk_score"] = 0.0
        scored["isolation_forest_anomaly_flag"] = False

    isolation_forest_financial_score = isolation_forest_risk.where(isolation_forest_risk.ge(97), 0.0)
    financial_score = pd.concat([rule_financial_score, isolation_forest_financial_score], axis=1).max(axis=1).clip(0, 100)

    split_score = (
        (to_bool(scored["is_near_5_lakh"]) & has_locality).astype(int).mul(20)
        + (
            to_bool(scored["is_near_5_lakh"])
            & has_locality
            & split_7day.ge(3)
        ).astype(int).mul(65)
        + (
            to_bool(scored["is_near_5_lakh"])
            & has_locality
            & same_ida_day.ge(3)
            & split_7day.ge(2)
        ).astype(int).mul(10)
        + (
            to_bool(scored["is_near_5_lakh"])
            & has_locality
            & split_7day.ge(thresholds["split_cluster_p95"])
        ).astype(int).mul(10)
    ).clip(0, 100)

    pending_score = (
        (to_bool(scored["status_unsanctioned_flag"]) & to_bool(scored["ida_pending_flag"]))
        .astype(int)
        .mul(45)
    )

    weights = model["risk_weights"]
    scored["model_duplicate_score"] = duplicate_score.round(2)
    scored["model_financial_rule_score"] = rule_financial_score.round(2)
    scored["model_financial_isolation_score"] = isolation_forest_financial_score.round(2)
    scored["model_financial_score"] = financial_score.round(2)
    scored["model_split_sanction_score"] = split_score.round(2)
    scored["model_pending_score"] = pending_score.round(2)
    scored["model_risk_score"] = (
        weights["duplicate"] * duplicate_score
        + weights["financial"] * financial_score
        + weights["split_sanction"] * split_score
        + weights["pending"] * pending_score
    ).round(2)
    scored["model_risk_score"] = scored["model_risk_score"].where(
        (duplicate_score < 90) & (financial_score < 90) & (split_score < 90),
        scored["model_risk_score"].clip(lower=35),
    )
    scored["model_risk_level"] = pd.cut(
        scored["model_risk_score"],
        bins=[-1, 29.999, 65, 100],
        labels=["GREEN", "YELLOW", "RED"],
    ).astype(str)

    reasons = []
    for _, row in scored.iterrows():
        row_reasons: list[str] = []
        if row["model_duplicate_score"] >= 65:
            row_reasons.append("Repeated work appears in same locality or exact duplicate group")
        if row["model_financial_rule_score"] >= 45:
            row_reasons.append("Allocation amount is high compared with trained category/state distribution")
        if row["isolation_forest_risk_score"] >= 97:
            row_reasons.append("Financial pattern is unusual against the IsolationForest train distribution")
        if row["model_split_sanction_score"] >= 60:
            row_reasons.append("Near Rs 5 lakh cluster appears within a short time window")
        if row["model_pending_score"] > 0:
            row_reasons.append("Project is unsanctioned with action pending")
        if not row_reasons:
            row_reasons.append("No trained baseline threshold crossed")
        reasons.append(" | ".join(row_reasons))
    scored["model_reasons"] = reasons
    return scored


def binary_metrics(df: pd.DataFrame, truth_col: str, score_col: str, threshold: float) -> dict[str, Any]:
    truth = to_bool(df[truth_col])
    pred = to_number(df[score_col]).ge(threshold)
    tp = int((truth & pred).sum())
    fp = int((~truth & pred).sum())
    fn = int((truth & ~pred).sum())
    tn = int((~truth & ~pred).sum())
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    return {
        "truth_column": truth_col,
        "score_column": score_col,
        "threshold": threshold,
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
        "precision_vs_weak_label": round(precision, 4),
        "recall_vs_weak_label": round(recall, 4),
    }


def report_for(scored: pd.DataFrame) -> dict[str, Any]:
    if_anomaly_count = int(scored["isolation_forest_anomaly_flag"].astype(bool).sum())
    if_high_risk_count = int(to_number(scored["isolation_forest_risk_score"]).ge(97).sum())
    extra_if_cases = int(
        (
            to_number(scored["model_financial_rule_score"]).lt(45)
            & to_number(scored["isolation_forest_risk_score"]).ge(97)
        ).sum()
    )
    return {
        "rows": int(len(scored)),
        "risk_level_counts": scored["model_risk_level"].value_counts().to_dict(),
        "mean_model_risk_score": round(float(scored["model_risk_score"].mean()), 2),
        "isolation_forest_anomaly_count": if_anomaly_count,
        "isolation_forest_high_risk_score_count": if_high_risk_count,
        "additional_financial_cases_from_isolation_forest": extra_if_cases,
        "top_state_risk_counts": scored[scored["model_risk_level"].isin(["YELLOW", "RED"])]
        .groupby("state")["project_key"]
        .count()
        .sort_values(ascending=False)
        .head(10)
        .to_dict(),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Train and evaluate baseline MPLADS risk models.")
    parser.add_argument("--input-dir", type=Path, default=Path("data/features"))
    parser.add_argument("--output-dir", type=Path, default=Path("data/model_outputs"))
    args = parser.parse_args()

    train = pd.read_csv(args.input_dir / "projects_train_features.csv", dtype=str).fillna("")
    test = pd.read_csv(args.input_dir / "projects_test_features.csv", dtype=str).fillna("")

    model = fit_baseline_model(train)
    isolation_forest_bundle = fit_isolation_forest(train)
    train_scored = score_with_model(train, model, isolation_forest_bundle)
    test_scored = score_with_model(test, model, isolation_forest_bundle)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    model["isolation_forest"] = isolation_forest_bundle["metadata"]
    (args.output_dir / "baseline_model_metadata.json").write_text(
        json.dumps(model, indent=2),
        encoding="utf-8",
    )
    dump(isolation_forest_bundle, args.output_dir / "isolation_forest_model.joblib")
    train_scored.to_csv(args.output_dir / "train_predictions.csv", index=False)
    test_scored.to_csv(args.output_dir / "test_predictions.csv", index=False)

    evaluation_report = {
        "train": report_for(train_scored),
        "test": report_for(test_scored),
        "weak_label_metrics": {
            "duplicate": binary_metrics(test_scored, "weak_label_duplicate", "model_duplicate_score", 65),
            "cost_outlier_rule_financial": binary_metrics(
                test_scored,
                "weak_label_cost_outlier",
                "model_financial_rule_score",
                45,
            ),
            "cost_outlier_isolation_forest": binary_metrics(
                test_scored,
                "weak_label_cost_outlier",
                "isolation_forest_risk_score",
                97,
            ),
            "cost_outlier_combined_financial": binary_metrics(
                test_scored,
                "weak_label_cost_outlier",
                "model_financial_score",
                45,
            ),
            "split_sanction": binary_metrics(test_scored, "weak_label_split_sanction", "model_split_sanction_score", 60),
            "any_risk": {
                "truth_column": "weak_label_any_risk",
                "prediction_column": "model_risk_level",
                "flagged_levels": ["YELLOW", "RED"],
                **binary_metrics_from_level(test_scored),
            },
        },
        "interpretation": [
            "Metrics compare against weak labels generated from rules, not confirmed fraud outcomes.",
            "Rule financial score remains available for direct explanation.",
            "IsolationForest catches rows that are statistically unusual across multiple numeric project features.",
            "Install sentence-transformers to replace repeated-work heuristics with SBERT semantic matching.",
        ],
    }
    (args.output_dir / "evaluation_report.json").write_text(
        json.dumps(evaluation_report, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(evaluation_report, indent=2))


def binary_metrics_from_level(df: pd.DataFrame) -> dict[str, Any]:
    truth = to_bool(df["weak_label_any_risk"])
    pred = df["model_risk_level"].isin(["YELLOW", "RED"])
    tp = int((truth & pred).sum())
    fp = int((~truth & pred).sum())
    fn = int((truth & ~pred).sum())
    tn = int((~truth & ~pred).sum())
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    return {
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
        "precision_vs_weak_label": round(precision, 4),
        "recall_vs_weak_label": round(recall, 4),
    }


if __name__ == "__main__":
    main()
