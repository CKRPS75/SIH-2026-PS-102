from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from joblib import load
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.schemas.analytics import EvaluationReference, JsonEvaluationResponse, ProjectEvaluationInput


BASE_DIR = Path(__file__).resolve().parents[2]
MODEL_OUTPUT_DIR = BASE_DIR / "data" / "model_outputs"
MOCK_RECORDS_PATH = BASE_DIR / "data" / "mock" / "mock_input_records.json"
TRAIN_PREDICTIONS_PATH = MODEL_OUTPUT_DIR / "train_predictions.csv"
ISOLATION_FOREST_MODEL_PATH = MODEL_OUTPUT_DIR / "isolation_forest_model.joblib"
COST_OUTLIER_MEDIAN_RATIO_THRESHOLD = 2.5
DUPLICATE_SIMILARITY_THRESHOLD = 0.80


def _text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and pd.isna(value):
        return ""
    return str(value).strip()


def _normalize_key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "_", _text(value).lower()).strip("_")


def _number(value: Any) -> float:
    try:
        if value in (None, ""):
            return 0.0
        return float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return 0.0


def _date(value: Any) -> pd.Timestamp | None:
    parsed = pd.to_datetime(value, errors="coerce")
    if pd.isna(parsed):
        return None
    return parsed


def _month_key(value: Any) -> str:
    parsed = _date(value)
    if parsed is None:
        return ""
    return str(parsed.to_period("M"))


def _flag_color(level: str) -> str:
    if level == "RED":
        return "#B3261E"
    if level == "YELLOW":
        return "#F59E0B"
    return "#10B981"


def _comment(level: str, reasons: list[str] | None = None) -> str:
    if level == "RED":
        return "This proposal looks risky and should be checked before approval."
    if level == "YELLOW":
        reason_text = " ".join(reasons or []).lower()
        if "5 lakh" in reason_text or "split" in reason_text or "small proposals" in reason_text:
            return "This may be one large work split into smaller proposals."
        if "amount is high" in reason_text or "amount is higher" in reason_text or "spending pattern" in reason_text:
            return "The requested amount looks higher than similar past work."
        if "locality and ward" in reason_text:
            return "Possible duplicate: similar work already appears in the same locality and ward."
        return "This proposal needs a manual check before approval."
    return "This proposal looks normal based on the available records."


def _reference_from_row(row: pd.Series, match_type: str, similarity: float | None = None) -> EvaluationReference:
    return EvaluationReference(
        project_key="Redacted reference",
        work_clean=_text(row.get("work_clean")) or "Untitled project",
        amount=_number(row.get("allocation_amount_numeric")),
        state=_text(row.get("state")) or None,
        constituency=_text(row.get("constituency")) or None,
        locality=_text(row.get("locality")) or None,
        ward=_text(row.get("ward")) or None,
        recommended_date=_text(row.get("recommended_date")) or None,
        source_dataset=_text(row.get("source_dataset")) or "reference",
        match_type=match_type,
        similarity=similarity,
    )


class JsonEvaluationService:
    def __init__(
        self,
        train_predictions_path: Path = TRAIN_PREDICTIONS_PATH,
        mock_records_path: Path = MOCK_RECORDS_PATH,
        isolation_forest_model_path: Path = ISOLATION_FOREST_MODEL_PATH,
    ) -> None:
        self.train_predictions_path = train_predictions_path
        self.mock_records_path = mock_records_path
        self.isolation_forest_model_path = isolation_forest_model_path
        self._cache_key: tuple[float, float] | None = None
        self._reference_rows: pd.DataFrame | None = None
        self._isolation_forest_cache_key: float | None = None
        self._isolation_forest_bundle: dict[str, Any] | None = None
        self._sbert_model: Any | None = None
        self._sbert_failed = False
        self._use_sentence_bert = os.getenv("MPLADS_USE_SENTENCE_BERT", "").strip().lower() in {"1", "true", "yes"}

    def evaluate(self, proposal: ProjectEvaluationInput) -> JsonEvaluationResponse:
        reference = self._reference()
        row = proposal.model_dump()
        project_key = _text(row.get("project_key"))
        if project_key:
            reference = reference[~reference["project_key"].astype(str).str.lower().eq(project_key.lower())].copy()
        amount = _number(row.get("allocation_amount_numeric"))
        category = self._resolve_category(reference, row.get("category"), row.get("work_clean"))
        work_key = _normalize_key(row.get("work_clean"))
        work_type = self._infer_category(row.get("work_clean"))
        work_type_key = _normalize_key(work_type) if work_type != "Normal/Others" else ""
        locality_key = _normalize_key(row.get("locality"))
        ward_key = _normalize_key(row.get("ward"))
        duplicate_location_key = _normalize_key(f"{row.get('locality', '')}|{row.get('ward', '')}")
        state_key = _normalize_key(row.get("state"))
        constituency_key = _normalize_key(row.get("constituency"))
        mp_key = _normalize_key(row.get("mp_name"))
        ida_key = _normalize_key(row.get("ida"))
        recommended_month = _month_key(row.get("recommended_date"))

        medians = self._median_context(reference, category, state_key, constituency_key)
        ratios = {
            "category": self._safe_ratio(amount, medians["category"]),
            "state_category": self._safe_ratio(amount, medians["state_category"]),
            "constituency_category": self._safe_ratio(amount, medians["constituency_category"]),
        }
        strongest_ratio = max(ratios["category"], ratios["state_category"], ratios["constituency_category"])

        duplicate_matches = self._duplicate_matches(
            reference=reference,
            work_clean=row.get("work_clean"),
            state_key=state_key,
            constituency_key=constituency_key,
            duplicate_location_key=duplicate_location_key,
        )
        same_work_location = duplicate_matches
        same_category_location = reference.iloc[0:0]
        same_type_location_month = (
            reference[
                reference["mp_key"].eq(mp_key)
                & reference["ida_key"].eq(ida_key)
                & reference["work_type_key"].eq(work_type_key)
                & reference["duplicate_location_key"].eq(duplicate_location_key)
                & reference["recommended_month"].eq(recommended_month)
            ]
            if work_type_key
            else reference.iloc[0:0]
        )
        exact_location_amount = reference[
            reference["work_key"].eq(work_key)
            & reference["state_key"].eq(state_key)
            & reference["constituency_key"].eq(constituency_key)
            & reference["duplicate_location_key"].eq(duplicate_location_key)
            & reference["allocation_amount_numeric"].eq(amount)
        ]

        split_matches = self._split_matches(reference, row, amount, duplicate_location_key, mp_key, ida_key)
        financial_matches = self._financial_matches(reference, category, state_key, constituency_key, medians)

        same_work_count = len(same_work_location) + (1 if work_key and duplicate_location_key else 0)
        same_category_count = len(same_category_location) + (1 if work_type_key and duplicate_location_key else 0)
        same_type_month_count = len(same_type_location_month) + (
            1 if mp_key and ida_key and work_type_key and duplicate_location_key and recommended_month else 0
        )
        exact_count = len(exact_location_amount) + (1 if work_key and duplicate_location_key and amount else 0)
        split_count = len(split_matches) + (1 if 450000 <= amount <= 500000 and duplicate_location_key else 0)

        max_duplicate_similarity = (
            float(duplicate_matches["similarity"].max()) if not duplicate_matches.empty else 0.0
        )
        duplicate_score = (
            min(100.0, 65 + (max_duplicate_similarity - DUPLICATE_SIMILARITY_THRESHOLD) * 175 + len(duplicate_matches) * 3)
            if not duplicate_matches.empty
            else 0.0
        )
        category_amounts = reference[reference["source_dataset"].eq("training")]["allocation_amount_numeric"]
        amount_p99 = float(category_amounts.quantile(0.99)) if not category_amounts.empty else 0.0
        isolation_forest_risk = self._isolation_forest_risk(
            {
                "allocation_amount_numeric": amount,
                "amount_vs_category_median_ratio": ratios["category"],
                "amount_vs_state_category_median_ratio": ratios["state_category"],
                "amount_vs_constituency_category_median_ratio": ratios["constituency_category"],
                "project_amount_as_pct_of_mp_allocation": 0.0,
                "same_work_same_locality_count": len(duplicate_matches),
                "same_work_same_duplicate_location_count": len(duplicate_matches),
                "same_work_same_block_count": 0.0,
                "same_work_same_constituency_count": 0.0,
                "same_category_same_locality_count": 0.0,
                "same_category_same_block_count": 0.0,
                "same_category_same_constituency_count": 0.0,
                "same_mp_category_locality_count": 0.0,
                "same_ida_category_locality_count": 0.0,
                "same_type_location_month_count": same_type_month_count,
                "same_ida_locality_7day_sub5l_count": split_count if ida_key else 0.0,
                "same_mp_locality_7day_sub5l_count": split_count if mp_key else 0.0,
                "mp_project_count": 0.0,
                "ida_project_count": 0.0,
                "locality_project_count": len(reference[reference["locality_key"].eq(locality_key)]) + (1 if locality_key else 0),
                "duplicate_location_project_count": len(reference[reference["duplicate_location_key"].eq(duplicate_location_key)])
                + (1 if duplicate_location_key else 0),
                "location_duplicate_group_count": exact_count,
            }
        )

        rule_financial_score = min(
            100.0,
            (45 if strongest_ratio >= COST_OUTLIER_MEDIAN_RATIO_THRESHOLD else 0)
            + (55 if ratios["category"] >= 4.0 else 0)
            + (15 if amount_p99 and amount >= amount_p99 else 0),
        )
        financial_score = max(rule_financial_score, isolation_forest_risk if isolation_forest_risk >= 97 else 0.0)
        near_5_lakh = 450000 <= amount <= 500000
        split_score = min(100.0, (20 if near_5_lakh and locality_key else 0) + (65 if split_count >= 3 else 0))
        pending_score = (
            45.0
            if _text(row.get("status")).lower() == "unsanctioned"
            and "pending" in _text(row.get("ida_approval")).lower()
            else 0.0
        )

        risk_score = round(
            0.30 * duplicate_score + 0.35 * financial_score + 0.25 * split_score + 0.10 * pending_score,
            2,
        )
        major_anomaly = duplicate_score >= 65 or financial_score >= 45 or split_score >= 60 or isolation_forest_risk >= 97
        if major_anomaly:
            risk_score = max(risk_score, 30.0)
        flag = "RED" if risk_score > 65 else "YELLOW" if risk_score >= 30 else "GREEN"
        rating = round(risk_score / 10, 1)

        model_reasons = self._model_reasons(
            duplicate_score,
            rule_financial_score,
            isolation_forest_risk,
            split_score,
            pending_score,
        )
        references = {
            "financial": [
                _reference_from_row(match, "similar work in the same area")
                for _, match in financial_matches.head(10).iterrows()
            ],
            "duplicates": [
                _reference_from_row(
                    match,
                    "similar work in the same locality and ward",
                    similarity=round(float(match.get("similarity", 0.0)), 4),
                )
                for _, match in duplicate_matches.head(10).iterrows()
            ],
            "split_sanctions": [
                _reference_from_row(match, "near-Rs 5 lakh work in the same locality and ward")
                for _, match in split_matches.head(10).iterrows()
            ],
        }
        reason_description = self._reason_description(
            model_reasons=model_reasons,
            amount=amount,
            medians=medians,
            ratios=ratios,
            isolation_forest_risk=isolation_forest_risk,
            counts={
                "same_work_location": same_work_count,
                "same_category_location": same_category_count,
                "same_type_location_month": same_type_month_count,
                "split_window": split_count,
            },
            references=references,
        )

        return JsonEvaluationResponse(
            project_key=_text(row.get("project_key")) or "LIVE-JSON",
            flag=flag,
            flag_color=_flag_color(flag),
            rating=rating,
            risk_score=risk_score,
            comment=_comment(flag, model_reasons),
            reason_description=reason_description,
            reasons=model_reasons,
            component_scores={
                "duplicate": round(duplicate_score, 2),
                "financial": round(financial_score, 2),
                "financial_rule": round(rule_financial_score, 2),
                "isolation_forest": round(isolation_forest_risk, 2),
                "split_sanction": round(split_score, 2),
                "pending": round(pending_score, 2),
            },
            median_context=medians,
            ratio_context=ratios,
            references=references,
        )

    def _reference(self) -> pd.DataFrame:
        if not self.train_predictions_path.exists():
            raise FileNotFoundError(f"Training predictions file not found: {self.train_predictions_path}")
        if not self.mock_records_path.exists():
            raise FileNotFoundError(f"Mock input records file not found: {self.mock_records_path}")

        cache_key = (self.train_predictions_path.stat().st_mtime, self.mock_records_path.stat().st_mtime)
        if self._cache_key == cache_key and self._reference_rows is not None:
            return self._reference_rows

        train = pd.read_csv(self.train_predictions_path, dtype=str).fillna("")
        mock = pd.DataFrame(json.loads(self.mock_records_path.read_text(encoding="utf-8"))).fillna("")
        common_columns = [
            "project_key",
            "mp_name",
            "state",
            "constituency",
            "ida",
            "category",
            "work_clean",
            "locality",
            "ward",
            "recommended_date",
            "allocation_amount_numeric",
        ]
        for frame in [train, mock]:
            for column in common_columns:
                if column not in frame:
                    frame[column] = ""
        train = train[common_columns].copy()
        train["source_dataset"] = "training"
        mock = mock[common_columns].copy()
        mock["source_dataset"] = "mock_input"
        reference = pd.concat([train, mock], ignore_index=True)
        reference["allocation_amount_numeric"] = reference["allocation_amount_numeric"].map(_number)

        for column in ["mp_name", "state", "constituency", "ida", "category", "work_clean", "locality", "ward"]:
            reference[f"{column}_key"] = reference[column].map(_normalize_key)
        reference["mp_key"] = reference["mp_name_key"]
        reference["work_key"] = reference["work_clean_key"]
        reference["work_type"] = reference["work_clean"].map(self._infer_category)
        reference["work_type_key"] = reference["work_type"].map(
            lambda value: _normalize_key(value) if value != "Normal/Others" else ""
        )
        reference["duplicate_location_key"] = (
            reference["locality"].map(_text) + "|" + reference["ward"].map(_text)
        ).map(_normalize_key)
        reference["recommended_month"] = reference["recommended_date"].map(_month_key)

        self._cache_key = cache_key
        self._reference_rows = reference
        return reference

    def _median_context(
        self,
        reference: pd.DataFrame,
        category: str,
        state_key: str,
        constituency_key: str,
    ) -> dict[str, float]:
        train = reference[reference["source_dataset"].eq("training")]
        category_rows = train[train["category"].eq(category)]
        state_category_rows = category_rows[category_rows["state_key"].eq(state_key)]
        constituency_category_rows = category_rows[category_rows["constituency_key"].eq(constituency_key)]
        return {
            "category": round(float(category_rows["allocation_amount_numeric"].median()), 2) if not category_rows.empty else 0.0,
            "state_category": round(float(state_category_rows["allocation_amount_numeric"].median()), 2) if not state_category_rows.empty else 0.0,
            "constituency_category": round(float(constituency_category_rows["allocation_amount_numeric"].median()), 2)
            if not constituency_category_rows.empty
            else 0.0,
        }

    def _financial_matches(
        self,
        reference: pd.DataFrame,
        category: str,
        state_key: str,
        constituency_key: str,
        medians: dict[str, float],
    ) -> pd.DataFrame:
        train = reference[reference["source_dataset"].eq("training")].copy()
        candidates = train[train["category"].eq(category)].copy()
        if constituency_key:
            constituency_matches = candidates[candidates["constituency_key"].eq(constituency_key)]
            if not constituency_matches.empty:
                candidates = constituency_matches
        baseline = min(value for value in medians.values() if value) if any(medians.values()) else 0.0
        if baseline:
            candidates["distance_to_baseline"] = (candidates["allocation_amount_numeric"] - baseline).abs()
            candidates = candidates.sort_values("distance_to_baseline")
        return candidates

    def _duplicate_matches(
        self,
        *,
        reference: pd.DataFrame,
        work_clean: Any,
        state_key: str,
        constituency_key: str,
        duplicate_location_key: str,
    ) -> pd.DataFrame:
        work_text = _text(work_clean)
        if not work_text or not state_key or not constituency_key or not duplicate_location_key:
            return reference.iloc[0:0].copy()

        candidates = reference[
            reference["state_key"].eq(state_key)
            & reference["constituency_key"].eq(constituency_key)
            & reference["duplicate_location_key"].eq(duplicate_location_key)
            & reference["work_clean"].map(_text).ne("")
        ].copy()
        if candidates.empty:
            return candidates

        similarities = self._text_similarity_against_candidates(work_text, candidates["work_clean"].tolist())
        candidates["similarity"] = similarities
        return candidates[candidates["similarity"].ge(DUPLICATE_SIMILARITY_THRESHOLD)].sort_values(
            "similarity",
            ascending=False,
        )

    def _text_similarity_against_candidates(self, work_text: str, candidate_texts: list[str]) -> list[float]:
        model = self._sentence_bert_model()
        if model is not None:
            embeddings = model.encode([work_text, *candidate_texts], normalize_embeddings=True, show_progress_bar=False)
            scores = np.asarray(embeddings[0:1]) @ np.asarray(embeddings[1:]).T
            return [round(float(score), 4) for score in scores.ravel()]

        try:
            vectors = TfidfVectorizer(stop_words="english", ngram_range=(1, 2)).fit_transform(
                [work_text, *candidate_texts]
            )
            scores = cosine_similarity(vectors[0:1], vectors[1:]).ravel()
            return [round(float(score), 4) for score in scores]
        except ValueError:
            return [0.0 for _ in candidate_texts]

    def _sentence_bert_model(self) -> Any | None:
        if not self._use_sentence_bert or self._sbert_failed:
            return None
        if self._sbert_model is not None:
            return self._sbert_model
        try:
            from sentence_transformers import SentenceTransformer

            self._sbert_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2", local_files_only=True)
            return self._sbert_model
        except Exception:
            self._sbert_failed = True
            return None

    def _split_matches(
        self,
        reference: pd.DataFrame,
        row: dict[str, Any],
        amount: float,
        duplicate_location_key: str,
        mp_key: str,
        ida_key: str,
    ) -> pd.DataFrame:
        current_date = _date(row.get("recommended_date"))
        if current_date is None or not (450000 <= amount <= 500000) or not duplicate_location_key:
            return reference.iloc[0:0]

        ref_dates = pd.to_datetime(reference["recommended_date"], errors="coerce")
        return reference[
            (ref_dates - current_date).abs().dt.days.le(7)
            & reference["duplicate_location_key"].eq(duplicate_location_key)
            & reference["allocation_amount_numeric"].between(450000, 500000, inclusive="both")
            & (reference["mp_key"].eq(mp_key) | reference["ida_key"].eq(ida_key))
        ]

    def _safe_ratio(self, amount: float, median: float) -> float:
        if not median:
            return 0.0
        return round(amount / median, 4)

    def _isolation_forest_risk(self, features: dict[str, float]) -> float:
        bundle = self._load_isolation_forest_bundle()
        if not bundle:
            return 0.0
        feature_columns = bundle["feature_columns"]
        row = pd.DataFrame([{column: _number(features.get(column, 0.0)) for column in feature_columns}])
        raw_score = -bundle["pipeline"].decision_function(row)[0]
        distribution = bundle["train_raw_score_distribution"]
        risk_score = np.searchsorted(distribution, raw_score, side="right") / len(distribution) * 100
        return round(float(risk_score), 2)

    def _load_isolation_forest_bundle(self) -> dict[str, Any] | None:
        if not self.isolation_forest_model_path.exists():
            return None
        cache_key = self.isolation_forest_model_path.stat().st_mtime
        if self._isolation_forest_cache_key == cache_key:
            return self._isolation_forest_bundle
        self._isolation_forest_bundle = load(self.isolation_forest_model_path)
        self._isolation_forest_cache_key = cache_key
        return self._isolation_forest_bundle

    def _resolve_category(self, reference: pd.DataFrame, category: Any, work_clean: Any) -> str:
        raw_category = _text(category)
        inferred_category = self._infer_category(work_clean)
        train_categories = reference[reference["source_dataset"].eq("training")]["category"].dropna().unique().tolist()
        train_category_keys = {_normalize_key(value): value for value in train_categories if _text(value)}

        if raw_category and raw_category in train_categories:
            return raw_category
        if _normalize_key(raw_category) in train_category_keys:
            return train_category_keys[_normalize_key(raw_category)]
        if inferred_category in train_categories:
            return inferred_category
        return raw_category or inferred_category

    def _infer_category(self, work_clean: Any) -> str:
        work = _text(work_clean).lower()
        if any(token in work for token in ["samaj", "bhavan", "community", "hall", "trust", "society"]):
            return "Trust and Society"
        if any(token in work for token in ["repair", "renovation", "maintenance"]):
            return "Repair and Renovation"
        if "bar association" in work:
            return "Bar and Associations"
        return "Normal/Others"

    def _model_reasons(
        self,
        duplicate_score: float,
        rule_financial_score: float,
        isolation_forest_risk: float,
        split_score: float,
        pending_score: float,
    ) -> list[str]:
        reasons = []
        if duplicate_score >= 65:
            reasons.append("Similar work is already listed for this locality and ward")
        if rule_financial_score >= 45:
            reasons.append("The requested amount is higher than similar past projects")
        if isolation_forest_risk >= 97:
            reasons.append("The spending pattern looks unusual compared with past records")
        if split_score >= 60:
            reasons.append("Several small proposals appear close together in the same area")
        if pending_score > 0:
            reasons.append("Approval is still pending")
        if not reasons:
            reasons.append("No clear warning sign was found")
        return reasons

    def _short_reason_sentence(
        self,
        *,
        model_reasons: list[str],
        amount: float,
        baseline: float,
        strongest_ratio: float,
        counts: dict[str, int],
    ) -> str:
        if model_reasons == ["No clear warning sign was found"]:
            return "No clear warning sign was found in the available records."

        first_reason = model_reasons[0]
        if "amount" in first_reason.lower() or "spending" in first_reason.lower():
            if baseline:
                return (
                    f"The amount requested is about {strongest_ratio:.1f}x higher than similar past work, "
                    "so the case needs a financial review."
                )
            return "The amount requested looks unusual, so the case needs a financial review."
        if "similar work" in first_reason.lower():
            return "A very similar work entry was found in the same locality and ward, so it may be a duplicate."
        if "small proposals" in first_reason.lower():
            return "Several small proposals appear close together in the same area, so they may be parts of one larger work."
        if "approval" in first_reason.lower():
            return "The approval is still pending, so the case should be checked before moving ahead."
        if counts["same_work_location"] > 1:
            return "A matching local record was found, so the case should be checked before approval."
        return "One warning sign was found, so the case should be reviewed before approval."

    def _reason_description(
        self,
        *,
        model_reasons: list[str],
        amount: float,
        medians: dict[str, float],
        ratios: dict[str, float],
        isolation_forest_risk: float,
        counts: dict[str, int],
        references: dict[str, list[EvaluationReference]],
    ) -> str:
        financial_refs = references["financial"]
        duplicate_refs = references["duplicates"]
        split_refs = references["split_sanctions"]
        available_baselines = [value for value in medians.values() if value]
        baseline = min(available_baselines) if available_baselines else 0.0
        strongest_ratio = max(ratios["category"], ratios["state_category"], ratios["constituency_category"])
        reason = self._short_reason_sentence(
            model_reasons=model_reasons,
            amount=amount,
            baseline=baseline,
            strongest_ratio=strongest_ratio,
            counts=counts,
        )
        if financial_refs or duplicate_refs or split_refs:
            return f"{reason} Check the compared records and chart below for evidence."
        return reason

    def _format_reference_list(self, references: list[EvaluationReference]) -> str:
        return "\n".join(
            f"- Similar record {index}: {ref.work_clean}; Rs {ref.amount:,.0f}; "
            f"{ref.locality or 'unknown locality'}; ward {ref.ward or 'unknown'}"
            for index, ref in enumerate(references[:5], start=1)
        )
