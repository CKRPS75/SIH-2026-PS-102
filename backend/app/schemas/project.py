from __future__ import annotations

from datetime import date, datetime, timezone
from enum import StrEnum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


class ProjectStatus(StrEnum):
    DRAFT = "DRAFT"
    CREATED = "CREATED"
    PREPROCESSED = "PREPROCESSED"
    EVALUATED = "EVALUATED"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    FIELD_AUDIT_REQUIRED = "FIELD_AUDIT_REQUIRED"


class AgencyInput(BaseModel):
    name: str = Field(..., min_length=1)
    district: str | None = None
    state: str | None = None
    agency_type: str | None = None


class ContractorInput(BaseModel):
    legal_name: str = Field(..., min_length=1)
    directors: list[str] = Field(default_factory=list)
    pan_hash: str | None = None
    gstin_hash: str | None = None
    bank_fingerprint: str | None = None


class LocationInput(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)


class CostItemInput(BaseModel):
    item_code: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    quantity: float = Field(..., gt=0)
    unit: str = Field(..., min_length=1)
    proposed_rate: float = Field(..., ge=0)
    proposed_amount: float | None = Field(default=None, ge=0)
    bsr_rate: float | None = Field(default=None, gt=0)
    bsr_region: str | None = None
    bsr_version: str | None = None

    @field_validator("proposed_amount")
    @classmethod
    def validate_amount(cls, value: float | None) -> float | None:
        return value


class ProjectCreate(BaseModel):
    external_work_id: str | None = None
    title: str = Field(..., min_length=3)
    description: str = Field(..., min_length=3)
    scheme: str = "MPLADS"
    district: str = Field(..., min_length=1)
    state: str | None = None
    agency: AgencyInput
    contractor: ContractorInput
    location: LocationInput
    estimated_cost: float = Field(..., ge=0)
    cost_items: list[CostItemInput] = Field(default_factory=list)
    award_date: date | None = None
    bid_count: int | None = Field(default=None, ge=0)
    source: str = "API"


class ProjectRecord(ProjectCreate):
    id: str = Field(default_factory=lambda: f"P-{uuid4().hex[:10].upper()}")
    status: ProjectStatus = ProjectStatus.CREATED
    normalized_title: str | None = None
    normalized_description: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    latest_evaluation_id: str | None = None


class PolicyFinding(BaseModel):
    code: str
    message: str
    severity: str = "WARNING"


class PreprocessResponse(BaseModel):
    project_id: str
    normalized: bool
    ocr: dict[str, str] = Field(default_factory=lambda: {"status": "NOT_REQUIRED"})
    policy_findings: list[PolicyFinding] = Field(default_factory=list)
    ready_for_evaluation: bool


class AuditEvent(BaseModel):
    id: str = Field(default_factory=lambda: f"AE-{uuid4().hex[:10].upper()}")
    correlation_id: str
    action: str
    actor_id: str = "system"
    project_id: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
