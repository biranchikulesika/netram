import time

from fastapi import FastAPI

from app.domain import AnomalyScore

app = FastAPI(title="Netram AI", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "ai"}


@app.post("/v1/anomalies/detect")
def detect(payload: dict) -> dict:
    """Advisory anomaly detection. Returns evidence, never a verdict."""
    anomaly = AnomalyScore(
        anomaly_type=payload.get("anomaly_type", "unknown"),
        severity=payload.get("severity", "low"),
        score=payload.get("score", 0.0),
        explanation=payload.get("explanation", ""),
        model_version=payload.get("model_version", "dev"),
        supporting_evidence=payload.get("supporting_evidence", []),
    )
    return {
        "result": anomaly.model_dump(),
        "meta": {"advisory": True, "reviewable": True, "at": time.time()},
    }