from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_detect_is_advisory():
    r = client.post("/v1/anomalies/detect", json={"anomaly_type": "ghost_project", "score": 0.8})
    assert r.status_code == 200
    body = r.json()
    assert body["meta"]["advisory"] is True
    assert "verdict" not in body  # never says "fraud"
    assert body["result"]["anomaly_type"] == "ghost_project"