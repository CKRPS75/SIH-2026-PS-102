from __future__ import annotations

import csv
import tempfile
import unittest
from pathlib import Path

from app.services.duplicate_location_analytics_service import DuplicateLocationAnalyticsService


class DuplicateLocationAnalyticsServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.predictions_path = Path(self.temp_dir.name) / "predictions.csv"
        rows = [
            self._row("P-001", "Construction of community hall", "500000"),
            self._row("P-002", "Construction of community hall", "600000"),
            self._row("P-003", "Construction of community hall", "700000"),
            self._row("P-004", "Road repair work", "200000"),
            self._row("P-005", "Water pipeline work", "300000"),
            self._row("P-006", "School room construction", "150000", locality="Small Area"),
            self._row("P-007", "School room construction", "250000", locality="Small Area"),
        ]
        with self.predictions_path.open("w", encoding="utf-8", newline="") as file:
            writer = csv.DictWriter(file, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def _row(
        self,
        project_key: str,
        work_clean: str,
        amount: str,
        *,
        locality: str = "Kurla West",
    ) -> dict[str, str]:
        return {
            "project_key": project_key,
            "state": "Maharashtra",
            "constituency": "Mumbai North East",
            "locality": locality,
            "ward": "12",
            "work_clean": work_clean,
            "recommended_date": "2026-08-10",
            "allocation_amount_numeric": amount,
        }

    def _service(self) -> DuplicateLocationAnalyticsService:
        return DuplicateLocationAnalyticsService(
            prediction_paths=[self.predictions_path],
            sentence_bert_model_name="missing-local-sbert-model",
            use_sentence_bert=False,
        )

    def test_ranked_locations_count_unique_duplicate_candidates(self) -> None:
        result = self._service().ranked_locations(limit=10)

        self.assertEqual(result.similarity_threshold, 0.80)
        self.assertEqual(result.total_locations, 1)
        row = result.rows[0]
        self.assertEqual(row.total_project_count, 5)
        self.assertEqual(row.duplicate_candidate_project_count, 3)
        self.assertEqual(row.duplicate_pair_count, 3)
        self.assertEqual(row.duplicate_rate, 60.0)
        self.assertEqual(row.average_similarity, 1.0)
        self.assertEqual(row.maximum_similarity, 1.0)
        self.assertEqual(row.flagged_allocation_amount, 1800000.0)
        self.assertEqual(row.confidence, "HIGH")
        self.assertEqual(row.embedding_backend, "tf-idf-fallback")

    def test_low_confidence_locations_are_marked_when_included(self) -> None:
        result = self._service().ranked_locations(limit=10, include_low_confidence=True)

        low_confidence = [row for row in result.rows if row.locality == "Small Area"][0]
        self.assertEqual(low_confidence.total_project_count, 2)
        self.assertEqual(low_confidence.confidence, "LOW")
        self.assertEqual(low_confidence.duplicate_rate, 100.0)

    def test_location_detail_returns_underlying_pairs(self) -> None:
        service = self._service()
        location = service.ranked_locations(limit=10).rows[0]

        detail = service.location_detail(location.location_key)

        self.assertIsNotNone(detail)
        assert detail is not None
        self.assertEqual(len(detail.pairs), 3)
        self.assertEqual(detail.pairs[0].pair_label, "Matched pair 1")
        self.assertEqual(detail.pairs[0].similarity, 1.0)


if __name__ == "__main__":
    unittest.main()
