from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd


PROJECT_TRAIN = "projects_train_normalized.csv"
PROJECT_TEST = "projects_test_normalized.csv"
ALLOC_TRAIN = "mp_allocations_train_normalized.csv"
ALLOC_TEST = "mp_allocations_test_normalized.csv"


def load_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, dtype=str).fillna("")


def to_number(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series.astype(str).str.replace(",", "", regex=False), errors="coerce").fillna(0.0)


def to_date(series: pd.Series) -> pd.Series:
    return pd.to_datetime(series, errors="coerce")


def yes_no_mask(mask: pd.Series) -> pd.Series:
    return mask.fillna(False).map(lambda value: "true" if bool(value) else "false")


def safe_ratio(numerator: pd.Series, denominator: pd.Series) -> pd.Series:
    denominator = denominator.replace(0, pd.NA)
    return (numerator / denominator).fillna(0.0).round(4)


def first_numeric_by_group(df: pd.DataFrame, key: str, value: str) -> pd.Series:
    return df.groupby(key)[value].transform("median").replace(0, pd.NA)


def add_group_count(df: pd.DataFrame, columns: list[str], output: str) -> None:
    populated = df[columns].apply(lambda row: all(str(item).strip() for item in row), axis=1)
    counts = df.groupby(columns, dropna=False)[columns[0]].transform("count")
    df[output] = counts.where(populated, 0).astype(int)


def build_allocation_lookup(allocations: pd.DataFrame) -> pd.DataFrame:
    allocations = allocations.copy()
    allocations["allocated_amount_numeric"] = to_number(allocations["allocated_amount"])
    allocations = allocations[allocations["mp_key"].astype(bool)]
    allocations = allocations.sort_values("allocated_amount_numeric", ascending=False)
    return allocations.drop_duplicates(["mp_key", "state_key"], keep="first")[
        ["mp_key", "state_key", "allocated_amount_numeric"]
    ].rename(columns={"allocated_amount_numeric": "mp_allocated_amount"})


def add_temporal_cluster_counts(df: pd.DataFrame) -> None:
    df["recommended_date_dt"] = to_date(df["recommended_date"])
    df["same_ida_locality_7day_sub5l_count"] = 0
    df["same_mp_locality_7day_sub5l_count"] = 0

    valid = df[
        (df["recommended_date_dt"].notna())
        & (df["is_sub_5_lakh_bool"])
        & (df["locality_key"].astype(bool))
    ].copy()
    if valid.empty:
        return

    for output, keys in [
        ("same_ida_locality_7day_sub5l_count", ["ida_key", "locality_key"]),
        ("same_mp_locality_7day_sub5l_count", ["mp_key", "locality_key"]),
    ]:
        counts = pd.Series(0, index=valid.index, dtype=int)
        for _, group in valid.groupby(keys, dropna=False):
            dates = group["recommended_date_dt"].sort_values()
            for row_index, row_date in dates.items():
                low = row_date - pd.Timedelta(days=7)
                high = row_date + pd.Timedelta(days=7)
                counts.loc[row_index] = int(((dates >= low) & (dates <= high)).sum())
        df.loc[counts.index, output] = counts


def add_features(
    projects: pd.DataFrame,
    allocation_lookup: pd.DataFrame,
    train_reference: pd.DataFrame,
    state_category_medians: pd.Series,
    category_medians: pd.Series,
    constituency_category_medians: pd.Series,
) -> pd.DataFrame:
    df = projects.copy()
    df["allocation_amount_numeric"] = to_number(df["allocation_amount"])
    df["recommended_date_dt"] = to_date(df["recommended_date"])
    df["recommended_month"] = df["recommended_date_dt"].dt.to_period("M").astype(str).replace("NaT", "")
    df["recommended_year"] = df["recommended_date_dt"].dt.year.fillna(0).astype(int)

    df = df.merge(allocation_lookup, how="left", on=["mp_key", "state_key"])
    df["mp_allocated_amount"] = df["mp_allocated_amount"].fillna(0.0)
    df["project_amount_as_pct_of_mp_allocation"] = safe_ratio(
        df["allocation_amount_numeric"], df["mp_allocated_amount"]
    )

    ref = train_reference.copy()
    ref["allocation_amount_numeric"] = to_number(ref["allocation_amount"])

    mp_stats = ref.groupby("mp_key", dropna=False)["allocation_amount_numeric"].agg(
        mp_project_count="count",
        mp_total_recommended_amount="sum",
    )
    ida_stats = ref.groupby("ida_key", dropna=False)["allocation_amount_numeric"].agg(
        ida_project_count="count",
        ida_total_recommended_amount="sum",
    )
    state_stats = ref.groupby("state_key", dropna=False)["allocation_amount_numeric"].agg(
        state_project_count="count",
        state_total_recommended_amount="sum",
    )
    constituency_stats = ref.groupby("constituency_key", dropna=False)["allocation_amount_numeric"].agg(
        constituency_project_count="count",
        constituency_total_recommended_amount="sum",
    )

    df = df.merge(mp_stats, how="left", left_on="mp_key", right_index=True)
    df = df.merge(ida_stats, how="left", left_on="ida_key", right_index=True)
    df = df.merge(state_stats, how="left", left_on="state_key", right_index=True)
    df = df.merge(constituency_stats, how="left", left_on="constituency_key", right_index=True)

    stat_cols = [
        "mp_project_count",
        "mp_total_recommended_amount",
        "ida_project_count",
        "ida_total_recommended_amount",
        "state_project_count",
        "state_total_recommended_amount",
        "constituency_project_count",
        "constituency_total_recommended_amount",
    ]
    df[stat_cols] = df[stat_cols].fillna(0.0)
    df["mp_remaining_estimated_allocation"] = (
        df["mp_allocated_amount"] - df["mp_total_recommended_amount"]
    ).round(2)

    for columns, output in [
        (["work_key", "locality_key"], "same_work_same_locality_count"),
        (["work_key", "block"], "same_work_same_block_count"),
        (["work_key", "constituency_key"], "same_work_same_constituency_count"),
        (["mp_key", "work_key"], "same_mp_same_work_count"),
        (["ida_key", "work_key"], "same_ida_same_work_count"),
        (["mp_key", "recommended_date"], "same_mp_same_day_count"),
        (["ida_key", "recommended_date"], "same_ida_same_day_count"),
        (["work_key", "recommended_date"], "same_work_same_day_count"),
        (["locality_key"], "locality_project_count"),
    ]:
        add_group_count(df, columns, output)

    df["is_sub_5_lakh_bool"] = df["allocation_amount_numeric"].lt(500000)
    df["is_near_5_lakh_bool"] = df["allocation_amount_numeric"].between(450000, 500000, inclusive="both")
    df["is_high_value_project_bool"] = df["allocation_amount_numeric"].ge(2_500_000)
    add_temporal_cluster_counts(df)

    df["category_median_amount"] = df["category"].map(category_medians).fillna(0.0)
    df["state_category_median_amount"] = (
        df.set_index(["state_key", "category"]).index.map(state_category_medians).fillna(0.0)
    )
    df["constituency_category_median_amount"] = (
        df.set_index(["constituency_key", "category"]).index.map(constituency_category_medians).fillna(0.0)
    )
    df["amount_vs_category_median_ratio"] = safe_ratio(df["allocation_amount_numeric"], df["category_median_amount"])
    df["amount_vs_state_category_median_ratio"] = safe_ratio(
        df["allocation_amount_numeric"], df["state_category_median_amount"]
    )
    df["amount_vs_constituency_category_median_ratio"] = safe_ratio(
        df["allocation_amount_numeric"], df["constituency_category_median_amount"]
    )

    df["missing_locality_flag"] = yes_no_mask(~df["locality_key"].astype(bool))
    df["status_unsanctioned_flag"] = yes_no_mask(df["status"].str.lower().eq("unsanctioned"))
    df["ida_pending_flag"] = yes_no_mask(df["ida_approval"].str.lower().str.contains("pending", na=False))
    df["is_sub_5_lakh"] = yes_no_mask(df["is_sub_5_lakh_bool"])
    df["is_near_5_lakh"] = yes_no_mask(df["is_near_5_lakh_bool"])
    df["is_high_value_project"] = yes_no_mask(df["is_high_value_project_bool"])

    df["possible_text_duplicate"] = yes_no_mask(
        (df["same_work_same_locality_count"] > 1)
        | (df["is_exact_duplicate_candidate"].str.lower().eq("true"))
    )
    df["possible_cost_outlier"] = yes_no_mask(
        (df["amount_vs_state_category_median_ratio"] >= 3.0)
        | (df["amount_vs_category_median_ratio"] >= 4.0)
        | (df["is_high_value_project_bool"] & (df["amount_vs_state_category_median_ratio"] >= 2.0))
    )
    df["possible_split_sanction"] = yes_no_mask(
        df["is_near_5_lakh_bool"]
        & df["locality_key"].astype(bool)
        & (
            (df["same_ida_locality_7day_sub5l_count"] >= 3)
            | (df["same_mp_locality_7day_sub5l_count"] >= 3)
        )
    )
    df["possible_pending_risk"] = yes_no_mask(
        df["status_unsanctioned_flag"].eq("true") & df["ida_pending_flag"].eq("true")
    )

    df["duplicate_risk_score"] = (
        (df["possible_text_duplicate"].eq("true") * 65)
        + (df["same_work_same_locality_count"].clip(0, 5) * 7)
        + (pd.to_numeric(df["exact_duplicate_group_count"], errors="coerce").fillna(0).clip(0, 5) * 3)
    ).clip(0, 100)
    df["cost_risk_score"] = (
        (df["possible_cost_outlier"].eq("true") * 75)
        + ((df["amount_vs_state_category_median_ratio"] - 1).clip(0, 5) * 5)
    ).clip(0, 100).round(2)
    df["split_sanction_risk_score"] = (
        (df["possible_split_sanction"].eq("true") * 85)
        + (
            df["is_near_5_lakh_bool"]
            & df["locality_key"].astype(bool)
            & (df["same_ida_locality_7day_sub5l_count"] >= 2)
        )
        * 10
    ).clip(0, 100)
    df["pending_risk_score"] = (df["possible_pending_risk"].eq("true") * 35).astype(int)

    df["risk_score_rule_based"] = (
        0.35 * df["duplicate_risk_score"]
        + 0.35 * df["cost_risk_score"]
        + 0.20 * df["split_sanction_risk_score"]
        + 0.10 * df["pending_risk_score"]
    ).round(2)
    df["risk_level_rule_based"] = pd.cut(
        df["risk_score_rule_based"],
        bins=[-1, 29.999, 65, 100],
        labels=["GREEN", "YELLOW", "RED"],
    ).astype(str)

    df["weak_label_any_risk"] = yes_no_mask(df["risk_level_rule_based"].isin(["YELLOW", "RED"]))
    df["weak_label_duplicate"] = df["possible_text_duplicate"]
    df["weak_label_cost_outlier"] = df["possible_cost_outlier"]
    df["weak_label_split_sanction"] = df["possible_split_sanction"]
    df["weak_label_pending"] = df["possible_pending_risk"]

    df = df.drop(columns=["recommended_date_dt", "is_sub_5_lakh_bool", "is_near_5_lakh_bool", "is_high_value_project_bool"])
    return df


def feature_summary(df: pd.DataFrame) -> dict[str, object]:
    return {
        "rows": int(len(df)),
        "risk_level_counts": df["risk_level_rule_based"].value_counts().to_dict(),
        "weak_label_counts": {
            "duplicate": int(df["weak_label_duplicate"].eq("true").sum()),
            "cost_outlier": int(df["weak_label_cost_outlier"].eq("true").sum()),
            "split_sanction": int(df["weak_label_split_sanction"].eq("true").sum()),
            "pending": int(df["weak_label_pending"].eq("true").sum()),
            "any_risk": int(df["weak_label_any_risk"].eq("true").sum()),
        },
        "amount_summary": {
            "min": float(df["allocation_amount_numeric"].min()),
            "median": float(df["allocation_amount_numeric"].median()),
            "mean": round(float(df["allocation_amount_numeric"].mean()), 2),
            "max": float(df["allocation_amount_numeric"].max()),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build model-ready features and weak labels.")
    parser.add_argument("--input-dir", type=Path, default=Path("data/processed"))
    parser.add_argument("--output-dir", type=Path, default=Path("data/features"))
    args = parser.parse_args()

    train_projects = load_csv(args.input_dir / PROJECT_TRAIN)
    test_projects = load_csv(args.input_dir / PROJECT_TEST)
    allocations = pd.concat(
        [
            load_csv(args.input_dir / ALLOC_TRAIN),
            load_csv(args.input_dir / ALLOC_TEST),
        ],
        ignore_index=True,
    )
    allocation_lookup = build_allocation_lookup(allocations)

    train_amounts = train_projects.copy()
    train_amounts["allocation_amount_numeric"] = to_number(train_amounts["allocation_amount"])
    category_medians = train_amounts.groupby("category")["allocation_amount_numeric"].median()
    state_category_medians = train_amounts.groupby(["state_key", "category"])["allocation_amount_numeric"].median()
    constituency_category_medians = train_amounts.groupby(["constituency_key", "category"])[
        "allocation_amount_numeric"
    ].median()

    train_features = add_features(
        train_projects,
        allocation_lookup,
        train_projects,
        state_category_medians,
        category_medians,
        constituency_category_medians,
    )
    test_features = add_features(
        test_projects,
        allocation_lookup,
        train_projects,
        state_category_medians,
        category_medians,
        constituency_category_medians,
    )

    args.output_dir.mkdir(parents=True, exist_ok=True)
    train_features.to_csv(args.output_dir / "projects_train_features.csv", index=False)
    test_features.to_csv(args.output_dir / "projects_test_features.csv", index=False)

    report = {
        "train": feature_summary(train_features),
        "test": feature_summary(test_features),
        "feature_notes": [
            "Features are derived from cleaned MPLADS rows and MP allocation limits.",
            "Labels are weak/rule-based review targets, not confirmed fraud labels.",
            "Test amount median ratios are computed from train medians to avoid test leakage.",
            "Geospatial features are intentionally omitted until latitude/longitude are added.",
        ],
        "frontend_metric_candidates": [
            "risk_level_rule_based",
            "risk_score_rule_based",
            "allocation_amount_numeric",
            "state",
            "constituency",
            "category",
            "mp_name_canonical",
            "ida",
            "possible_text_duplicate",
            "possible_cost_outlier",
            "possible_split_sanction",
            "possible_pending_risk",
        ],
    }
    (args.output_dir / "feature_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
