from __future__ import annotations

import json
import csv
from pathlib import Path
from typing import Any

from app.schemas.analytics import PredictionListResponse, PredictionRow, ProjectEvaluationInput
from app.services.json_evaluation_service import JsonEvaluationService


BASE_DIR = Path(__file__).resolve().parents[2]
DEFAULT_MOCK_INPUT_PATH = BASE_DIR / "data" / "mock" / "mock_input_records.json"
DEFAULT_MOCK_PREDICTIONS_PATH = BASE_DIR / "data" / "mock" / "mock_predictions.csv"


class NoopSummarizationService:
    def summarize(self, **_: object) -> None:
        return None


def _text(value: Any) -> str:
    return str(value or "").strip()


def _number(value: Any) -> float:
    try:
        if value in (None, ""):
            return 0.0
        return float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return 0.0


def _bool(value: Any) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "y"}


class MockLiveAlertService:
    def __init__(
        self,
        *,
        mock_input_path: Path = DEFAULT_MOCK_INPUT_PATH,
        mock_predictions_path: Path = DEFAULT_MOCK_PREDICTIONS_PATH,
        evaluator: JsonEvaluationService | None = None,
    ) -> None:
        self.mock_input_path = mock_input_path
        self.mock_predictions_path = mock_predictions_path
        self.evaluator = evaluator or JsonEvaluationService(summarization_service=NoopSummarizationService())
        self._cache_key: tuple[str, float] | None = None
        self._cache_rows: list[PredictionRow] | None = None

    def live_alerts(self, *, limit: int = 100, offset: int = 0) -> PredictionListResponse:
        rows = self._scored_rows()
        paged = rows[offset : offset + limit]
        return PredictionListResponse(total=len(rows), limit=limit, offset=offset, rows=paged)

    def _scored_rows(self) -> list[PredictionRow]:
        if self.mock_predictions_path.exists():
            return self._scored_prediction_rows()
        return self._evaluate_mock_input_rows()

    def _scored_prediction_rows(self) -> list[PredictionRow]:
        cache_key = ("predictions", self.mock_predictions_path.stat().st_mtime)
        if self._cache_key == cache_key and self._cache_rows is not None:
            return self._cache_rows

        with self.mock_predictions_path.open("r", encoding="utf-8", newline="") as file:
            rows = [self._prediction_row_from_csv(row) for row in csv.DictReader(file)]

        rows.sort(key=lambda row: row.model_risk_score, reverse=True)
        self._cache_key = cache_key
        self._cache_rows = rows
        return rows

    def _evaluate_mock_input_rows(self) -> list[PredictionRow]:
        if not self.mock_input_path.exists():
            raise FileNotFoundError(f"Mock input file not found: {self.mock_input_path}")

        cache_key = ("input", self.mock_input_path.stat().st_mtime)
        if self._cache_key == cache_key and self._cache_rows is not None:
            return self._cache_rows

        with self.mock_input_path.open("r", encoding="utf-8") as file:
            mock_rows = json.load(file)

        scored_rows = [self._score_mock_row(row) for row in mock_rows]
        scored_rows.sort(key=lambda row: row.model_risk_score, reverse=True)
        self._cache_key = cache_key
        self._cache_rows = scored_rows
        return scored_rows

    def _prediction_row_from_csv(self, row: dict[str, Any]) -> PredictionRow:
        reasons = [_text(reason) for reason in _text(row.get("model_reasons")).split("|") if _text(reason)]
        return PredictionRow(
            project_key=_text(row.get("project_key")),
            mp_name=_text(row.get("mp_name")) or None,
            state=_text(row.get("state")) or None,
            constituency=_text(row.get("constituency")) or None,
            ida=_text(row.get("ida")) or None,
            category=_text(row.get("category")) or None,
            work_clean=_text(row.get("work_clean")) or None,
            locality=_text(row.get("locality")) or None,
            ward=_text(row.get("ward")) or None,
            block=_text(row.get("block")) or None,
            recommended_date=_text(row.get("recommended_date")) or None,
            status=_text(row.get("status")) or None,
            ida_approval=_text(row.get("ida_approval")) or None,
            source_dataset=_text(row.get("source_dataset")) or "MOCK_VALIDATION",
            allocation_amount_numeric=_number(row.get("allocation_amount_numeric")),
            model_risk_score=_number(row.get("model_risk_score")),
            model_risk_level=_text(row.get("model_risk_level")) or "GREEN",
            model_duplicate_score=_number(row.get("model_duplicate_score")),
            model_financial_score=_number(row.get("model_financial_score")),
            model_financial_rule_score=_number(row.get("model_financial_rule_score")),
            model_financial_isolation_score=_number(row.get("model_financial_isolation_score")),
            model_split_sanction_score=_number(row.get("model_split_sanction_score")),
            model_pending_score=_number(row.get("model_pending_score")),
            isolation_forest_risk_score=_number(row.get("isolation_forest_risk_score")),
            isolation_forest_anomaly_flag=_bool(row.get("isolation_forest_anomaly_flag")),
            model_reasons=reasons,
        )

    def _score_mock_row(self, row: dict[str, Any]) -> PredictionRow:
        proposal = ProjectEvaluationInput(
            project_key=_text(row.get("project_key")) or "MOCK-LIVE",
            mp_name=_text(row.get("mp_name")),
            state=_text(row.get("state")),
            constituency=_text(row.get("constituency")),
            ida=_text(row.get("ida")),
            category=_text(row.get("category")),
            work_clean=_text(row.get("work_clean")) or "Untitled mock project",
            locality=_text(row.get("locality")),
            ward=_text(row.get("ward")),
            block=_text(row.get("block")),
            recommended_date=_text(row.get("recommended_date")),
            sanction_date=_text(row.get("sanction_date")),
            status=_text(row.get("status")),
            ida_approval=_text(row.get("ida_approval")),
            allocation_amount_numeric=_number(row.get("allocation_amount_numeric")),
        )
        evaluation = self.evaluator.evaluate(proposal)
        component_scores = evaluation.component_scores

        return PredictionRow(
            project_key=proposal.project_key,
            mp_name=proposal.mp_name or None,
            state=proposal.state or None,
            constituency=proposal.constituency or None,
            ida=proposal.ida or None,
            category=proposal.category or None,
            work_clean=proposal.work_clean,
            locality=proposal.locality or None,
            ward=proposal.ward or None,
            block=proposal.block or None,
            recommended_date=proposal.recommended_date or None,
            status=proposal.status or None,
            ida_approval=proposal.ida_approval or None,
            source_dataset="MOCK_INPUT_EVALUATED",
            allocation_amount_numeric=proposal.allocation_amount_numeric,
            model_risk_score=evaluation.risk_score,
            model_risk_level=evaluation.flag,
            model_duplicate_score=component_scores.get("duplicate", 0.0),
            model_financial_score=component_scores.get("financial", 0.0),
            model_financial_rule_score=component_scores.get("financial_rule", 0.0),
            model_financial_isolation_score=component_scores.get("isolation_forest", 0.0),
            model_split_sanction_score=component_scores.get("split_sanction", 0.0),
            model_pending_score=component_scores.get("pending", 0.0),
            isolation_forest_risk_score=component_scores.get("isolation_forest", 0.0),
            isolation_forest_anomaly_flag=component_scores.get("isolation_forest", 0.0) >= 97,
            model_reasons=evaluation.reasons,
        )
