from __future__ import annotations

import csv
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from app.schemas.analytics import (
    AnalyticsSummary,
    ConstituencyAnomalyRateResponse,
    ConstituencyAnomalyRateRow,
    PredictionDetail,
    PredictionListResponse,
    PredictionRow,
    StateAnomalyRateResponse,
    StateAnomalyRateRow,
    StateRiskRow,
)


MODEL_OUTPUT_DIR = Path(__file__).resolve().parents[2] / "data" / "model_outputs"
DEFAULT_PREDICTIONS_PATH = MODEL_OUTPUT_DIR / "test_predictions.csv"
DEFAULT_TRAIN_PREDICTIONS_PATH = MODEL_OUTPUT_DIR / "train_predictions.csv"


def _number(value: Any) -> float:
    try:
        if value in (None, ""):
            return 0.0
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _bool(value: Any) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "y"}


def _text(value: Any) -> str:
    return str(value or "").strip()


def _matches(value: str, expected: str | None) -> bool:
    if not expected:
        return True
    return value.strip().lower() == expected.strip().lower()


def _normalize_search(value: str) -> str:
    return " ".join(value.strip().lower().split())


class PredictionAnalyticsService:
    def __init__(
        self,
        predictions_path: Path = DEFAULT_PREDICTIONS_PATH,
        train_predictions_path: Path = DEFAULT_TRAIN_PREDICTIONS_PATH,
    ) -> None:
        self.predictions_path = predictions_path
        self.train_predictions_path = train_predictions_path
        self._cache: dict[str, tuple[tuple[float, ...], list[dict[str, str]]]] = {}

    def summary(self, dataset: str = "all") -> AnalyticsSummary:
        rows = self._load_rows(dataset)
        risk_counts = Counter(_text(row.get("model_risk_level")) or "UNKNOWN" for row in rows)
        flagged_rows = [row for row in rows if _text(row.get("model_risk_level")).upper() in {"YELLOW", "RED"}]
        top_states = Counter(_text(row.get("state")) or "Unknown" for row in flagged_rows)
        return AnalyticsSummary(
            total_projects=len(rows),
            total_allocation_amount=round(sum(_number(row.get("allocation_amount_numeric")) for row in rows), 2),
            risk_level_counts=dict(risk_counts),
            duplicate_count=sum(_number(row.get("model_duplicate_score")) >= 65 for row in rows),
            financial_anomaly_count=sum(_number(row.get("model_financial_score")) >= 45 for row in rows),
            isolation_forest_anomaly_count=sum(_bool(row.get("isolation_forest_anomaly_flag")) for row in rows),
            split_sanction_count=sum(_number(row.get("model_split_sanction_score")) >= 60 for row in rows),
            pending_count=sum(_number(row.get("model_pending_score")) > 0 for row in rows),
            top_states_by_yellow_red=dict(top_states.most_common(10)),
            generated_from=self._dataset_source_label(dataset),
        )

    def state_risk(self, limit: int = 20, dataset: str = "all") -> list[StateRiskRow]:
        rows = self._load_rows(dataset)
        grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
        for row in rows:
            grouped[_text(row.get("state")) or "Unknown"].append(row)

        state_rows = []
        for state, state_group in grouped.items():
            risk_counts = Counter(_text(row.get("model_risk_level")).upper() for row in state_group)
            state_rows.append(
                StateRiskRow(
                    state=state,
                    total_projects=len(state_group),
                    green_count=risk_counts.get("GREEN", 0),
                    yellow_count=risk_counts.get("YELLOW", 0),
                    red_count=risk_counts.get("RED", 0),
                    total_allocation_amount=round(
                        sum(_number(row.get("allocation_amount_numeric")) for row in state_group),
                        2,
                    ),
                    mean_model_risk_score=round(
                        sum(_number(row.get("model_risk_score")) for row in state_group) / len(state_group),
                        2,
                    ),
                    duplicate_count=sum(_number(row.get("model_duplicate_score")) >= 65 for row in state_group),
                    financial_anomaly_count=sum(_number(row.get("model_financial_score")) >= 45 for row in state_group),
                    isolation_forest_anomaly_count=sum(
                        _bool(row.get("isolation_forest_anomaly_flag")) for row in state_group
                    ),
                    split_sanction_count=sum(
                        _number(row.get("model_split_sanction_score")) >= 60 for row in state_group
                    ),
                    pending_count=sum(_number(row.get("model_pending_score")) > 0 for row in state_group),
                )
            )
        return sorted(state_rows, key=lambda row: (row.red_count + row.yellow_count, row.total_projects), reverse=True)[
            :limit
        ]

    def constituency_anomaly_rates(
        self,
        *,
        limit: int = 10,
        dataset: str = "all",
        min_projects: int = 10,
    ) -> ConstituencyAnomalyRateResponse:
        rows = self._load_rows(dataset)
        grouped: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
        for row in rows:
            state = _text(row.get("state")) or "Unknown"
            constituency = _text(row.get("constituency")) or "Unknown"
            grouped[(state, constituency)].append(row)

        constituency_rows = []
        for (state, constituency), group in grouped.items():
            if len(group) < min_projects:
                continue
            risk_counts = Counter(_text(row.get("model_risk_level")).upper() for row in group)
            anomalous_count = risk_counts.get("YELLOW", 0) + risk_counts.get("RED", 0)
            total_count = len(group)
            constituency_rows.append(
                ConstituencyAnomalyRateRow(
                    state=state,
                    constituency=constituency,
                    total_case_count=total_count,
                    anomalous_case_count=anomalous_count,
                    anomaly_rate=round((anomalous_count / total_count) * 100, 2) if total_count else 0.0,
                    green_count=risk_counts.get("GREEN", 0),
                    yellow_count=risk_counts.get("YELLOW", 0),
                    red_count=risk_counts.get("RED", 0),
                    duplicate_count=sum(_number(row.get("model_duplicate_score")) >= 65 for row in group),
                    financial_anomaly_count=sum(_number(row.get("model_financial_score")) >= 45 for row in group),
                    split_sanction_count=sum(_number(row.get("model_split_sanction_score")) >= 60 for row in group),
                    pending_count=sum(_number(row.get("model_pending_score")) > 0 for row in group),
                    total_allocation_amount=round(
                        sum(_number(row.get("allocation_amount_numeric")) for row in group),
                        2,
                    ),
                    mean_model_risk_score=round(
                        sum(_number(row.get("model_risk_score")) for row in group) / total_count,
                        2,
                    ),
                )
            )

        ranked_rows = sorted(
            constituency_rows,
            key=lambda row: (row.anomaly_rate, row.anomalous_case_count, row.total_case_count),
            reverse=True,
        )
        return ConstituencyAnomalyRateResponse(
            dataset=dataset,
            total_constituencies=len(constituency_rows),
            min_projects=min_projects,
            rows=ranked_rows[:limit],
        )

    def state_anomaly_rates(
        self,
        *,
        limit: int = 10,
        dataset: str = "all",
        min_projects: int = 10,
    ) -> StateAnomalyRateResponse:
        rows = self._load_rows(dataset)
        grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
        for row in rows:
            grouped[_text(row.get("state")) or "Unknown"].append(row)

        state_rows = []
        for state, group in grouped.items():
            if len(group) < min_projects:
                continue
            risk_counts = Counter(_text(row.get("model_risk_level")).upper() for row in group)
            anomalous_count = risk_counts.get("YELLOW", 0) + risk_counts.get("RED", 0)
            total_count = len(group)
            state_rows.append(
                StateAnomalyRateRow(
                    state=state,
                    total_case_count=total_count,
                    anomalous_case_count=anomalous_count,
                    anomaly_rate=round((anomalous_count / total_count) * 100, 2) if total_count else 0.0,
                    green_count=risk_counts.get("GREEN", 0),
                    yellow_count=risk_counts.get("YELLOW", 0),
                    red_count=risk_counts.get("RED", 0),
                    duplicate_count=sum(_number(row.get("model_duplicate_score")) >= 65 for row in group),
                    financial_anomaly_count=sum(_number(row.get("model_financial_score")) >= 45 for row in group),
                    split_sanction_count=sum(_number(row.get("model_split_sanction_score")) >= 60 for row in group),
                    pending_count=sum(_number(row.get("model_pending_score")) > 0 for row in group),
                    total_allocation_amount=round(
                        sum(_number(row.get("allocation_amount_numeric")) for row in group),
                        2,
                    ),
                    mean_model_risk_score=round(
                        sum(_number(row.get("model_risk_score")) for row in group) / total_count,
                        2,
                    ),
                )
            )

        ranked_rows = sorted(
            state_rows,
            key=lambda row: (row.anomaly_rate, row.anomalous_case_count, row.total_case_count),
            reverse=True,
        )
        return StateAnomalyRateResponse(
            dataset=dataset,
            total_states=len(state_rows),
            min_projects=min_projects,
            rows=ranked_rows[:limit],
        )

    def predictions(
        self,
        *,
        risk_level: str | None = None,
        state: str | None = None,
        category: str | None = None,
        mp: str | None = None,
        ida: str | None = None,
        dataset: str = "all",
        mp_match: str = "contains",
        isolation_forest_only: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> PredictionListResponse:
        rows = self._filter_rows(
            risk_level=risk_level,
            state=state,
            category=category,
            mp=mp,
            ida=ida,
            dataset=dataset,
            mp_match=mp_match,
            isolation_forest_only=isolation_forest_only,
        )
        paged = rows[offset : offset + limit]
        return PredictionListResponse(
            total=len(rows),
            limit=limit,
            offset=offset,
            rows=[self._to_prediction_row(row) for row in paged],
        )

    def prediction_detail(self, project_key: str, dataset: str = "all") -> PredictionDetail | None:
        wanted = project_key.strip().lower()
        for row in self._load_rows(dataset):
            if _text(row.get("project_key")).lower() == wanted:
                parsed = self._to_prediction_row(row)
                return PredictionDetail(**parsed.model_dump(), raw=row)
        return None

    def _filter_rows(
        self,
        *,
        risk_level: str | None,
        state: str | None,
        category: str | None,
        mp: str | None,
        ida: str | None,
        dataset: str,
        mp_match: str,
        isolation_forest_only: bool,
    ) -> list[dict[str, str]]:
        rows = []
        for row in self._load_rows(dataset):
            if not _matches(_text(row.get("model_risk_level")), risk_level):
                continue
            if not _matches(_text(row.get("state")), state):
                continue
            if not _matches(_text(row.get("category")), category):
                continue
            if mp and not self._matches_mp(_text(row.get("mp_name")), mp, mp_match):
                continue
            if ida and ida.strip().lower() not in _text(row.get("ida")).lower():
                continue
            if isolation_forest_only and not _bool(row.get("isolation_forest_anomaly_flag")):
                continue
            rows.append(row)
        return sorted(rows, key=lambda row: _number(row.get("model_risk_score")), reverse=True)

    def _matches_mp(self, row_mp_name: str, expected: str, match_mode: str) -> bool:
        row_name = _normalize_search(row_mp_name)
        expected_name = _normalize_search(expected)
        if not expected_name:
            return True
        if match_mode == "exact":
            return row_name == expected_name
        return expected_name in row_name

    def _load_rows(self, dataset: str = "test") -> list[dict[str, str]]:
        if dataset not in {"test", "train", "all"}:
            raise ValueError("dataset must be one of: test, train, all")

        paths = [self.predictions_path]
        if dataset == "train":
            paths = [self.train_predictions_path]
        elif dataset == "all":
            paths = [self.train_predictions_path, self.predictions_path]

        for path in paths:
            if not path.exists():
                raise FileNotFoundError(f"Predictions file not found: {path}")

        cache_key = tuple(path.stat().st_mtime for path in paths)
        cached = self._cache.get(dataset)
        if cached and cached[0] == cache_key:
            return cached[1]

        rows: list[dict[str, str]] = []
        for path in paths:
            with path.open("r", encoding="utf-8", newline="") as file:
                rows.extend(dict(row) for row in csv.DictReader(file))
        self._cache[dataset] = (cache_key, rows)
        return rows

    def _dataset_source_label(self, dataset: str) -> str:
        if dataset == "all":
            return f"{self.train_predictions_path}; {self.predictions_path}"
        if dataset == "train":
            return str(self.train_predictions_path)
        return str(self.predictions_path)

    def _to_prediction_row(self, row: dict[str, str]) -> PredictionRow:
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
            source_dataset=_text(row.get("source_dataset")) or None,
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
