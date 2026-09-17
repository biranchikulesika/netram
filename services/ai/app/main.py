import time
from typing import Any

from fastapi import FastAPI, HTTPException

from app.attendance import estimate_site_attendance
from app.domain import (
    AnomalyScore,
    AttendanceEstimationRequest,
    SnapshotInferenceRequest,
)
from app.inference import analyze_cctv_snapshot
from app.privacy import sanitize_payload

app = FastAPI(
    title="Netram AI Advisory Service",
    version="0.1.0",
    description="Advisory AI inference service for Netram (DoSJE). Never authoritative (§7, §36).",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai"}


@app.post("/v1/anomalies/detect")
def detect(payload: dict[str, Any]) -> dict[str, Any]:
    """Advisory anomaly detection. Sanitizes input and returns reviewable findings."""
    sanitized = sanitize_payload(payload)

    raw_score = sanitized.get("score", 0.0)
    try:
        score_val = max(0.0, min(1.0, float(raw_score)))
    except (ValueError, TypeError):
        score_val = 0.0

    raw_severity = str(sanitized.get("severity", "low")).lower()
    if raw_severity not in ["low", "medium", "high", "critical"]:
        raw_severity = "low"

    anomaly = AnomalyScore(
        anomaly_type=sanitized.get("anomaly_type", "unknown"),
        severity=raw_severity,
        score=score_val,
        confidence=sanitized.get("confidence", 0.85),
        explanation=sanitized.get("explanation", ""),
        model_version=sanitized.get("model_version", "netram-advisory-v1.0"),
        supporting_evidence=sanitized.get("supporting_evidence", []),
        metadata=sanitized.get("metadata", {}),
    )
    return {
        "result": anomaly.model_dump(),
        "meta": {"advisory": True, "reviewable": True, "at": time.time()},
    }


@app.post("/v1/inference/cctv-snapshot")
def cctv_snapshot_inference(request: SnapshotInferenceRequest) -> dict[str, Any]:
    """Analyzes a CCTV snapshot frame for safety equipment, site hazards, and integrity (§7, §36)."""
    result = analyze_cctv_snapshot(request)
    return {
        "result": result.model_dump(),
        "meta": {"advisory": True, "reviewable": True, "at": time.time()},
    }


@app.post("/v1/attendance/estimate")
def site_attendance_estimation(request: AttendanceEstimationRequest) -> dict[str, Any]:
    """Estimates site headcount from CCTV frame data and checks discrepancy (§36, §39)."""
    result = estimate_site_attendance(request)
    return {
        "result": result.model_dump(),
        "meta": {"advisory": True, "reviewable": True, "at": time.time()},
    }