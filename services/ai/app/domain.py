"""
AI is an informer, not an authority (AGENTS.md §36).

AI outputs are reviewable information. They must never declare fraud as fact,
never modify official truth, and never bypass authority workflows. Consumers
(watchlists, control room, inspectors) route findings through the normal
domain pipeline: New -> Reviewed -> Dismissed/Investigated/Acted Upon.
"""

from pydantic import BaseModel, Field


class AnomalyScore(BaseModel):
    """Confidence-weighted, reviewable anomaly result."""

    anomaly_type: str = Field(description="e.g. 'ghost_project', 'attendance_drop'")
    severity: str = Field(pattern="^(low|medium|high)$")
    score: float = Field(ge=0, le=1, description="model confidence score")
    explanation: str = ""
    model_version: str
    supporting_evidence: list[str] = Field(default_factory=list)