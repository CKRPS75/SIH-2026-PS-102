from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[2]
GEMINI_ENDPOINT_TEMPLATE = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
DEFAULT_FLASH_MODEL = "gemini-3.5-flash"
DEFAULT_TIMEOUT_SECONDS = 8.0
DEFAULT_THINKING_LEVEL = "minimal"


@dataclass(frozen=True)
class AuditSummary:
    comment: str
    reason_description: str


def _clean_text(value: Any) -> str:
    text = "" if value is None else str(value)
    text = re.sub(r"\b(?:MPLADS|TEST|TRAIN|LIVE|REF)-[A-Z0-9-]+\b", "reference case", text, flags=re.I)
    text = re.sub(r"\b[A-Z]{2,}-\d{3,}\b", "reference case", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


class FlashSummarizationService:
    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str | None = None,
        timeout_seconds: float | None = None,
    ) -> None:
        load_dotenv(BASE_DIR / ".env")
        self.api_key = api_key if api_key is not None else os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY") or ""
        self.model = model or os.getenv("GEMINI_FLASH_MODEL") or DEFAULT_FLASH_MODEL
        self.timeout_seconds = timeout_seconds or float(os.getenv("GEMINI_FLASH_TIMEOUT_SECONDS", DEFAULT_TIMEOUT_SECONDS))
        self.thinking_level = os.getenv("GEMINI_FLASH_THINKING_LEVEL") or DEFAULT_THINKING_LEVEL

    @property
    def enabled(self) -> bool:
        return bool(self.api_key.strip())

    def summarize(
        self,
        *,
        flag: str,
        rating: float,
        comment: str,
        reason_description: str,
        reasons: list[str],
        component_scores: dict[str, float],
    ) -> AuditSummary | None:
        if not self.enabled:
            return None

        prompt = self._build_prompt(
            flag=flag,
            rating=rating,
            comment=comment,
            reason_description=reason_description,
            reasons=reasons,
            component_scores=component_scores,
        )
        try:
            response = httpx.post(
                GEMINI_ENDPOINT_TEMPLATE.format(model=self.model),
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": self.api_key,
                },
                json={
                    "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "maxOutputTokens": 512,
                        "thinkingConfig": {"thinkingLevel": self.thinking_level},
                        "responseMimeType": "application/json",
                    },
                },
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
            parsed = self._parse_response(response.json())
        except Exception:
            return None

        summary = AuditSummary(
            comment=_clean_text(parsed.get("comment"))[:180],
            reason_description=_clean_text(parsed.get("reason_description"))[:320],
        )
        if not summary.comment or not summary.reason_description:
            return None
        return summary

    def _build_prompt(
        self,
        *,
        flag: str,
        rating: float,
        comment: str,
        reason_description: str,
        reasons: list[str],
        component_scores: dict[str, float],
    ) -> str:
        payload = {
            "flag": flag,
            "rating_out_of_10": rating,
            "current_comment": _clean_text(comment),
            "current_reason_description": _clean_text(reason_description),
            "risk_reasons": [_clean_text(reason) for reason in reasons],
            "component_scores": {
                "duplicate": round(float(component_scores.get("duplicate", 0.0)), 1),
                "financial": round(float(component_scores.get("financial", 0.0)), 1),
                "split_sanction": round(float(component_scores.get("split_sanction", 0.0)), 1),
            },
        }
        return (
            "Rewrite this MPLADS anomaly audit result for a common citizen. "
            "Do not mention project IDs, model names, equations, thresholds, private data, or confirmed fraud. "
            "Use simple Indian English. Keep comment under 16 words. "
            "Keep reason_description under 35 words. "
            "Return only JSON with keys comment and reason_description.\n\n"
            f"Audit result:\n{json.dumps(payload, ensure_ascii=False)}"
        )

    def _parse_response(self, payload: dict[str, Any]) -> dict[str, str]:
        candidates = payload.get("candidates") or []
        parts = ((candidates[0] or {}).get("content") or {}).get("parts") if candidates else []
        text = " ".join(str(part.get("text", "")) for part in parts or []).strip()
        if not text:
            return {}
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?", "", text).strip()
            text = re.sub(r"```$", "", text).strip()
        parsed = json.loads(text)
        if not isinstance(parsed, dict):
            return {}
        return {
            "comment": str(parsed.get("comment", "")),
            "reason_description": str(parsed.get("reason_description", "")),
        }
