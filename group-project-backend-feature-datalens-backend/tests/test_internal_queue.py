"""비공개 Queue worker와 백엔드 작업 실행 API의 연계 테스트."""

from fastapi import FastAPI
from pydantic import SecretStr
from starlette.testclient import TestClient

from tests.conftest import requires_db

pytestmark = requires_db

CSV = b"name,amount\nAlice,100\nBob,200\n"
SECRET = "queue-worker-test-secret-32-characters"


def upload(client: TestClient) -> tuple[str, str]:
    response = client.post(
        "/api/v1/files",
        files={"file": ("people.csv", CSV, "text/csv")},
    )
    assert response.status_code == 201
    file_id = response.json()["data"]["fileId"]
    detail = client.get(f"/api/v1/files/{file_id}")
    assert detail.status_code == 200
    return file_id, detail.json()["data"]["lastJobId"]


def test_internal_queue_endpoint_authenticates_and_processes(db_client: TestClient) -> None:
    assert isinstance(db_client.app, FastAPI)
    db_client.app.state.settings.queue_worker_secret = SecretStr(SECRET)
    file_id, job_id = upload(db_client)

    denied = db_client.post(
        f"/internal/queue/jobs/{job_id}",
        json={"deliveryCount": 1},
        headers={"x-queue-worker-secret": "wrong"},
    )
    assert denied.status_code == 403

    processed = db_client.post(
        f"/internal/queue/jobs/{job_id}",
        json={"deliveryCount": 1},
        headers={"x-queue-worker-secret": SECRET},
    )
    assert processed.status_code == 200
    assert processed.json()["data"]["processed"] is True
    assert db_client.get(f"/api/v1/jobs/{job_id}").json()["data"]["status"] == "completed"
    assert db_client.get(f"/api/v1/files/{file_id}").json()["data"]["status"] == "completed"

    duplicate = db_client.post(
        f"/internal/queue/jobs/{job_id}",
        json={"deliveryCount": 2},
        headers={"x-queue-worker-secret": SECRET},
    )
    assert duplicate.status_code == 200
    assert duplicate.json()["data"]["processed"] is False
