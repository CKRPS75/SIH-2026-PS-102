from __future__ import annotations

from datetime import datetime, timezone

from app.schemas.project import AuditEvent, ProjectRecord, ProjectStatus
from app.schemas.risk import RiskEvaluation


class InMemoryProjectRepository:
    def __init__(self) -> None:
        self.projects: dict[str, ProjectRecord] = {}
        self.external_index: dict[str, str] = {}
        self.evaluations: dict[str, RiskEvaluation] = {}
        self.audit_events: list[AuditEvent] = []

    def create_project(self, project: ProjectRecord) -> ProjectRecord:
        if project.external_work_id and project.external_work_id in self.external_index:
            return self.projects[self.external_index[project.external_work_id]]
        self.projects[project.id] = project
        if project.external_work_id:
            self.external_index[project.external_work_id] = project.id
        return project

    def list_projects(self) -> list[ProjectRecord]:
        return sorted(self.projects.values(), key=lambda item: item.created_at)

    def get_project(self, project_id: str) -> ProjectRecord | None:
        return self.projects.get(project_id)

    def update_project(self, project: ProjectRecord) -> ProjectRecord:
        project.updated_at = datetime.now(timezone.utc)
        self.projects[project.id] = project
        if project.external_work_id:
            self.external_index[project.external_work_id] = project.id
        return project

    def mark_preprocessed(self, project: ProjectRecord, title: str, description: str) -> ProjectRecord:
        project.normalized_title = title
        project.normalized_description = description
        project.status = ProjectStatus.PREPROCESSED
        return self.update_project(project)

    def save_evaluation(self, evaluation: RiskEvaluation) -> RiskEvaluation:
        self.evaluations[evaluation.id] = evaluation
        project = self.projects[evaluation.project_id]
        project.latest_evaluation_id = evaluation.id
        project.status = (
            ProjectStatus.FIELD_AUDIT_REQUIRED
            if evaluation.risk_level == "RED"
            else ProjectStatus.REVIEW_REQUIRED
            if evaluation.risk_level == "YELLOW"
            else ProjectStatus.EVALUATED
        )
        self.update_project(project)
        return evaluation

    def list_evaluations(self) -> list[RiskEvaluation]:
        return sorted(self.evaluations.values(), key=lambda item: item.created_at)

    def add_audit_event(self, event: AuditEvent) -> AuditEvent:
        self.audit_events.append(event)
        return event

    def list_audit_events(self, project_id: str) -> list[AuditEvent]:
        return [event for event in self.audit_events if event.project_id == project_id]


repository = InMemoryProjectRepository()
