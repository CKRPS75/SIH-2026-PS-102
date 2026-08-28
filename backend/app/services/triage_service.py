from __future__ import annotations

from app.core.config import Settings
from app.schemas.risk import CostRiskResult, DuplicateResult, GraphRiskResult, RiskEvaluation, RiskLevel


class RiskScoringService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def combine(
        self,
        project_id: str,
        duplicate: DuplicateResult,
        cost: CostRiskResult,
        graph: GraphRiskResult,
    ) -> RiskEvaluation:
        final_score = (
            self.settings.risk_weight_duplicate * duplicate.duplicate_score
            + self.settings.risk_weight_cost * cost.cost_score
            + self.settings.risk_weight_graph * graph.graph_score
        )
        final_score = round(final_score, 2)
        level = self._risk_level(final_score)
        return RiskEvaluation(
            project_id=project_id,
            duplicate=duplicate,
            cost=cost,
            graph=graph,
            final_score=final_score,
            risk_level=level,
            required_action=self._required_action(level),
            reasons=self._reasons(duplicate, cost, graph),
            model_versions={
                "duplicate": self.settings.model_version,
                "financial": self.settings.model_version,
                "graph": self.settings.model_version,
            },
            scoring_policy_version=self.settings.scoring_policy_version,
        )

    def _risk_level(self, final_score: float) -> RiskLevel:
        if final_score < self.settings.risk_green_max:
            return RiskLevel.GREEN
        if final_score > self.settings.risk_red_min:
            return RiskLevel.RED
        return RiskLevel.YELLOW

    @staticmethod
    def _required_action(level: RiskLevel) -> str:
        if level == RiskLevel.RED:
            return "FIELD_AUDIT"
        if level == RiskLevel.YELLOW:
            return "ADMIN_REVIEW"
        return "NORMAL_TRACKING"

    @staticmethod
    def _reasons(duplicate: DuplicateResult, cost: CostRiskResult, graph: GraphRiskResult) -> list[str]:
        reasons: list[str] = []
        if duplicate.reason:
            reasons.append(duplicate.reason)
        reasons.extend(finding.message for finding in cost.findings)
        reasons.extend(pattern.message for pattern in graph.patterns)
        if not reasons:
            reasons.append("No configured anomaly threshold crossed")
        return reasons
