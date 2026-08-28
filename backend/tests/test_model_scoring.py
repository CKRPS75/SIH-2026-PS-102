from __future__ import annotations

import sys
import unittest
from pathlib import Path

import pandas as pd

SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

from train_evaluate_models import score_with_model  # noqa: E402


def minimal_model() -> dict:
    return {
        "thresholds": {
            "amount_p99": 10_000_000,
            "state_category_ratio_p95": 4.0,
            "state_category_ratio_p99": 8.0,
            "split_cluster_p95": 10,
            "mp_allocation_pct_p95": 80,
        },
        "risk_weights": {
            "duplicate": 0.30,
            "financial": 0.35,
            "split_sanction": 0.25,
            "pending": 0.10,
        },
    }


def minimal_project(**overrides: object) -> dict[str, object]:
    row: dict[str, object] = {
        "project_key": "MPLADS-TEST-001",
        "state": "Maharashtra",
        "allocation_amount_numeric": 100_000,
        "amount_vs_category_median_ratio": 0,
        "amount_vs_state_category_median_ratio": 0,
        "amount_vs_constituency_category_median_ratio": 0,
        "same_work_same_locality_count": 0,
        "same_work_same_duplicate_location_count": 0,
        "same_category_same_locality_count": 0,
        "same_category_same_block_count": 0,
        "same_category_same_constituency_count": 0,
        "same_mp_category_locality_count": 0,
        "same_ida_category_locality_count": 0,
        "same_type_location_month_count": 0,
        "duplicate_location_project_count": 0,
        "location_duplicate_group_count": 0,
        "exact_duplicate_group_count": 0,
        "same_ida_locality_7day_sub5l_count": 0,
        "same_mp_locality_7day_sub5l_count": 0,
        "same_ida_same_day_count": 0,
        "locality_key": "",
        "project_amount_as_pct_of_mp_allocation": 0,
        "is_near_5_lakh": "false",
        "status_unsanctioned_flag": "false",
        "ida_pending_flag": "false",
    }
    row.update(overrides)
    return row


class ModelScoringTest(unittest.TestCase):
    def test_single_major_financial_anomaly_becomes_yellow(self) -> None:
        rows = [
            minimal_project(
                amount_vs_state_category_median_ratio=3.0,
            )
        ]

        scored = score_with_model(pd.DataFrame(rows), minimal_model())

        self.assertEqual(float(scored.loc[0, "model_financial_score"]), 45.0)
        self.assertEqual(float(scored.loc[0, "model_risk_score"]), 30.0)
        self.assertEqual(scored.loc[0, "model_risk_level"], "YELLOW")

    def test_supporting_pending_only_signal_can_remain_green(self) -> None:
        rows = [
            minimal_project(
                status_unsanctioned_flag="true",
                ida_pending_flag="true",
            )
        ]

        scored = score_with_model(pd.DataFrame(rows), minimal_model())

        self.assertEqual(float(scored.loc[0, "model_pending_score"]), 45.0)
        self.assertLess(float(scored.loc[0, "model_risk_score"]), 30.0)
        self.assertEqual(scored.loc[0, "model_risk_level"], "GREEN")

    def test_constituency_ratio_crosses_reduced_financial_threshold(self) -> None:
        rows = [
            minimal_project(
                amount_vs_constituency_category_median_ratio=2.5,
            )
        ]

        scored = score_with_model(pd.DataFrame(rows), minimal_model())

        self.assertEqual(float(scored.loc[0, "model_financial_score"]), 45.0)
        self.assertEqual(float(scored.loc[0, "model_risk_score"]), 30.0)
        self.assertEqual(scored.loc[0, "model_risk_level"], "YELLOW")

    def test_same_category_same_locality_duplicate_becomes_yellow(self) -> None:
        rows = [
            minimal_project(
                same_category_same_locality_count=2,
                same_category_same_block_count=2,
                same_type_location_month_count=2,
                same_work_same_duplicate_location_count=0,
                locality_key="kurla_west",
            )
        ]

        scored = score_with_model(pd.DataFrame(rows), minimal_model())

        self.assertEqual(float(scored.loc[0, "model_duplicate_score"]), 71.0)
        self.assertEqual(float(scored.loc[0, "model_risk_score"]), 30.0)
        self.assertEqual(scored.loc[0, "model_risk_level"], "YELLOW")


if __name__ == "__main__":
    unittest.main()
