"""
AI is an informer, not an authority (AGENTS.md §36).

AI outputs are reviewable information. They must never declare fraud as fact,
never modify official truth, and never bypass authority workflows. Consumers
(watchlists, control room, inspectors) route findings through the normal
domain pipeline: New -> Reviewed -> Dismissed/Investigated/Acted Upon.
"""

from typing import Any, Literal
from pydantic import BaseModel, Field


class AnomalyScore(BaseModel):
    """Confidence-weighted, reviewable anomaly result (AI-01)."""

    anomaly_type: str = Field(description="e.g. 'ghost_project', 'attendance_drop', 'safety_violation'")
    severity: Literal["low", "medium", "high", "critical"] = Field(
        default="low", description="Advisory severity category"
    )
    score: float = Field(ge=0.0, le=1.0, description="Model anomaly severity score (0.0 to 1.0)")
    confidence: float = Field(
        ge=0.0, le=1.0, default=0.85, description="Model statistical confidence score"
    )
    explanation: str = Field(
        default="", description="Human-readable advisory explanation for reviewer"
    )
    model_version: str = Field(default="netram-advisory-v1.0")
    supporting_evidence: list[str] = Field(
        default_factory=list, description="Referenced evidence hashes, snapshot IDs, or metric references"
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict, description="Additional non-PII contextual metrics"
    )


class SnapshotInferenceRequest(BaseModel):
    """Input contract for CCTV frame analysis (AI-02)."""

    camera_id: str
    project_id: str | None = None
    snapshot_base64: str | None = None
    snapshot_url: str | None = None
    timestamp: str | None = None


class SnapshotInferenceResult(BaseModel):
    """Advisory output for CCTV frame analysis (AI-02)."""

    camera_id: str
    safety_violations_detected: list[str] = Field(default_factory=list)
    structural_integrity_score: float = Field(ge=0.0, le=1.0, default=1.0)
    equipment_detected: list[str] = Field(default_factory=list)
    people_count: int = Field(ge=0, default=0)
    advisory_anomalies: list[AnomalyScore] = Field(default_factory=list)
    model_version: str = "netram-vision-v1.0"


class AttendanceEstimationRequest(BaseModel):
    """Input contract for site attendance headcount estimation (AI-03)."""

    project_id: str
    camera_id: str
    reported_attendance: int = Field(ge=0, description="Reported attendance tally from contractor/facility")
    shift_date: str
    snapshot_hashes: list[str] = Field(
        default_factory=list, description="List of cryptographic hashes of site frames analyzed"
    )


class AttendanceEstimationResult(BaseModel):
    """Advisory output for site attendance estimation (AI-03). Zero raw biometric storage."""

    project_id: str
    reported_attendance: int
    estimated_headcount: int
    discrepancy_delta: int
    discrepancy_ratio: float
    advisory_anomaly: AnomalyScore | None = None
    model_version: str = "netram-attendance-v1.0"