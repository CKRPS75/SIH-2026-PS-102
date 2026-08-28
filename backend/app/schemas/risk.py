from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


class RiskLevel(StrEnum):
    GREEN = "GREEN"
    YELLOW = "YELLOW"
    RED = "RED"


class DuplicateMatch(BaseModel):
    project_id: str
    title: str
    distance_m: float
    similarity: float


class DuplicateResult(BaseModel):
    duplicate_score: float
    alert: bool
    threshold: float
    matches: list[DuplicateMatch] = Field(default_factory=list)
    reason: str | None = None


class CostFinding(BaseModel):
    type: str
    message: str
    evidence: dict[str, Any] = Field(default_factory=dict)


class CostRiskResult(BaseModel):
    cost_score: float
    bsr_risk: float
    split_risk: float
    findings: list[CostFinding] = Field(default_factory=list)


class GraphPattern(BaseModel):
    type: str
    message: str
    evidence: dict[str, Any] = Field(default_factory=dict)


class GraphRiskResult(BaseModel):
    graph_score: float
    patterns: list[GraphPattern] = Field(default_factory=list)


class RiskEvaluation(BaseModel):
    id: str = Field(default_factory=lambda: f"EV-{uuid4().hex[:10].upper()}")
    project_id: str
    duplicate: DuplicateResult
    cost: CostRiskResult
    graph: GraphRiskResult
    final_score: float
    risk_level: RiskLevel
    required_action: str
    reasons: list[str] = Field(default_factory=list)
    model_versions: dict[str, str] = Field(default_factory=dict)
    scoring_policy_version: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
