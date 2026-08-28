from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class AnalyticsSummary(BaseModel):
    total_projects: int
    total_allocation_amount: float
    risk_level_counts: dict[str, int]
    duplicate_count: int
    financial_anomaly_count: int
    isolation_forest_anomaly_count: int
    split_sanction_count: int
    pending_count: int
    top_states_by_yellow_red: dict[str, int]
    generated_from: str


class StateRiskRow(BaseModel):
    state: str
    total_projects: int
    green_count: int
    yellow_count: int
    red_count: int
    total_allocation_amount: float
    mean_model_risk_score: float
    duplicate_count: int
    financial_anomaly_count: int
    isolation_forest_anomaly_count: int
    split_sanction_count: int
    pending_count: int


class PredictionRow(BaseModel):
    project_key: str
    mp_name: str | None = None
    state: str | None = None
    constituency: str | None = None
    ida: str | None = None
    category: str | None = None
    work_clean: str | None = None
    locality: str | None = None
    recommended_date: str | None = None
    allocation_amount_numeric: float = 0.0
    model_risk_score: float = 0.0
    model_risk_level: str = "GREEN"
    model_duplicate_score: float = 0.0
    model_financial_score: float = 0.0
    model_financial_rule_score: float = 0.0
    model_financial_isolation_score: float = 0.0
    model_split_sanction_score: float = 0.0
    model_pending_score: float = 0.0
    isolation_forest_risk_score: float = 0.0
    isolation_forest_anomaly_flag: bool = False
    model_reasons: list[str] = Field(default_factory=list)


class PredictionDetail(PredictionRow):
    raw: dict[str, Any] = Field(default_factory=dict)


class PredictionListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    rows: list[PredictionRow]


class ProjectEvaluationInput(BaseModel):
    project_key: str = Field(default="LIVE-JSON")
    mp_name: str = ""
    state: str = ""
    constituency: str = ""
    ida: str = ""
    category: str = ""
    work_clean: str
    locality: str = ""
    ward: str = ""
    block: str = ""
    recommended_date: str = ""
    sanction_date: str = ""
    status: str = ""
    ida_approval: str = ""
    allocation_amount_numeric: float


class EvaluationReference(BaseModel):
    project_key: str
    work_clean: str
    amount: float
    state: str | None = None
    constituency: str | None = None
    locality: str | None = None
    ward: str | None = None
    recommended_date: str | None = None
    source_dataset: str
    match_type: str


class JsonEvaluationResponse(BaseModel):
    project_key: str
    flag: str
    flag_color: str
    rating: float = Field(description="Risk rating on a 0 to 10 scale.")
    risk_score: float = Field(description="Internal 0 to 100 score retained for analytics.")
    comment: str
    reason_description: str
    reasons: list[str]
    component_scores: dict[str, float]
    median_context: dict[str, float]
    ratio_context: dict[str, float]
    references: dict[str, list[EvaluationReference]]
