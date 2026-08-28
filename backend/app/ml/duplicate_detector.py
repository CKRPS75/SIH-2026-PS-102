from __future__ import annotations

from app.core.config import Settings
from app.ml.geo import haversine_distance_m
from app.ml.text import token_similarity
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
            distance_m = haversine_distance_m(
                project.location.lat,
                project.location.lng,
                candidate.location.lat,
                candidate.location.lng,
            )
            if distance_m > radius_m:
                continue

            similarity = token_similarity(comparison_text, self._comparison_text(candidate))
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
                project.district,
                project.scheme,
            ]
        )
