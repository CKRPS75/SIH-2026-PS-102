"""
EXIF Metadata Geotag Photo Verification Service.

This module provides functions to extract GPS coordinates from photo EXIF metadata
and verify that the photo was taken at the expected project location within a
specified tolerance distance.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import exifread
from geopy.distance import geodesic
from geopy.exc import GeocoderTimedOut, GeocoderUnavailable
from geopy.geocoders import Nominatim


logger = logging.getLogger(__name__)


def _dms_to_decimal(dms_data: Any) -> float:
    """
    Convert GPS coordinates from Degrees/Minutes/Seconds (DMS) to Decimal Degrees.

    Args:
        dms_data: exifread.GPS IFD entry containing DMS data.

    Returns:
        float: Coordinate in decimal degrees.

    Raises:
        ValueError: If the data cannot be converted.
    """
    try:
        # Extract the ratio values (degrees, minutes, seconds)
        values = dms_data.values
        degrees = float(values[0].num) / float(values[0].den)
        minutes = float(values[1].num) / float(values[1].den)
        seconds = float(values[2].num) / float(values[2].den)

        # Calculate decimal degrees: degrees + minutes/60 + seconds/3600
        decimal = degrees + (minutes / 60.0) + (seconds / 3600.0)
        return decimal
    except (AttributeError, IndexError, ZeroDivisionError, TypeError) as e:
        raise ValueError(f"Failed to convert DMS to decimal: {e}") from e


def extract_exif_gps(image_file_path: str | Path) -> tuple[float, float] | None:
    """
    Extract GPS latitude and longitude from photo EXIF metadata.

    Converts GPS coordinates from DMS (Degrees/Minutes/Seconds) format stored
    in EXIF data to decimal degrees.

    Args:
        image_file_path: Path to the image file.

    Returns:
        tuple[float, float] | None: (latitude, longitude) in decimal degrees,
                                     or None if EXIF GPS data is not found.

    Raises:
        FileNotFoundError: If the image file does not exist.
        ValueError: If EXIF data is corrupted or unreadable.
    """
    image_path = Path(image_file_path)

    if not image_path.exists():
        raise FileNotFoundError(f"Image file not found: {image_path}")

    try:
        with open(image_path, "rb") as f:
            tags = exifread.process_file(f, details=False)

        # Check for GPS IFD tags
        if "GPS GPSLatitude" not in tags or "GPS GPSLongitude" not in tags:
            logger.warning(f"No GPS EXIF data found in {image_path}")
            return None

        # Extract latitude and longitude
        lat = _dms_to_decimal(tags["GPS GPSLatitude"])
        lon = _dms_to_decimal(tags["GPS GPSLongitude"])

        # Apply direction indicators (N/S for latitude, E/W for longitude)
        if "GPS GPSLatitudeRef" in tags:
            lat_ref = tags["GPS GPSLatitudeRef"].values[0]
            if lat_ref == "S":
                lat = -lat

        if "GPS GPSLongitudeRef" in tags:
            lon_ref = tags["GPS GPSLongitudeRef"].values[0]
            if lon_ref == "W":
                lon = -lon

        logger.info(f"Extracted GPS coordinates from {image_path}: ({lat}, {lon})")
        return (lat, lon)

    except (OSError, IOError) as e:
        raise ValueError(f"Failed to read image file: {e}") from e
    except Exception as e:
        logger.error(f"Unexpected error extracting EXIF data: {e}")
        raise ValueError(f"Failed to extract EXIF GPS data: {e}") from e


def geocode_location(location_query: str, timeout: int = 10) -> tuple[float, float] | None:
    """
    Convert a location query string (address) to GPS coordinates using Nominatim.

    Args:
        location_query: Address string (e.g., "Kurla West, Mumbai North East, Maharashtra, India").
        timeout: Timeout in seconds for the geocoding request.

    Returns:
        tuple[float, float] | None: (latitude, longitude) in decimal degrees,
                                     or None if the location cannot be geocoded.
    """
    if not location_query or not location_query.strip():
        logger.warning("Empty location query provided")
        return None

    try:
        geolocator = Nominatim(user_agent="mplad_ai_backend")
        location = geolocator.geocode(location_query, timeout=timeout)

        if location is None:
            logger.warning(f"Could not geocode location: {location_query}")
            return None

        logger.info(f"Geocoded '{location_query}' to ({location.latitude}, {location.longitude})")
        return (location.latitude, location.longitude)

    except (GeocoderTimedOut, GeocoderUnavailable) as e:
        logger.error(f"Geocoding service unavailable for '{location_query}': {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error during geocoding: {e}")
        return None


def verify_photo_location(
    image_path: str | Path,
    location_query_str: str,
    max_distance_meters: float = 100.0,
) -> dict[str, Any]:
    """
    Verify that a photo's GPS coordinates match the target project location.

    Extracts GPS coordinates from the photo's EXIF metadata, geocodes the target
    location, and calculates the geodesic distance between them. Returns a
    structured verification result.

    Args:
        image_path: Path to the image file to verify.
        location_query_str: Address string for the target project location
                           (e.g., "Kurla West, Mumbai North East, Maharashtra, India").
        max_distance_meters: Maximum acceptable distance in meters. Default is 100.

    Returns:
        dict[str, Any]: Verification result containing:
            - status: "VERIFIED" (within tolerance), "REJECTED" (outside tolerance),
                     or "FAILED" (due to missing data or errors).
            - distance_meters: Measured distance in meters (or None if calculation failed).
            - photo_coords: GPS coordinates extracted from photo (lat, lon tuple or None).
            - target_coords: Geocoded target location coordinates (lat, lon tuple or None).
            - reason: Descriptive message explaining the result.

    Example:
        >>> result = verify_photo_location(
        ...     "/path/to/photo.jpg",
        ...     "Kurla West, Mumbai North East, Maharashtra, India",
        ...     max_distance_meters=100.0
        ... )
        >>> print(result)
        {
            "status": "VERIFIED",
            "distance_meters": 45.3,
            "photo_coords": (19.0123, 72.8456),
            "target_coords": (19.0125, 72.8460),
            "reason": "Photo location verified within tolerance of 100m."
        }
    """
    result = {
        "status": "FAILED",
        "distance_meters": None,
        "photo_coords": None,
        "target_coords": None,
        "reason": "",
    }

    # Step 1: Extract GPS coordinates from photo
    try:
        photo_coords = extract_exif_gps(image_path)
        if photo_coords is None:
            result["reason"] = "No GPS EXIF data found in the uploaded photo. Please ensure the photo contains GPS metadata."
            result["status"] = "FAILED"
            return result
        result["photo_coords"] = photo_coords
    except FileNotFoundError:
        result["reason"] = f"Image file not found: {image_path}"
        result["status"] = "FAILED"
        return result
    except ValueError as e:
        result["reason"] = f"Failed to extract EXIF GPS data: {str(e)}"
        result["status"] = "FAILED"
        return result

    # Step 2: Geocode the target location
    target_coords = geocode_location(location_query_str)
    if target_coords is None:
        result["reason"] = f"Could not geocode target location: '{location_query_str}'. Please verify the address."
        result["status"] = "FAILED"
        return result
    result["target_coords"] = target_coords

    # Step 3: Calculate geodesic distance
    try:
        distance_meters = geodesic(photo_coords, target_coords).meters
        result["distance_meters"] = distance_meters

        if distance_meters <= max_distance_meters:
            result["status"] = "VERIFIED"
            result["reason"] = (
                f"Photo location verified. Distance from target location: {distance_meters:.2f}m "
                f"(tolerance: {max_distance_meters}m)."
            )
        else:
            result["status"] = "REJECTED"
            result["reason"] = (
                f"Photo location rejected. Distance from target location: {distance_meters:.2f}m "
                f"exceeds maximum tolerance of {max_distance_meters}m."
            )
    except Exception as e:
        result["reason"] = f"Failed to calculate distance: {str(e)}"
        result["status"] = "FAILED"

    return result
