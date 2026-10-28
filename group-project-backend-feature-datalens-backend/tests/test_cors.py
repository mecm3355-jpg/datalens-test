from pathlib import Path

from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import make_settings


def test_configured_frontend_origin_can_call_api(tmp_path: Path) -> None:
    """설정한 프런트엔드 출처의 사전 요청에 CORS 헤더를 돌려준다.

    파라미터:
        tmp_path: 테스트 저장소 경로
    """
    settings = make_settings(tmp_path, cors_origins="https://datalenstest.vercel.app")
    app = create_app(settings)

    client = TestClient(app, raise_server_exceptions=False)
    response = client.options(
        "/api/v1/files",
        headers={
            "Origin": "https://datalenstest.vercel.app",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://datalenstest.vercel.app"
