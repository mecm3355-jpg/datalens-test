"""비공개 서비스 바인딩을 통해서만 호출하는 Queue 작업 실행 API."""

import hmac
from typing import Annotated

from bson import ObjectId
from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, ConfigDict, Field

from app.api.deps import get_app_settings
from app.core.config import Settings
from app.core.database import Mongo, get_mongo
from app.core.errors import AppError
from app.schemas.common import ApiModel, ApiResponse, ok
from app.services.job_handlers import HANDLERS
from app.services.job_runner import JobRunner

router = APIRouter(prefix="/internal/queue", include_in_schema=False)


class QueueDelivery(BaseModel):
    """Queue가 전달한 현재 시도 횟수."""

    model_config = ConfigDict(populate_by_name=True)
    delivery_count: int = Field(default=1, alias="deliveryCount", ge=1, le=100)


class QueueJobResult(ApiModel):
    """중복 전달을 포함한 작업 선점 결과."""

    processed: bool


@router.post("/jobs/{job_id}", response_model=ApiResponse[QueueJobResult])
async def process_queue_job(
    job_id: str,
    delivery: QueueDelivery,
    mongo: Annotated[Mongo, Depends(get_mongo)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    worker_secret: Annotated[str | None, Header(alias="x-queue-worker-secret")] = None,
) -> ApiResponse[QueueJobResult]:
    """Queue 메시지가 지정한 작업을 원자적으로 선점해 실행한다."""
    expected = (
        settings.queue_worker_secret.get_secret_value()
        if settings.queue_worker_secret is not None
        else ""
    )
    if not expected:
        raise AppError(
            "QUEUE_WORKER_NOT_CONFIGURED",
            "Queue worker 인증 정보가 설정되지 않았습니다.",
            503,
        )
    if worker_secret is None or not hmac.compare_digest(worker_secret, expected):
        raise AppError("QUEUE_WORKER_FORBIDDEN", "Queue worker 요청을 인증할 수 없습니다.", 403)
    if not ObjectId.is_valid(job_id):
        raise AppError("INVALID_JOB_ID", "작업 ID 형식이 올바르지 않습니다.", 422)

    processed = await JobRunner(mongo.db, settings, HANDLERS).run_job(
        ObjectId(job_id),
        recover_stale=delivery.delivery_count > 1,
        retry_unexpected=delivery.delivery_count < 3,
    )
    return ok(QueueJobResult(processed=processed))
