from __future__ import annotations

from datetime import timedelta

from app.core.config import Settings
from app.ml.geo import haversine_distance_m
from app.schemas.project import ProjectRecord
from app.schemas.risk import CostFinding, CostRiskResult


class FinancialAnomalyDetector:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def evaluate(self, project: ProjectRecord, candidates: list[ProjectRecord]) -> CostRiskResult:
        bsr_risk, bsr_findings = self._evaluate_bsr(project)
        split_risk, split_findings = self._evaluate_split_sanctions(project, candidates)
        score = max(bsr_risk, split_risk)
        return CostRiskResult(
            cost_score=round(score, 2),
            bsr_risk=round(bsr_risk, 2),
            split_risk=round(split_risk, 2),
            findings=bsr_findings + split_findings,
        )

    def _evaluate_bsr(self, project: ProjectRecord) -> tuple[float, list[CostFinding]]:
        findings: list[CostFinding] = []
        max_ratio = 0.0

        for item in project.cost_items:
            if not item.bsr_rate:
                continue
            ratio = item.proposed_rate / item.bsr_rate
            max_ratio = max(max_ratio, ratio)
            if ratio >= self.settings.bsr_ratio_alert_threshold:
                expected_amount = item.bsr_rate * item.quantity
                proposed_amount = item.proposed_amount or item.proposed_rate * item.quantity
                findings.append(
                    CostFinding(
                        type="BSR_OUTLIER",
                        message=f"{item.item_code} proposed rate is {ratio:.2f}x the BSR rate",
                        evidence={
                            "item_code": item.item_code,
                            "proposed_rate": item.proposed_rate,
                            "bsr_rate": item.bsr_rate,
                            "ratio": round(ratio, 2),
                            "estimated_excess_amount": round(max(proposed_amount - expected_amount, 0), 2),
                        },
                    )
                )

        risk = self._ratio_to_risk(max_ratio)
        return risk, findings

    def _evaluate_split_sanctions(
        self, project: ProjectRecord, candidates: list[ProjectRecord]
    ) -> tuple[float, list[CostFinding]]:
        if not project.award_date:
            return 0.0, []
        if project.estimated_cost >= self.settings.split_sanction_amount_limit:
            return 0.0, []

        related: list[str] = []
        for candidate in candidates:
            if candidate.id == project.id or not candidate.award_date:
                continue
            if candidate.estimated_cost >= self.settings.split_sanction_amount_limit:
                continue
            if candidate.contractor.legal_name.strip().lower() != project.contractor.legal_name.strip().lower():
                continue
            if candidate.agency.name.strip().lower() != project.agency.name.strip().lower():
                continue
            if abs((candidate.award_date - project.award_date).days) > self.settings.split_sanction_window_days:
                continue
            distance_m = haversine_distance_m(
                project.location.lat,
                project.location.lng,
                candidate.location.lat,
                candidate.location.lng,
            )
            if distance_m <= self.settings.duplicate_radius_km * 1000:
                related.append(candidate.id)

        if len(related) < 2:
            return 0.0, []

        clustered_value = project.estimated_cost + sum(
            candidate.estimated_cost for candidate in candidates if candidate.id in related
        )
        finding = CostFinding(
            type="SPLIT_SANCTION_CLUSTER",
            message="Multiple sub-threshold awards to the same contractor and agency in a short window",
            evidence={
                "project_ids": [project.id] + related,
                "clustered_value": clustered_value,
                "window_days": self.settings.split_sanction_window_days,
            },
        )
        return 85.0, [finding]

    @staticmethod
    def _ratio_to_risk(ratio: float) -> float:
        if ratio <= 1.0:
            return 0.0
        if ratio >= 3.0:
            return 100.0
        return min(100.0, ((ratio - 1.0) / 2.0) * 100.0)
