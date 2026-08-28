from __future__ import annotations

import csv
import tempfile
import unittest
from pathlib import Path

from app.services.prediction_analytics_service import PredictionAnalyticsService


class PredictionAnalyticsServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.predictions_path = Path(self.temp_dir.name) / "test_predictions.csv"
        rows = [
            {
                "project_key": "P-001",
                "mp_name": "Asha MP",
                "state": "Uttar Pradesh",
                "constituency": "Lucknow",
                "ida": "Agency One",
                "category": "Road",
                "work_clean": "Road repair",
                "locality": "Ward 1",
                "recommended_date": "2026-01-01",
                "allocation_amount_numeric": "100000",
                "model_risk_score": "72",
                "model_risk_level": "RED",
                "model_duplicate_score": "70",
                "model_financial_score": "55",
                "model_financial_rule_score": "45",
                "model_financial_isolation_score": "99",
                "model_split_sanction_score": "0",
                "model_pending_score": "0",
                "isolation_forest_risk_score": "99",
                "isolation_forest_anomaly_flag": "true",
                "model_reasons": "Repeated work | Financial pattern is unusual",
            },
            {
                "project_key": "P-002",
                "mp_name": "Bharat MP",
                "state": "Gujarat",
                "constituency": "Ahmedabad",
                "ida": "Agency Two",
                "category": "Water",
                "work_clean": "Water pipeline",
                "locality": "Ward 2",
                "recommended_date": "2026-01-02",
                "allocation_amount_numeric": "200000",
                "model_risk_score": "38",
                "model_risk_level": "YELLOW",
                "model_duplicate_score": "0",
                "model_financial_score": "0",
                "model_financial_rule_score": "0",
                "model_financial_isolation_score": "0",
                "model_split_sanction_score": "70",
                "model_pending_score": "45",
                "isolation_forest_risk_score": "10",
                "isolation_forest_anomaly_flag": "false",
                "model_reasons": "Near Rs 5 lakh cluster appears",
            },
            {
                "project_key": "P-003",
                "mp_name": "Asha MP",
                "state": "Uttar Pradesh",
                "constituency": "Kanpur",
                "ida": "Agency One",
                "category": "Road",
                "work_clean": "School room",
                "locality": "Ward 3",
                "recommended_date": "2026-01-03",
                "allocation_amount_numeric": "300000",
                "model_risk_score": "5",
                "model_risk_level": "GREEN",
                "model_duplicate_score": "0",
                "model_financial_score": "0",
                "model_financial_rule_score": "0",
                "model_financial_isolation_score": "0",
                "model_split_sanction_score": "0",
                "model_pending_score": "0",
                "isolation_forest_risk_score": "20",
                "isolation_forest_anomaly_flag": "false",
                "model_reasons": "No trained baseline threshold crossed",
            },
        ]
        with self.predictions_path.open("w", encoding="utf-8", newline="") as file:
            writer = csv.DictWriter(file, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_summary_counts_dashboard_flags(self) -> None:
        summary = PredictionAnalyticsService(self.predictions_path).summary()

        self.assertEqual(summary.total_projects, 3)
        self.assertEqual(summary.risk_level_counts, {"RED": 1, "YELLOW": 1, "GREEN": 1})
        self.assertEqual(summary.duplicate_count, 1)
        self.assertEqual(summary.financial_anomaly_count, 1)
        self.assertEqual(summary.isolation_forest_anomaly_count, 1)
        self.assertEqual(summary.split_sanction_count, 1)
        self.assertEqual(summary.pending_count, 1)
        self.assertEqual(summary.top_states_by_yellow_red, {"Uttar Pradesh": 1, "Gujarat": 1})

    def test_predictions_support_filters_and_detail_lookup(self) -> None:
        service = PredictionAnalyticsService(self.predictions_path)

        filtered = service.predictions(state="Uttar Pradesh", category="Road", mp="asha", limit=10)
        self.assertEqual(filtered.total, 2)
        self.assertEqual([row.project_key for row in filtered.rows], ["P-001", "P-003"])

        if_only = service.predictions(isolation_forest_only=True)
        self.assertEqual(if_only.total, 1)
        self.assertEqual(if_only.rows[0].project_key, "P-001")

        detail = service.prediction_detail("P-001")
        self.assertIsNotNone(detail)
        self.assertEqual(detail.model_reasons, ["Repeated work", "Financial pattern is unusual"])
        self.assertEqual(detail.raw["ida"], "Agency One")


if __name__ == "__main__":
    unittest.main()
