from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    app_env: str = "development"
    duplicate_radius_km: float = 2.0
    duplicate_similarity_threshold: float = 0.82
    bsr_ratio_alert_threshold: float = 1.30
    split_sanction_amount_limit: float = 500000.0
    split_sanction_window_days: int = 7
    risk_weight_duplicate: float = 0.40
    risk_weight_cost: float = 0.40
    risk_weight_graph: float = 0.20
    risk_green_max: float = 30.0
    risk_red_min: float = 65.0
    scoring_policy_version: str = "v0.4-locality-ward-duplicates"
    model_version: str = "v0.4-rules"
    pfms_mode: str = "mock"
    esakshi_mode: str = "mock"

    @classmethod
    def from_env(cls) -> "Settings":
        settings = cls(
            app_env=os.getenv("APP_ENV", cls.app_env),
            duplicate_radius_km=float(os.getenv("DUPLICATE_RADIUS_KM", cls.duplicate_radius_km)),
            duplicate_similarity_threshold=float(
                os.getenv("DUPLICATE_SIMILARITY_THRESHOLD", cls.duplicate_similarity_threshold)
            ),
            bsr_ratio_alert_threshold=float(os.getenv("BSR_RATIO_ALERT_THRESHOLD", cls.bsr_ratio_alert_threshold)),
            split_sanction_amount_limit=float(
                os.getenv("SPLIT_SANCTION_AMOUNT_LIMIT", cls.split_sanction_amount_limit)
            ),
            split_sanction_window_days=int(os.getenv("SPLIT_SANCTION_WINDOW_DAYS", cls.split_sanction_window_days)),
            risk_weight_duplicate=float(os.getenv("RISK_WEIGHT_DUPLICATE", cls.risk_weight_duplicate)),
            risk_weight_cost=float(os.getenv("RISK_WEIGHT_COST", cls.risk_weight_cost)),
            risk_weight_graph=float(os.getenv("RISK_WEIGHT_GRAPH", cls.risk_weight_graph)),
            risk_green_max=float(os.getenv("RISK_GREEN_MAX", cls.risk_green_max)),
            risk_red_min=float(os.getenv("RISK_RED_MIN", cls.risk_red_min)),
            scoring_policy_version=os.getenv("SCORING_POLICY_VERSION", cls.scoring_policy_version),
            model_version=os.getenv("MODEL_VERSION", cls.model_version),
            pfms_mode=os.getenv("PFMS_MODE", cls.pfms_mode),
            esakshi_mode=os.getenv("ESAKSHI_MODE", cls.esakshi_mode),
        )
        settings.validate()
        return settings

    def validate(self) -> None:
        total_weight = self.risk_weight_duplicate + self.risk_weight_cost + self.risk_weight_graph
        if abs(total_weight - 1.0) > 0.0001:
            raise ValueError("Risk weights must sum to 1.0")
        if self.risk_green_max >= self.risk_red_min:
            raise ValueError("Risk thresholds must satisfy RISK_GREEN_MAX < RISK_RED_MIN")
        if self.duplicate_radius_km <= 0:
            raise ValueError("DUPLICATE_RADIUS_KM must be positive")
        if not 0 <= self.duplicate_similarity_threshold <= 1:
            raise ValueError("DUPLICATE_SIMILARITY_THRESHOLD must be between 0 and 1")


settings = Settings.from_env()
