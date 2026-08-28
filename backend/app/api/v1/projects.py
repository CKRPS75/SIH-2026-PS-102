from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request

from app.core.config import settings
from app.demo_data import demo_projects
from app.repositories.in_memory import repository
from app.schemas.project import AuditEvent, PreprocessResponse, ProjectCreate, ProjectRecord
from app.schemas.risk import RiskEvaluation
from app.services.evaluation_service import EvaluationService
from app.services.ingestion_service import IngestionService
from app.services.preprocess_service import PreprocessService


router = APIRouter(prefix="/api/v1", tags=["projects"])
ingestion_service = IngestionService(repository)
preprocess_service = PreprocessService()
evaluation_service = EvaluationService(repository, settings)


def _correlation_id(request: Request) -> str:
    return request.headers.get("X-Correlation-ID") or f"req-{uuid4().hex}"


@router.post("/demo/seed", response_model=list[ProjectRecord])
def seed_demo_data(request: Request) -> list[ProjectRecord]:
    created = [ingestion_service.create_project(payload, _correlation_id(request)) for payload in demo_projects()]
    return created


@router.post("/projects", response_model=ProjectRecord, status_code=201)
def create_project(payload: ProjectCreate, request: Request) -> ProjectRecord:
    return ingestion_service.create_project(payload, _correlation_id(request))


@router.get("/projects", response_model=list[ProjectRecord])
def list_projects() -> list[ProjectRecord]:
    return repository.list_projects()


@router.get("/projects/{project_id}", response_model=ProjectRecord)
def get_project(project_id: str) -> ProjectRecord:
    project = repository.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail={"code": "PROJECT_NOT_FOUND", "project_id": project_id})
    return project


@router.post("/projects/{project_id}/preprocess", response_model=PreprocessResponse)
def preprocess_project(project_id: str, request: Request) -> PreprocessResponse:
    project = repository.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail={"code": "PROJECT_NOT_FOUND", "project_id": project_id})
    normalized_title, normalized_description, response = preprocess_service.preprocess(project)
    repository.mark_preprocessed(project, normalized_title, normalized_description)
    repository.add_audit_event(
        AuditEvent(
            correlation_id=_correlation_id(request),
            action="PROJECT_PREPROCESSED",
            project_id=project.id,
            payload={"ready_for_evaluation": response.ready_for_evaluation},
        )
    )
    return response


@router.post("/projects/{project_id}/evaluate", response_model=RiskEvaluation)
def evaluate_project(project_id: str, request: Request) -> RiskEvaluation:
    try:
        evaluation = evaluation_service.evaluate(project_id)
    except KeyError:
        raise HTTPException(status_code=404, detail={"code": "PROJECT_NOT_FOUND", "project_id": project_id}) from None
    repository.add_audit_event(
        AuditEvent(
            correlation_id=_correlation_id(request),
            action="PROJECT_EVALUATED",
            project_id=project_id,
            payload={"evaluation_id": evaluation.id, "risk_level": evaluation.risk_level},
        )
    )
    return evaluation


@router.get("/projects/{project_id}/audit", response_model=list[AuditEvent])
def get_audit(project_id: str) -> list[AuditEvent]:
    if not repository.get_project(project_id):
        raise HTTPException(status_code=404, detail={"code": "PROJECT_NOT_FOUND", "project_id": project_id})
    return repository.list_audit_events(project_id)
