from __future__ import annotations

import csv
import json
import tempfile
import unittest
from pathlib import Path

from app.services.json_evaluation_service import JsonEvaluationService
from app.services.mock_live_alert_service import MockLiveAlertService


class NoopSummarizer:
    def summarize(self, **_: object) -> None:
        return None


class MockLiveAlertServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.train_predictions_path = Path(self.temp_dir.name) / "train_predictions.csv"
        self.test_predictions_path = Path(self.temp_dir.name) / "test_predictions.csv"
        self.mock_input_path = Path(self.temp_dir.name) / "mock_input_records.json"
        self.mock_predictions_path = Path(self.temp_dir.name) / "mock_predictions.csv"
        self.missing_mock_predictions_path = Path(self.temp_dir.name) / "missing_mock_predictions.csv"
        self.model_path = Path(self.temp_dir.name) / "missing_model.joblib"

        rows = [
            {
                "project_key": "TRAIN-001",
                "mp_name": "Training MP",
                "state": "Maharashtra",
                "constituency": "Mumbai North East",
                "ida": "District Planning Office",
                "category": "Community Infrastructure",
                "work_clean": "Construction of community hall",
                "locality": "Kurla West",
                "ward": "12",
                "block": "Kurla",
                "recommended_date": "2026-08-01",
                "status": "Sanctioned",
                "ida_approval": "Approved",
                "allocation_amount_numeric": "500000",
            }
        ]
        self._write_csv(self.train_predictions_path, rows)
        self._write_csv(self.test_predictions_path, [])
        self.mock_input_path.write_text(
            json.dumps(
                [
                    {
                        "project_key": "MOCK-001",
                        "mp_name": "Demo MP",
                        "state": "Maharashtra",
                        "constituency": "Mumbai North East",
                        "ida": "District Planning Office",
                        "category": "Community Infrastructure",
                        "work_clean": "Construction of community hall",
                        "locality": "Kurla West",
                        "ward": "12",
                        "block": "Kurla",
                        "recommended_date": "2026-08-10",
                        "status": "Proposed",
                        "ida_approval": "Pending",
                        "allocation_amount_numeric": 1500000,
                    }
                ]
            ),
            encoding="utf-8",
        )

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def _write_csv(
        self,
        path: Path,
        rows: list[dict[str, object]],
        fieldnames: list[str] | None = None,
    ) -> None:
        default_fieldnames = [
            "project_key",
            "mp_name",
            "state",
            "constituency",
            "ida",
            "category",
            "work_clean",
            "locality",
            "ward",
            "block",
            "recommended_date",
            "status",
            "ida_approval",
            "allocation_amount_numeric",
        ]
        with path.open("w", encoding="utf-8", newline="") as file:
            writer = csv.DictWriter(file, fieldnames=fieldnames or default_fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    def test_mock_live_alerts_are_scored_with_core_evaluator(self) -> None:
        evaluator = JsonEvaluationService(
            train_predictions_path=self.train_predictions_path,
            test_predictions_path=self.test_predictions_path,
            isolation_forest_model_path=self.model_path,
            summarization_service=NoopSummarizer(),
        )
        service = MockLiveAlertService(
            mock_input_path=self.mock_input_path,
            mock_predictions_path=self.missing_mock_predictions_path,
            evaluator=evaluator,
        )

        response = service.live_alerts()

        self.assertEqual(response.total, 1)
        row = response.rows[0]
        self.assertEqual(row.project_key, "MOCK-001")
        self.assertEqual(row.source_dataset, "MOCK_INPUT_EVALUATED")
        self.assertEqual(row.model_risk_level, "YELLOW")
        self.assertGreaterEqual(row.model_financial_score, 45)

    def test_mock_live_alerts_prefer_scored_mock_predictions(self) -> None:
        scored_rows = [
            {
                "project_key": "MOCK-SCORED-001",
                "mp_name": "Demo MP",
                "state": "Maharashtra",
                "constituency": "Mumbai North East",
                "ida": "District Planning Office",
                "category": "Community Infrastructure",
                "work_clean": "Construction of school room",
                "locality": "Kurla West",
                "ward": "12",
                "block": "Kurla",
                "recommended_date": "2026-08-10",
                "status": "Proposed",
                "ida_approval": "Pending",
                "source_dataset": "MOCK_VALIDATION",
                "allocation_amount_numeric": "450000",
                "model_risk_score": "72",
                "model_risk_level": "RED",
                "model_duplicate_score": "82",
                "model_financial_score": "0",
                "model_financial_rule_score": "0",
                "model_financial_isolation_score": "0",
                "model_split_sanction_score": "66",
                "model_pending_score": "45",
                "isolation_forest_risk_score": "10",
                "isolation_forest_anomaly_flag": "false",
                "model_reasons": "Mock duplicate|Mock split",
            }
        ]
        self._write_csv(
            self.mock_predictions_path,
            scored_rows,
            fieldnames=list(scored_rows[0]),
        )
        service = MockLiveAlertService(mock_input_path=self.mock_input_path, mock_predictions_path=self.mock_predictions_path)

        response = service.live_alerts()

        self.assertEqual(response.total, 1)
        row = response.rows[0]
        self.assertEqual(row.project_key, "MOCK-SCORED-001")
        self.assertEqual(row.source_dataset, "MOCK_VALIDATION")
        self.assertEqual(row.model_risk_level, "RED")
        self.assertEqual(row.model_reasons, ["Mock duplicate", "Mock split"])


if __name__ == "__main__":
    unittest.main()
