from __future__ import annotations

from uuid import uuid4

from app.repositories.in_memory import InMemoryProjectRepository
from app.schemas.project import AuditEvent, ProjectCreate, ProjectRecord


class IngestionService:
    def __init__(self, repository: InMemoryProjectRepository) -> None:
        self.repository = repository

    def create_project(self, payload: ProjectCreate, correlation_id: str | None = None) -> ProjectRecord:
        project = ProjectRecord.model_validate(payload.model_dump())
        created = self.repository.create_project(project)
        if created.id == project.id:
            self.repository.add_audit_event(
                AuditEvent(
                    correlation_id=correlation_id or f"req-{uuid4().hex}",
                    action="PROJECT_CREATED",
                    project_id=created.id,
                    payload={
                        "external_work_id": created.external_work_id,
                        "source": created.source,
                    },
                )
            )
        return created
