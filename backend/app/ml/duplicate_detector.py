from __future__ import annotations

from app.core.config import Settings
from app.ml.geo import haversine_distance_m
from app.ml.text import normalize_text, token_similarity
from app.schemas.project import ProjectRecord
from app.schemas.risk import DuplicateMatch, DuplicateResult


class DuplicateDetector:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def evaluate(self, project: ProjectRecord, candidates: list[ProjectRecord]) -> DuplicateResult:
        radius_m = self.settings.duplicate_radius_km * 1000
        matches: list[DuplicateMatch] = []
        comparison_text = self._comparison_text(project)

        for candidate in candidates:
            if candidate.id == project.id:
                continue

            location_match, distance_m = self._location_match(project, candidate, radius_m)
            if not location_match:
                continue

            similarity = token_similarity(comparison_text, self._comparison_text(candidate))
            type_similarity = token_similarity(self._work_type(project), self._work_type(candidate))
            if self._same_named_locality(project, candidate) and type_similarity >= 0.9:
                similarity = max(similarity, 0.85)
            matches.append(
                DuplicateMatch(
                    project_id=candidate.id,
                    title=candidate.title,
                    distance_m=round(distance_m, 2),
                    similarity=round(similarity, 4),
                )
            )

        matches.sort(key=lambda item: (item.similarity, -item.distance_m), reverse=True)
        best = matches[0] if matches else None
        score = round((best.similarity if best else 0.0) * 100, 2)
        alert = score >= self.settings.duplicate_similarity_threshold * 100
        reason = None
        if best and alert:
            reason = (
                f"{score:.0f}% similar to {best.project_id} within "
                f"{best.distance_m:.0f} m"
            )

        return DuplicateResult(
            duplicate_score=score,
            alert=alert,
            threshold=self.settings.duplicate_similarity_threshold * 100,
            matches=matches[:5],
            reason=reason,
        )

    @staticmethod
    def _comparison_text(project: ProjectRecord) -> str:
        return " | ".join(
            [
                project.title,
                project.description,
                project.category or "",
                project.locality or "",
                project.ward or "",
                project.district,
                project.scheme,
            ]
        )

    @staticmethod
    def _work_type(project: ProjectRecord) -> str:
        cost_types = " ".join(item.item_code for item in project.cost_items)
        return " | ".join([project.category or "", project.scheme, cost_types, project.title])

    @staticmethod
    def _location_key(project: ProjectRecord, fields: list[str]) -> str:
        return normalize_text(" ".join(str(getattr(project, field) or "") for field in fields))

    @staticmethod
    def _has_coordinates(project: ProjectRecord) -> bool:
        return project.location is not None

    def _location_match(self, project: ProjectRecord, candidate: ProjectRecord, radius_m: float) -> tuple[bool, float]:
        if self._has_coordinates(project) and self._has_coordinates(candidate):
            distance_m = haversine_distance_m(
                project.location.lat,
                project.location.lng,
                candidate.location.lat,
                candidate.location.lng,
            )
            return distance_m <= radius_m, round(distance_m, 2)

        if self._same_named_locality(project, candidate):
            return True, 0.0

        return False, 0.0

    def _same_named_locality(self, project: ProjectRecord, candidate: ProjectRecord) -> bool:
        project_locality = self._location_key(project, ["locality", "ward", "district", "state"])
        candidate_locality = self._location_key(candidate, ["locality", "ward", "district", "state"])
        return bool(project_locality and candidate_locality and project_locality == candidate_locality)
