from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.schemas.analytics import AnalyticsSummary, PredictionDetail, PredictionListResponse, StateRiskRow
from app.services.prediction_analytics_service import PredictionAnalyticsService


router = APIRouter(prefix="/api/v1", tags=["analytics"])
analytics_service = PredictionAnalyticsService()


def _data_not_ready_error(error: FileNotFoundError) -> HTTPException:
    return HTTPException(
        status_code=503,
        detail={
            "code": "PREDICTIONS_NOT_READY",
            "message": str(error),
            "hint": "Run scripts/train_evaluate_models.py before using analytics endpoints.",
        },
    )


@router.get("/analytics/summary", response_model=AnalyticsSummary)
def analytics_summary() -> AnalyticsSummary:
    try:
        return analytics_service.summary()
    except FileNotFoundError as error:
        raise _data_not_ready_error(error) from None


@router.get("/analytics/state-risk", response_model=list[StateRiskRow])
def state_risk(limit: int = Query(default=20, ge=1, le=100)) -> list[StateRiskRow]:
    try:
        return analytics_service.state_risk(limit=limit)
    except FileNotFoundError as error:
        raise _data_not_ready_error(error) from None


@router.get("/predictions", response_model=PredictionListResponse)
def list_predictions(
    risk_level: str | None = Query(default=None, description="GREEN, YELLOW, or RED"),
    state: str | None = None,
    category: str | None = None,
    mp: str | None = Query(default=None, description="Case-insensitive MP name search"),
    ida: str | None = Query(default=None, description="Case-insensitive implementing agency search"),
    isolation_forest_only: bool = Query(default=False),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> PredictionListResponse:
    try:
        return analytics_service.predictions(
            risk_level=risk_level,
            state=state,
            category=category,
            mp=mp,
            ida=ida,
            isolation_forest_only=isolation_forest_only,
            limit=limit,
            offset=offset,
        )
    except FileNotFoundError as error:
        raise _data_not_ready_error(error) from None


@router.get("/predictions/{project_key}", response_model=PredictionDetail)
def get_prediction(project_key: str) -> PredictionDetail:
    try:
        prediction = analytics_service.prediction_detail(project_key)
    except FileNotFoundError as error:
        raise _data_not_ready_error(error) from None
    if not prediction:
        raise HTTPException(status_code=404, detail={"code": "PREDICTION_NOT_FOUND", "project_key": project_key})
    return prediction
