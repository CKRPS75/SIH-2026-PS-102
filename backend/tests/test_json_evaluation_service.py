from __future__ import annotations

import csv
import tempfile
import unittest
from pathlib import Path

from app.schemas.analytics import ProjectEvaluationInput
from app.services.flash_summarization_service import AuditSummary
from app.services.json_evaluation_service import JsonEvaluationService


class NoopSummarizer:
    def summarize(self, **_: object) -> None:
        return None


class FakeSummarizer:
    def summarize(self, **_: object) -> AuditSummary:
        return AuditSummary(
            comment="This proposal needs checking.",
            reason_description="A similar local work was found, so officials should review it before approval.",
        )


class JsonEvaluationServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.train_predictions_path = Path(self.temp_dir.name) / "train_predictions.csv"
        self.test_predictions_path = Path(self.temp_dir.name) / "test_predictions.csv"
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
        self._write_test_predictions([])

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def _service(self) -> JsonEvaluationService:
        return JsonEvaluationService(
            train_predictions_path=self.train_predictions_path,
            test_predictions_path=self.test_predictions_path,
            isolation_forest_model_path=self.model_path,
            summarization_service=NoopSummarizer(),
        )

    def _write_test_predictions(self, rows: list[dict[str, object]]) -> None:
        fieldnames = [
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
        with self.test_predictions_path.open("w", encoding="utf-8", newline="") as file:
            writer = csv.DictWriter(file, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

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
        self._write_test_predictions([])

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
        self._write_test_predictions([existing_project])
        proposal = {**existing_project, "project_key": "TEST-NEW", "recommended_date": "2026-08-10"}

        result = self._service().evaluate(ProjectEvaluationInput(**proposal))

        self.assertEqual(result.flag, "YELLOW")
        self.assertGreaterEqual(result.component_scores["duplicate"], 65)
        self.assertIn("locality and ward", " ".join(result.reasons).lower())
        self.assertIn("duplicate", result.comment.lower())
        self.assertNotIn("TEST-REF", result.reason_description)
        self.assertEqual(result.references["duplicates"][0].project_key, "Redacted reference")
        self.assertGreaterEqual(result.references["duplicates"][0].similarity, 0.80)

    def test_same_location_different_work_is_not_duplicate(self) -> None:
        existing_project = {
            "project_key": "TEST-ROAD",
            "mp_name": "Demo MP",
            "state": "Maharashtra",
            "constituency": "Mumbai North East",
            "ida": "District Planning Office",
            "category": "Community Infrastructure",
            "work_clean": "Repair of internal road",
            "locality": "Kurla West",
            "ward": "12",
            "block": "Kurla",
            "recommended_date": "2026-08-09",
            "status": "Sanctioned",
            "ida_approval": "Approved",
            "allocation_amount_numeric": 300000,
        }
        self._write_test_predictions([existing_project])
        proposal = {
            **existing_project,
            "project_key": "TEST-EQUIP",
            "work_clean": "Purchase of medical equipment",
            "recommended_date": "2026-08-10",
        }

        result = self._service().evaluate(ProjectEvaluationInput(**proposal))

        self.assertLess(result.component_scores["duplicate"], 65)
        self.assertEqual(result.references["duplicates"], [])

    def test_flash_summary_can_replace_local_comment_and_reason(self) -> None:
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
        self._write_test_predictions([existing_project])
        service = JsonEvaluationService(
            train_predictions_path=self.train_predictions_path,
            test_predictions_path=self.test_predictions_path,
            isolation_forest_model_path=self.model_path,
            summarization_service=FakeSummarizer(),
        )

        result = service.evaluate(ProjectEvaluationInput(**{**existing_project, "project_key": "TEST-NEW"}))

        self.assertEqual(result.comment, "This proposal needs checking.")
        self.assertEqual(
            result.reason_description,
            "A similar local work was found, so officials should review it before approval.",
        )


if __name__ == "__main__":
    unittest.main()
