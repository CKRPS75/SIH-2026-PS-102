from __future__ import annotations

import csv
import hashlib
import itertools
import os
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.schemas.analytics import (
    DuplicateLocationAnalyticsResponse,
    DuplicateLocationRow,
    DuplicateProjectPair,
)


MODEL_OUTPUT_DIR = Path(__file__).resolve().parents[2] / "data" / "model_outputs"
DEFAULT_PREDICTION_PATHS = [
    MODEL_OUTPUT_DIR / "train_predictions.csv",
    MODEL_OUTPUT_DIR / "test_predictions.csv",
]


def _text(value: Any) -> str:
    return str(value or "").strip()


def _number(value: Any) -> float:
    try:
        if value in (None, ""):
            return 0.0
        return float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return 0.0


def _location_key(state: str, constituency: str, locality: str, ward: str) -> str:
    raw = "|".join([state.lower(), constituency.lower(), locality.lower(), ward.lower()])
    normalized = re.sub(r"[^a-z0-9|]+", "_", raw).strip("_")
    digest = hashlib.sha1(normalized.encode("utf-8")).hexdigest()[:12]
    return f"loc_{digest}"


class DuplicateLocationAnalyticsService:
    def __init__(
        self,
        prediction_paths: list[Path] | None = None,
        *,
        similarity_threshold: float = 0.80,
        min_projects_for_confidence: int = 5,
        sentence_bert_model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
        use_sentence_bert: bool | None = None,
    ) -> None:
        self.prediction_paths = prediction_paths or DEFAULT_PREDICTION_PATHS
        self.similarity_threshold = similarity_threshold
        self.min_projects_for_confidence = min_projects_for_confidence
        self.sentence_bert_model_name = sentence_bert_model_name
        self.use_sentence_bert = (
            os.getenv("MPLADS_USE_SENTENCE_BERT", "").strip().lower() in {"1", "true", "yes"}
            if use_sentence_bert is None
            else use_sentence_bert
        )
        self._cache_key: tuple[tuple[tuple[str, float], ...], bool] | None = None
        self._rows_by_confidence_scope: dict[bool, list[DuplicateLocationRow]] = {}
        self._sbert_model: Any | None = None
        self._sbert_failed = False

    def ranked_locations(
        self,
        *,
        limit: int = 20,
        include_low_confidence: bool = False,
    ) -> DuplicateLocationAnalyticsResponse:
        rows = self._analytics_rows(include_low_confidence=include_low_confidence)
        return DuplicateLocationAnalyticsResponse(
            total_locations=len(rows),
            similarity_threshold=self.similarity_threshold,
            min_projects_for_confidence=self.min_projects_for_confidence,
            rows=rows[:limit],
        )

    def location_detail(self, location_key: str) -> DuplicateLocationRow | None:
        wanted = location_key.strip().lower()
        for row in self._analytics_rows(include_low_confidence=False):
            if row.location_key.lower() == wanted:
                return row
        for row in self._analytics_rows(include_low_confidence=True):
            if row.location_key.lower() == wanted:
                return row
        return None

    def _analytics_rows(self, *, include_low_confidence: bool) -> list[DuplicateLocationRow]:
        file_key = tuple((str(path), path.stat().st_mtime) for path in self.prediction_paths if path.exists())
        cache_key = (file_key, include_low_confidence)
        missing_paths = [path for path in self.prediction_paths if not path.exists()]
        if missing_paths:
            raise FileNotFoundError(f"Predictions file not found: {missing_paths[0]}")
        if self._cache_key and self._cache_key[0] != file_key:
            self._rows_by_confidence_scope = {}
        if include_low_confidence in self._rows_by_confidence_scope:
            return self._rows_by_confidence_scope[include_low_confidence]

        grouped: dict[tuple[str, str, str, str], list[dict[str, str]]] = defaultdict(list)
        for row in self._load_rows():
            locality = _text(row.get("locality"))
            work_clean = _text(row.get("work_clean"))
            if not locality or len(work_clean) < 6:
                continue
            state = _text(row.get("state")) or "Unknown state"
            constituency = _text(row.get("constituency")) or "Unknown constituency"
            ward = _text(row.get("ward")) or "Unknown"
            grouped[(state, constituency, locality, ward)].append(row)

        analytics_rows = []
        for (state, constituency, locality, ward), rows in grouped.items():
            if len(rows) < 2:
                continue
            if not include_low_confidence and len(rows) < self.min_projects_for_confidence:
                continue
            analytics_rows.append(self._score_location(state, constituency, locality, ward, rows))

        sorted_rows = sorted(
            analytics_rows,
            key=lambda row: (
                row.duplicate_rate,
                row.duplicate_pair_count,
                row.maximum_similarity,
                row.total_project_count,
            ),
            reverse=True,
        )
        self._rows_by_confidence_scope[include_low_confidence] = sorted_rows
        self._cache_key = cache_key
        return sorted_rows

    def _load_rows(self) -> list[dict[str, str]]:
        rows: list[dict[str, str]] = []
        for path in self.prediction_paths:
            with path.open("r", encoding="utf-8", newline="") as file:
                rows.extend(dict(row) for row in csv.DictReader(file))
        return rows

    def _score_location(
        self,
        state: str,
        constituency: str,
        locality: str,
        ward: str,
        rows: list[dict[str, str]],
    ) -> DuplicateLocationRow:
        texts = [_text(row.get("work_clean")) or "Untitled work" for row in rows]
        similarity_matrix, backend = self._similarity_matrix(texts)

        flagged_pairs: list[DuplicateProjectPair] = []
        duplicate_candidate_indices: set[int] = set()
        similarity_values: list[float] = []

        for first_index, second_index in itertools.combinations(range(len(rows)), 2):
            similarity = round(float(similarity_matrix[first_index, second_index]), 4)
            if similarity < self.similarity_threshold:
                continue
            duplicate_candidate_indices.update([first_index, second_index])
            similarity_values.append(similarity)
            flagged_pairs.append(
                DuplicateProjectPair(
                    pair_label=f"Matched pair {len(flagged_pairs) + 1}",
                    first_work=texts[first_index],
                    second_work=texts[second_index],
                    first_amount=_number(rows[first_index].get("allocation_amount_numeric")),
                    second_amount=_number(rows[second_index].get("allocation_amount_numeric")),
                    first_date=_text(rows[first_index].get("recommended_date")) or None,
                    second_date=_text(rows[second_index].get("recommended_date")) or None,
                    similarity=similarity,
                )
            )

        flagged_allocation = sum(
            _number(rows[index].get("allocation_amount_numeric")) for index in duplicate_candidate_indices
        )
        total_projects = len(rows)
        duplicate_count = len(duplicate_candidate_indices)
        return DuplicateLocationRow(
            location_key=_location_key(state, constituency, locality, ward),
            state=state,
            constituency=constituency,
            locality=locality,
            ward=ward,
            total_project_count=total_projects,
            duplicate_candidate_project_count=duplicate_count,
            duplicate_pair_count=len(flagged_pairs),
            duplicate_rate=round((duplicate_count / total_projects) * 100, 2) if total_projects else 0.0,
            average_similarity=round(float(np.mean(similarity_values)), 4) if similarity_values else 0.0,
            maximum_similarity=round(float(np.max(similarity_values)), 4) if similarity_values else 0.0,
            flagged_allocation_amount=round(flagged_allocation, 2),
            confidence="HIGH" if total_projects >= self.min_projects_for_confidence else "LOW",
            embedding_backend=backend,
            pairs=sorted(flagged_pairs, key=lambda pair: pair.similarity, reverse=True),
        )

    def _similarity_matrix(self, texts: list[str]) -> tuple[np.ndarray, str]:
        model = self._sentence_bert_model()
        if model is not None:
            embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
            return np.asarray(embeddings) @ np.asarray(embeddings).T, "sentence-bert"

        try:
            vectors = TfidfVectorizer(stop_words="english", ngram_range=(1, 2)).fit_transform(texts)
            return cosine_similarity(vectors), "tf-idf-fallback"
        except ValueError:
            return np.eye(len(texts)), "tf-idf-fallback"

    def _sentence_bert_model(self) -> Any | None:
        if not self.use_sentence_bert:
            return None
        if self._sbert_failed:
            return None
        if self._sbert_model is not None:
            return self._sbert_model
        try:
            from sentence_transformers import SentenceTransformer

            self._sbert_model = SentenceTransformer(self.sentence_bert_model_name, local_files_only=True)
            return self._sbert_model
        except Exception:
            self._sbert_failed = True
            return None
