from __future__ import annotations

import csv
import json
import tempfile
import unittest
from pathlib import Path

from app.schemas.analytics import ProjectEvaluationInput
from app.services.json_evaluation_service import JsonEvaluationService


class JsonEvaluationServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.train_predictions_path = Path(self.temp_dir.name) / "train_predictions.csv"
        self.mock_records_path = Path(self.temp_dir.name) / "mock_records.json"
        self.model_path = Path(self.temp_dir.name) / "missing_model.joblib"

        train_rows = [
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
                "recommended_date": "2026-08-01",
                "allocation_amount_numeric": "500000",
            }
        ]
        with self.train_predictions_path.open("w", encoding="utf-8", newline="") as file:
            writer = csv.DictWriter(file, fieldnames=list(train_rows[0]))
            writer.writeheader()
            writer.writerows(train_rows)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def _service(self) -> JsonEvaluationService:
        return JsonEvaluationService(
            train_predictions_path=self.train_predictions_path,
            mock_records_path=self.mock_records_path,
            isolation_forest_model_path=self.model_path,
        )

    def test_json_case_does_not_match_its_own_reference_record(self) -> None:
        proposal = {
            "project_key": "TEST-001",
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
            "status": "Sanctioned",
            "ida_approval": "Approved",
            "allocation_amount_numeric": 300000,
        }
        self.mock_records_path.write_text(json.dumps([proposal]), encoding="utf-8")

        result = self._service().evaluate(ProjectEvaluationInput(**proposal))

        self.assertEqual(result.flag, "GREEN")
        self.assertLess(result.component_scores["duplicate"], 65)
        self.assertNotIn("locality and ward", " ".join(result.reasons).lower())

    def test_json_case_matches_different_project_with_same_work_locality_and_ward(self) -> None:
        existing_project = {
            "project_key": "TEST-REF",
            "mp_name": "Demo MP",
            "state": "Maharashtra",
            "constituency": "Mumbai North East",
            "ida": "District Planning Office",
            "category": "Community Infrastructure",
            "work_clean": "Construction of school room",
            "locality": "Kurla West",
            "ward": "12",
            "block": "Kurla",
            "recommended_date": "2026-08-09",
            "status": "Sanctioned",
            "ida_approval": "Approved",
            "allocation_amount_numeric": 300000,
        }
        self.mock_records_path.write_text(json.dumps([existing_project]), encoding="utf-8")
        proposal = {**existing_project, "project_key": "TEST-NEW", "recommended_date": "2026-08-10"}

        result = self._service().evaluate(ProjectEvaluationInput(**proposal))

        self.assertEqual(result.flag, "YELLOW")
        self.assertGreaterEqual(result.component_scores["duplicate"], 65)
        self.assertIn("locality and ward", " ".join(result.reasons).lower())
        self.assertIn("duplicate", result.comment.lower())


if __name__ == "__main__":
    unittest.main()
