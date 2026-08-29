from __future__ import annotations

import json
import logging
import tempfile
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from app.core.config import settings
from app.demo_data import demo_projects
from app.repositories.in_memory import repository
from app.schemas.project import AuditEvent, PreprocessResponse, ProjectCreate, ProjectRecord
from app.schemas.risk import RiskEvaluation
from app.services.evaluation_service import EvaluationService
from app.services.geotag_verifier import verify_photo_location
from app.services.ingestion_service import IngestionService
from app.services.preprocess_service import PreprocessService


logger = logging.getLogger(__name__)


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


@router.post("/verify-geotag")
async def verify_geotag(
    file: UploadFile = File(..., description="Photo file with EXIF GPS data"),
    project_data: str = Form(..., description="JSON string containing project metadata (e.g., locality, state)"),
    max_distance_meters: float = Form(100.0, description="Maximum acceptable distance in meters"),
) -> dict:
    """
    Verify that an uploaded photo's GPS coordinates match the target project location.

    This endpoint accepts a photo file and project location data, extracts GPS coordinates
    from the photo's EXIF metadata, geocodes the project location, and verifies that the
    photo was taken within the specified distance tolerance.

    Args:
        file: Photo file (JPG, PNG, etc.) with embedded EXIF GPS data.
        project_data: JSON string containing project metadata. Must include at least one of:
                     - locality (e.g., "Kurla West")
                     - constituency (e.g., "Mumbai North East")
                     - state (e.g., "Maharashtra")
                     Example: {"locality": "Kurla West", "constituency": "Mumbai North East", "state": "Maharashtra"}
        max_distance_meters: Maximum acceptable distance between photo and project location in meters.
                           Default is 100 meters.

    Returns:
        dict: Verification result containing:
            - status: "VERIFIED" (within tolerance), "REJECTED" (outside tolerance),
                     or "FAILED" (due to missing data or errors).
            - distance_meters: Measured distance in meters (float or null).
            - photo_coords: GPS coordinates from photo (tuple [lat, lon] or null).
            - target_coords: Geocoded project location (tuple [lat, lon] or null).
            - reason: Descriptive message explaining the verification result.
            - photo_filename: Name of the uploaded photo file.

    Raises:
        HTTPException: 400 Bad Request if project_data is invalid JSON or missing required fields.
        HTTPException: 400 Bad Request if file upload fails.
        HTTPException: 500 Internal Server Error if geotag verification fails unexpectedly.

    Example cURL request:
        curl -X POST "http://localhost:8000/api/v1/verify-geotag" \\
          -F "file=@photo.jpg" \\
          -F "project_data={\"locality\":\"Kurla West\",\"state\":\"Maharashtra\"}" \\
          -F "max_distance_meters=100"

    Example response:
        {
            "status": "VERIFIED",
            "distance_meters": 45.3,
            "photo_coords": [19.0123, 72.8456],
            "target_coords": [19.0125, 72.8460],
            "reason": "Photo location verified within tolerance of 100m.",
            "photo_filename": "photo.jpg"
        }
    """
    try:
        # Step 1: Validate and parse project_data JSON
        try:
            project_metadata = json.loads(project_data)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid project_data JSON: {str(e)}")
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "INVALID_JSON",
                    "message": f"project_data must be valid JSON: {str(e)}",
                },
            ) from e

        # Step 2: Construct location query string from project metadata
        location_parts = []
        if "locality" in project_metadata and project_metadata["locality"]:
            location_parts.append(str(project_metadata["locality"]))
        if "constituency" in project_metadata and project_metadata["constituency"]:
            location_parts.append(str(project_metadata["constituency"]))
        if "state" in project_metadata and project_metadata["state"]:
            location_parts.append(str(project_metadata["state"]))

        if not location_parts:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "MISSING_LOCATION_DATA",
                    "message": "project_data must contain at least one of: locality, constituency, or state",
                },
            )

        location_query = ", ".join(location_parts)
        logger.info(f"Constructed location query: {location_query}")

        # Step 3: Validate file was uploaded
        if not file.filename:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "MISSING_FILE",
                    "message": "No file was uploaded",
                },
            )

        # Step 4: Save uploaded file to temporary location
        temp_dir = tempfile.gettempdir()
        temp_file_path = Path(temp_dir) / f"geotag_verify_{uuid4().hex}_{file.filename}"

        try:
            # Read and save file contents
            file_contents = await file.read()
            if not file_contents:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "code": "EMPTY_FILE",
                        "message": "Uploaded file is empty",
                    },
                )

            with open(temp_file_path, "wb") as f:
                f.write(file_contents)

            logger.info(f"Saved uploaded file to: {temp_file_path}")

        except Exception as e:
            logger.error(f"Failed to save uploaded file: {str(e)}")
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "FILE_SAVE_ERROR",
                    "message": f"Failed to process uploaded file: {str(e)}",
                },
            ) from e

        # Step 5: Verify geotag location
        try:
            verification_result = verify_photo_location(
                image_path=temp_file_path,
                location_query_str=location_query,
                max_distance_meters=max_distance_meters,
            )

            # Add filename to response
            verification_result["photo_filename"] = file.filename

            logger.info(f"Geotag verification result: {verification_result}")
            return verification_result

        finally:
            # Step 6: Clean up temporary file
            try:
                if temp_file_path.exists():
                    temp_file_path.unlink()
                    logger.info(f"Deleted temporary file: {temp_file_path}")
            except Exception as e:
                logger.warning(f"Failed to delete temporary file {temp_file_path}: {e}")

    except HTTPException:
        # Re-raise HTTPExceptions (validation errors)
        raise
    except Exception as e:
        logger.exception(f"Unexpected error in verify-geotag endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "code": "INTERNAL_ERROR",
                "message": f"Unexpected error during geotag verification: {str(e)}",
            },
        ) from e

