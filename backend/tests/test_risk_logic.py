from __future__ import annotations

import unittest

from app.core.config import Settings
from app.demo_data import demo_projects
from app.repositories.in_memory import InMemoryProjectRepository
from app.services.evaluation_service import EvaluationService
from app.services.ingestion_service import IngestionService


class RiskLogicTest(unittest.TestCase):
    def setUp(self) -> None:
        self.repository = InMemoryProjectRepository()
        self.ingestion = IngestionService(self.repository)
        self.evaluation = EvaluationService(self.repository, Settings())

    def seed(self) -> dict[str, str]:
        ids = {}
        for payload in demo_projects():
            project = self.ingestion.create_project(payload)
            ids[payload.external_work_id or project.id] = project.id
        return ids

    def test_duplicate_project_crosses_duplicate_threshold(self) -> None:
        ids = self.seed()
        result = self.evaluation.evaluate(ids["MPLADS-DEMO-003"])
        self.assertGreaterEqual(result.duplicate.duplicate_score, 82)
        self.assertTrue(result.duplicate.alert)
        self.assertIn("similar", result.reasons[0])

    def test_overpriced_drainage_returns_red_risk(self) -> None:
        ids = self.seed()
        result = self.evaluation.evaluate(ids["MPLADS-DEMO-002"])
        self.assertEqual(result.cost.bsr_risk, 100)
        self.assertEqual(result.risk_level, "YELLOW")
        self.assertTrue(any(finding.type == "BSR_OUTLIER" for finding in result.cost.findings))

    def test_split_sanction_cluster_is_flagged(self) -> None:
        ids = self.seed()
        result = self.evaluation.evaluate(ids["MPLADS-DEMO-006"])
        self.assertGreaterEqual(result.cost.split_risk, 85)
        self.assertTrue(any(finding.type == "SPLIT_SANCTION_CLUSTER" for finding in result.cost.findings))

    def test_external_work_id_is_idempotent(self) -> None:
        payload = demo_projects()[0]
        first = self.ingestion.create_project(payload)
        second = self.ingestion.create_project(payload)
        self.assertEqual(first.id, second.id)
        self.assertEqual(len(self.repository.list_projects()), 1)


if __name__ == "__main__":
    unittest.main()
