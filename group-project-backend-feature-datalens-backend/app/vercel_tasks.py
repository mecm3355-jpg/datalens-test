"""Vercel Queues 구독자. API 프로세스와 분리해 장시간 작업을 실행한다."""

from bson import ObjectId
from pydantic import BaseModel
from vercel.queue import subscribe

from app.core.config import get_settings
from app.core.database import Mongo
from app.repositories.indexes import ensure_indexes
from app.services.job_handlers import HANDLERS
from app.services.job_runner import JobRunner


class JobMessage(BaseModel):
    """Queue에 넣는 최소 작업 식별자."""

    job_id: str


@subscribe(topic="datalens-jobs", consumer_group="datalens-worker", max_attempts=3)
async def process_job(message: JobMessage) -> None:
    """메시지의 queued 작업 하나를 선점해 기존 작업 처리기로 실행한다."""
    settings = get_settings()
    mongo = Mongo(settings.mongodb_uri, settings.mongodb_db_name)
    try:
        await ensure_indexes(mongo.db)
        await JobRunner(mongo.db, settings, HANDLERS).run_job(ObjectId(message.job_id))
    finally:
        await mongo.close()
