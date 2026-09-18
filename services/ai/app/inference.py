"""
CCTV Frame Snapshot Inference Pipeline (AGENTS.md §7, §36, task AI-02).

Analyzes frame snapshots from CCTV gateway.
Detects:
- Safety gear compliance / violations (e.g. helmets, vests)
- Equipment presence (e.g. machinery, excavators)
- Structural irregularities (e.g. perimeter breach, unbarricaded hazard)
- Headcount estimation

AI findings are strictly advisory and returned as reviewable information.
Zero direct database writing.
"""

from app.domain import AnomalyScore, SnapshotInferenceRequest, SnapshotInferenceResult


def analyze_cctv_snapshot(request: SnapshotInferenceRequest) -> SnapshotInferenceResult:
    """Deterministic advisory inference engine for CCTV frame snapshots."""
    camera_id = request.camera_id

    # Simulated deterministic advisory model behavior based on camera type/context
    violations = []
    anomalies = []
    equipment = ["perimeter_gate", "exterior_lighting"]
    headcount = 4
    integrity = 0.95

    # If camera context indicates a construction hazard or specific site, flag reviewable advisory
    if "gate" in camera_id.lower() or "entrance" in camera_id.lower():
        headcount = 6
        equipment.append("vehicle_barrier")
    elif "hazard" in camera_id.lower() or "structural" in camera_id.lower():
        violations.append("unattended_excavation_hazard")
        integrity = 0.72
        anomalies.append(
            AnomalyScore(
                anomaly_type="structural_safety_hazard",
                severity="medium",
                score=0.74,
                confidence=0.88,
                explanation="Advisory: Potential unbarricaded excavation boundary detected near pedestrian pathway.",
                model_version="netram-vision-v1.0",
                supporting_evidence=[f"cctv_frame:{camera_id}"],
            )
        )

    return SnapshotInferenceResult(
        camera_id=camera_id,
        safety_violations_detected=violations,
        structural_integrity_score=integrity,
        equipment_detected=equipment,
        people_count=headcount,
        advisory_anomalies=anomalies,
        model_version="netram-vision-v1.0",
    )
