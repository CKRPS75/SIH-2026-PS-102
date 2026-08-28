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
