from __future__ import annotations

from app.core.config import Settings
from app.graph.collusion_service import CollusionGraphDetector
from app.ml.duplicate_detector import DuplicateDetector
from app.ml.financial_anomaly import FinancialAnomalyDetector
from app.repositories.in_memory import InMemoryProjectRepository
from app.schemas.risk import RiskEvaluation
from app.services.triage_service import RiskScoringService


class EvaluationService:
    def __init__(self, repository: InMemoryProjectRepository, settings: Settings) -> None:
        self.repository = repository
        self.duplicate_detector = DuplicateDetector(settings)
        self.financial_detector = FinancialAnomalyDetector(settings)
        self.graph_detector = CollusionGraphDetector()
        self.scoring_service = RiskScoringService(settings)

    def evaluate(self, project_id: str) -> RiskEvaluation:
        project = self.repository.get_project(project_id)
        if not project:
            raise KeyError(project_id)
        candidates = self.repository.list_projects()
        duplicate = self.duplicate_detector.evaluate(project, candidates)
        cost = self.financial_detector.evaluate(project, candidates)
        graph = self.graph_detector.evaluate(project, candidates)
        evaluation = self.scoring_service.combine(project.id, duplicate, cost, graph)
        self.repository.save_evaluation(evaluation)
        return evaluation
