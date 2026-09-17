from fastapi.testclient import TestClient

from app.domain import AnomalyScore
from app.main import app
from app.privacy import sanitize_payload, sanitize_text

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_detect_is_advisory():
    r = client.post(
        "/v1/anomalies/detect",
        json={
            "anomaly_type": "ghost_project",
            "score": 0.8,
            "severity": "high",
            "confidence": 0.9,
            "explanation": "High expenditure with no progress records",
            "supporting_evidence": ["doc:report-123"],
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["meta"]["advisory"] is True
    assert body["meta"]["reviewable"] is True
    assert "verdict" not in body  # AI never declares guilt or fact (§36)
    assert body["result"]["anomaly_type"] == "ghost_project"
    assert body["result"]["severity"] == "high"
    assert body["result"]["score"] == 0.8


def test_cctv_snapshot_inference():
    # Normal gate camera
    r = client.post(
        "/v1/inference/cctv-snapshot",
        json={"camera_id": "cctv:vani-gate", "project_id": "proj-101"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["meta"]["advisory"] is True
    res = body["result"]
    assert res["camera_id"] == "cctv:vani-gate"
    assert res["people_count"] == 6
    assert "vehicle_barrier" in res["equipment_detected"]

    # Hazard area camera
    r_hazard = client.post(
        "/v1/inference/cctv-snapshot",
        json={"camera_id": "cctv:pit-hazard-zone", "project_id": "proj-101"},
    )
    assert r_hazard.status_code == 200
    res_hazard = r_hazard.json()["result"]
    assert len(res_hazard["safety_violations_detected"]) > 0
    assert len(res_hazard["advisory_anomalies"]) > 0
    assert res_hazard["advisory_anomalies"][0]["severity"] == "medium"


def test_attendance_estimation_advisory():
    # Low discrepancy case (reported 50, estimated ~41) -> no anomaly
    r_normal = client.post(
        "/v1/attendance/estimate",
        json={
            "project_id": "proj-101",
            "camera_id": "cctv:vani-gate",
            "reported_attendance": 50,
            "shift_date": "2026-03-15",
            "snapshot_hashes": ["sha256:abc12345", "sha256:def67890"],
        },
    )
    assert r_normal.status_code == 200
    res_normal = r_normal.json()["result"]
    assert res_normal["reported_attendance"] == 50
    assert res_normal["estimated_headcount"] == 41
    assert res_normal["advisory_anomaly"] is None

    # High discrepancy case (reported 100, estimated ~18) -> triggers advisory review
    r_discrepancy = client.post(
        "/v1/attendance/estimate",
        json={
            "project_id": "proj-102",
            "camera_id": "cctv:vani-gate",
            "reported_attendance": 100,
            "shift_date": "2026-03-15",
            "snapshot_hashes": ["sha256:frame01"],
        },
    )
    assert r_discrepancy.status_code == 200
    res_disc = r_discrepancy.json()["result"]
    assert res_disc["discrepancy_ratio"] > 0.30
    assert res_disc["advisory_anomaly"] is not None
    assert res_disc["advisory_anomaly"]["anomaly_type"] == "attendance_headcount_discrepancy"
    # Never asserts guilt, only provides reviewable explanation
    assert "Review recommended" in res_disc["advisory_anomaly"]["explanation"]


def test_privacy_and_pii_sanitization():
    raw_text = "Worker Ramesh (Phone: 9876543210, Aadhaar: 1234 5678 9012, email: worker@test.com) present."
    sanitized = sanitize_text(raw_text)
    assert "9876543210" not in sanitized
    assert "1234 5678 9012" not in sanitized
    assert "worker@test.com" not in sanitized
    assert "[REDACTED_PHONE]" in sanitized
    assert "[REDACTED_AADHAAR]" in sanitized
    assert "[REDACTED_EMAIL]" in sanitized

    payload = {
        "user_name": "Ramesh",
        "biometric_data": "raw_face_embedding_bytes",
        "contact": "9876543210",
        "nested": {"iris_scan": "raw_iris_data"},
    }
    cleaned = sanitize_payload(payload)
    assert cleaned["biometric_data"] == "[REDACTED_RAW_BIOMETRIC]"
    assert cleaned["nested"]["iris_scan"] == "[REDACTED_RAW_BIOMETRIC]"
    assert cleaned["contact"] == "[REDACTED_PHONE]"