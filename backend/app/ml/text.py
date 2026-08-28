from __future__ import annotations

import re
import unicodedata


_SYNONYMS = {
    "const": "construction",
    "construct": "construction",
    "centre": "center",
    "communitycentre": "community center",
    "samaj": "community",
    "bhavan": "center",
    "hall": "center",
    "rd": "road",
    "drn": "drainage",
}


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value or "").lower()
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized)
    tokens = [_SYNONYMS.get(token, token) for token in normalized.split()]
    return " ".join(tokens)


def token_similarity(left: str, right: str) -> float:
    left_tokens = set(normalize_text(left).split())
    right_tokens = set(normalize_text(right).split())
    if not left_tokens or not right_tokens:
        return 0.0
    overlap = len(left_tokens & right_tokens)
    union = len(left_tokens | right_tokens)
    containment = overlap / min(len(left_tokens), len(right_tokens))
    jaccard = overlap / union
    return max(jaccard, containment * 0.92)
