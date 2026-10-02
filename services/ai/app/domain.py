"""
AI is an advisory informer, not an authority.

AI outputs are reviewable signals and recommendations. They must never declare
fraud as fact, never modify official truth, and never bypass authority workflows.
Consumers (watchlists, control room, inspectors) route findings through the normal
human review pipeline: New -> Reviewed -> Dismissed / Investigated / Acted Upon.
"""

from pydantic import BaseModel, Field


class AnomalyScore(BaseModel):
    """Confidence-weighted, reviewable anomaly result."""

    anomaly_type: str = Field(description="e.g. 'conflict' (violence/altercation), 'attendance_deviation' (planned)")
    severity: str = Field(pattern="^(low|medium|high)$")
    score: float = Field(ge=0, le=1, description="model confidence score")
    explanation: str = ""
    model_version: str
    supporting_evidence: list[str] = Field(default_factory=list)