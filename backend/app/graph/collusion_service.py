from __future__ import annotations

from app.schemas.project import ProjectRecord
from app.schemas.risk import GraphPattern, GraphRiskResult


class CollusionGraphDetector:
    """MVP graph-risk rules before Neo4j is connected."""

    def evaluate(self, project: ProjectRecord, candidates: list[ProjectRecord]) -> GraphRiskResult:
        patterns: list[GraphPattern] = []
        same_agency = [
            candidate
            for candidate in candidates
            if candidate.agency.name.strip().lower() == project.agency.name.strip().lower()
        ]
        if same_agency:
            same_contractor = [
                candidate
                for candidate in same_agency
                if candidate.contractor.legal_name.strip().lower()
                == project.contractor.legal_name.strip().lower()
            ]
            share = (len(same_contractor) + 1) / (len(same_agency) + 1)
            if len(same_contractor) >= 3 and share >= 0.6:
                patterns.append(
                    GraphPattern(
                        type="REPEAT_WINNER_CONCENTRATION",
                        message="Contractor has unusually high award concentration for the agency",
                        evidence={
                            "contractor": project.contractor.legal_name,
                            "agency": project.agency.name,
                            "agency_share": round(share, 2),
                            "related_project_ids": [item.id for item in same_contractor[:10]],
                        },
                    )
                )

        single_bid_related = [
            candidate.id
            for candidate in candidates
            if candidate.bid_count == 1
            and candidate.contractor.legal_name.strip().lower() == project.contractor.legal_name.strip().lower()
        ]
        if project.bid_count == 1 and len(single_bid_related) >= 2:
            patterns.append(
                GraphPattern(
                    type="SINGLE_BID_PATTERN",
                    message="Same contractor repeatedly receives single-bid awards",
                    evidence={
                        "contractor": project.contractor.legal_name,
                        "related_project_ids": single_bid_related[:10],
                    },
                )
            )

        score = 0.0
        if patterns:
            score = min(100.0, 45.0 + 20.0 * len(patterns))
        return GraphRiskResult(graph_score=score, patterns=patterns)
