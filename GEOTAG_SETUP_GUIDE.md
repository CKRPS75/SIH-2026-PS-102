# EXIF Geotag Photo Verification Feature - Setup & Usage Guide

## Overview

This feature integrates automated EXIF metadata geotag photo verification into the FastAPI backend. Field inspectors can upload photos of completed MPLADS projects, and the system will verify that the photo's GPS coordinates (extracted from EXIF metadata) match the project's target location within a specified tolerance distance.

## Installation Steps

### Step 1: Install Required Packages

The required packages are already defined in `requirements.txt`:
- `ExifRead>=3.0` - for reading photo EXIF metadata
- `geopy>=2.4` - for geocoding and distance calculations
- `python-multipart>=0.0.6` - for FastAPI file upload support

Install/update them using pip:

```bash
cd backend

# If using a virtual environment (recommended)
# Windows
.\.venv\Scripts\pip install -r requirements.txt

# macOS/Linux
source .venv/bin/activate
pip install -r requirements.txt

# Alternatively, install specific packages individually
pip install exifread>=3.0 geopy>=2.4 python-multipart>=0.0.6
```

### Step 2: Verify Installation

Test that all required packages are installed:

```bash
python -c "import exifread; print('exifread OK')"
python -c "import geopy; print('geopy OK')"
python -c "import fastapi; from fastapi import File, Form, UploadFile; print('FastAPI OK')"
```

### Step 3: Start the Backend Server

```bash
cd backend
.\.venv\Scripts\uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The API documentation will be available at: `http://127.0.0.1:8000/docs`

---

## API Endpoint

### POST `/api/v1/verify-geotag`

**Purpose**: Verify that an uploaded photo's GPS coordinates match the target project location.

**URL**: `http://127.0.0.1:8000/api/v1/verify-geotag`

**Request Format**: `multipart/form-data`

#### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | File | Yes | Photo file (JPG, PNG, etc.) with embedded EXIF GPS data |
| `project_data` | String (JSON) | Yes | JSON string containing project location data |
| `max_distance_meters` | Float | No | Maximum acceptable distance in meters (default: 100.0) |

#### Project Data JSON Format

The `project_data` parameter must be a JSON string containing at least one of:
- `locality` - e.g., "Kurla West"
- `constituency` - e.g., "Mumbai North East"
- `state` - e.g., "Maharashtra"
- `country` - e.g., "India" (optional)

**Example JSON**:
```json
{
  "locality": "Kurla West",
  "constituency": "Mumbai North East",
  "state": "Maharashtra",
  "country": "India"
}
```

#### Response Format

Success (HTTP 200):
```json
{
  "status": "VERIFIED|REJECTED|FAILED",
  "distance_meters": 45.3,
  "photo_coords": [19.0123, 72.8456],
  "target_coords": [19.0125, 72.8460],
  "reason": "Photo location verified within tolerance of 100m.",
  "photo_filename": "photo.jpg"
}
```

**Response Fields**:
- `status`: 
  - `"VERIFIED"` - Photo location matches target (within tolerance)
  - `"REJECTED"` - Photo location outside tolerance range
  - `"FAILED"` - Unable to verify (missing data, geocoding error, etc.)
- `distance_meters`: Distance between photo GPS and target location (null if calculation failed)
- `photo_coords`: `[latitude, longitude]` extracted from photo EXIF (null if not found)
- `target_coords`: `[latitude, longitude]` from geocoding the location query (null if not found)
- `reason`: Human-readable explanation of the result
- `photo_filename`: Name of the uploaded file

Error Responses:
- `400 Bad Request` - Invalid JSON, missing fields, or file upload errors
- `500 Internal Server Error` - Unexpected verification errors

---

## Usage Examples

### Example 1: Using cURL (Command Line)

```bash
# Basic example
curl -X POST "http://127.0.0.1:8000/api/v1/verify-geotag" \
  -F "file=@/path/to/photo.jpg" \
  -F "project_data={\"locality\":\"Kurla West\",\"state\":\"Maharashtra\"}" \
  -F "max_distance_meters=100"

# With all location fields
curl -X POST "http://127.0.0.1:8000/api/v1/verify-geotag" \
  -F "file=@inspection_photo.jpg" \
  -F "project_data={\"locality\":\"Kurla West\",\"constituency\":\"Mumbai North East\",\"state\":\"Maharashtra\",\"country\":\"India\"}" \
  -F "max_distance_meters=150"
```

### Example 2: Using Python (requests library)

```python
import requests
import json

# Prepare request data
url = "http://127.0.0.1:8000/api/v1/verify-geotag"

project_data = {
    "locality": "Kurla West",
    "constituency": "Mumbai North East",
    "state": "Maharashtra",
    "country": "India"
}

files = {
    "file": open("photo.jpg", "rb"),
}

data = {
    "project_data": json.dumps(project_data),
    "max_distance_meters": 100.0,
}

# Make request
response = requests.post(url, files=files, data=data)
result = response.json()

print(f"Status: {result['status']}")
print(f"Distance: {result['distance_meters']} meters")
print(f"Reason: {result['reason']}")

# Close file
files["file"].close()
```

### Example 3: Using HTML Form

```html
<!DOCTYPE html>
<html>
<head>
    <title>Photo Geotag Verification</title>
</head>
<body>
    <h1>MPLADS Photo Verification</h1>
    <form id="verifyForm">
        <div>
            <label for="photoFile">Select Photo:</label>
            <input type="file" id="photoFile" name="file" accept="image/*" required>
        </div>

        <div>
            <label for="locality">Locality:</label>
            <input type="text" id="locality" name="locality" placeholder="e.g., Kurla West">
        </div>

        <div>
            <label for="constituency">Constituency:</label>
            <input type="text" id="constituency" name="constituency" placeholder="e.g., Mumbai North East">
        </div>

        <div>
            <label for="state">State:</label>
            <input type="text" id="state" name="state" placeholder="e.g., Maharashtra" required>
        </div>

        <div>
            <label for="maxDistance">Max Distance (meters):</label>
            <input type="number" id="maxDistance" name="maxDistance" value="100" min="1">
        </div>

        <button type="submit">Verify Photo Location</button>
    </form>

    <div id="result" style="margin-top: 20px; display:none;">
        <h2>Verification Result</h2>
        <pre id="resultText"></pre>
    </div>

    <script>
        document.getElementById("verifyForm").addEventListener("submit", async (e) => {
            e.preventDefault();

            const formData = new FormData();
            formData.append("file", document.getElementById("photoFile").files[0]);

            const projectData = {
                locality: document.getElementById("locality").value || undefined,
                constituency: document.getElementById("constituency").value || undefined,
                state: document.getElementById("state").value,
            };

            formData.append("project_data", JSON.stringify(projectData));
            formData.append("max_distance_meters", document.getElementById("maxDistance").value);

            try {
                const response = await fetch("http://127.0.0.1:8000/api/v1/verify-geotag", {
                    method: "POST",
                    body: formData,
                });

                const result = await response.json();
                document.getElementById("resultText").textContent = JSON.stringify(result, null, 2);
                document.getElementById("result").style.display = "block";
            } catch (error) {
                console.error("Error:", error);
                alert("Verification failed: " + error.message);
            }
        });
    </script>
</body>
</html>
```

### Example 4: Using Postman

1. **Create new POST request**:
   - URL: `http://127.0.0.1:8000/api/v1/verify-geotag`

2. **Set request body to `form-data`**:
   - Key: `file` | Type: File | Value: (select photo.jpg)
   - Key: `project_data` | Type: Text | Value: `{"locality":"Kurla West","state":"Maharashtra"}`
   - Key: `max_distance_meters` | Type: Text | Value: `100`

3. **Send the request** and view the JSON response

---

## How It Works

### Step-by-Step Process

1. **EXIF GPS Extraction**:
   - Photo file is received and saved to a temporary location
   - `exifread` library extracts GPS coordinates from photo EXIF metadata
   - GPS coordinates are in DMS (Degrees/Minutes/Seconds) format and are converted to Decimal Degrees

2. **Location Geocoding**:
   - Project location data (locality, constituency, state) is combined into a single query string
   - `geopy.Nominatim` geocoder converts the address to GPS coordinates
   - Uses OpenStreetMap data via the Nominatim service

3. **Distance Calculation**:
   - `geopy.distance.geodesic` calculates the distance between photo coordinates and target coordinates
   - Uses the Vincenty distance formula for accurate measurement on Earth's surface

4. **Verification Decision**:
   - If distance ≤ max_distance_meters: Status = "VERIFIED"
   - If distance > max_distance_meters: Status = "REJECTED"
   - If any step fails: Status = "FAILED" with descriptive reason

5. **Cleanup**:
   - Temporary file is deleted after verification
   - Result is returned as JSON

---

## Error Handling

### Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "No GPS EXIF data found" | Photo doesn't have location metadata | Ensure photo was taken with location services enabled |
| "Could not geocode target location" | Invalid or too vague location string | Use more specific location data (locality + state) |
| "INVALID_JSON" | Malformed JSON in project_data | Verify JSON syntax (use `json.dumps()` in Python) |
| "MISSING_FILE" | No file uploaded | Ensure file parameter is included |
| 413 Payload Too Large | File is too large | Optimize photo size before upload |

### Logging

All operations are logged with appropriate levels:
- **INFO**: GPS extraction, geocoding results, verification status
- **WARNING**: Missing EXIF data, failed geocoding
- **ERROR**: File I/O errors, malformed data, unexpected failures

Check logs:
```bash
# View logs from running server output
# Logs include correlation IDs for tracing

# Or configure logging file in settings
```

---

## Production Considerations

### Performance Optimization

1. **Caching**: Consider caching geocoding results for frequently verified locations
2. **Rate Limiting**: Implement rate limiting on the `/verify-geotag` endpoint
3. **Timeout Settings**: Adjust geocoding timeout (default 10 seconds) based on network conditions

### Security

1. **File Validation**: Validate file extension and MIME type before processing
2. **Size Limits**: Enforce maximum file size to prevent resource exhaustion
3. **Input Sanitization**: All input is validated and sanitized
4. **CORS**: CORS is already configured in main.py

### Monitoring

1. **Add metrics**: Track verification success/failure rates
2. **Add alerts**: Alert on high failure rates or timeout errors
3. **Log aggregation**: Collect logs from all instances for monitoring

---

## Code Structure

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       └── projects.py          ← New endpoint added here
│   ├── services/
│   │   ├── geotag_verifier.py       ← NEW: Geotag verification logic
│   │   ├── ingestion_service.py
│   │   ├── evaluation_service.py
│   │   └── ...
│   ├── main.py
│   └── ...
├── requirements.txt                  ← Updated with python-multipart
└── ...
```

---

## Testing

### Unit Test Example

```python
from app.services.geotag_verifier import extract_exif_gps, verify_photo_location

def test_extract_exif_gps():
    # Test with a real photo containing EXIF data
    coords = extract_exif_gps("test_photo_with_gps.jpg")
    assert coords is not None
    assert len(coords) == 2
    assert -90 <= coords[0] <= 90  # latitude range
    assert -180 <= coords[1] <= 180  # longitude range

def test_verify_photo_location():
    result = verify_photo_location(
        "test_photo.jpg",
        "Mumbai, Maharashtra, India",
        max_distance_meters=100
    )
    assert "status" in result
    assert result["status"] in ["VERIFIED", "REJECTED", "FAILED"]
    assert "distance_meters" in result
    assert "reason" in result
```

---

## API Documentation

Interactive API documentation is available at:
- **Swagger UI**: `http://127.0.0.1:8000/docs`
- **ReDoc**: `http://127.0.0.1:8000/redoc`

Both will show the `/api/v1/verify-geotag` endpoint with all parameters and example responses.

---

## Support & Troubleshooting

- Check backend logs for detailed error messages
- Ensure photo has valid EXIF GPS metadata (use `exiftool` to inspect)
- Test with a known location and photo to validate setup
- Contact infrastructure team if Nominatim service is unavailable
