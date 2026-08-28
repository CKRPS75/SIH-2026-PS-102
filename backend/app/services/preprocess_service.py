from __future__ import annotations

from app.ml.text import normalize_text
from app.schemas.project import PolicyFinding, PreprocessResponse, ProjectRecord


class PreprocessService:
    def preprocess(self, project: ProjectRecord) -> tuple[str, str, PreprocessResponse]:
        normalized_title = normalize_text(project.title)
        normalized_description = normalize_text(project.description)
        findings = self._policy_findings(project)
        return (
            normalized_title,
            normalized_description,
            PreprocessResponse(
                project_id=project.id,
                normalized=True,
                policy_findings=findings,
                ready_for_evaluation=not any(item.severity == "ERROR" for item in findings),
            ),
        )

    @staticmethod
    def _policy_findings(project: ProjectRecord) -> list[PolicyFinding]:
        findings: list[PolicyFinding] = []
        if project.estimated_cost <= 0:
            findings.append(
                PolicyFinding(
                    code="MISSING_ESTIMATED_COST",
                    message="Estimated cost must be greater than zero for evaluation",
                    severity="ERROR",
                )
            )
        if not project.cost_items:
            findings.append(
                PolicyFinding(
                    code="MISSING_COST_ITEMS",
                    message="No itemized BSR comparison can be performed without cost items",
                    severity="WARNING",
                )
            )
        if not project.award_date:
            findings.append(
                PolicyFinding(
                    code="MISSING_AWARD_DATE",
                    message="Split-sanction checks are weaker without an award date",
                    severity="WARNING",
                )
            )
        return findings
