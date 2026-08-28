from __future__ import annotations

from math import asin, cos, radians, sin, sqrt


EARTH_RADIUS_M = 6_371_000


def haversine_distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    lat1_r = radians(lat1)
    lat2_r = radians(lat2)
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(lat1_r) * cos(lat2_r) * sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_M * asin(sqrt(a))
