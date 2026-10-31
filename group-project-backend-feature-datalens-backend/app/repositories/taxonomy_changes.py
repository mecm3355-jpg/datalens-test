from pymongo import DESCENDING, IndexModel
from pymongo.asynchronous.database import AsyncDatabase

from app.core.database import Document
from app.repositories.base import BaseRepository
from app.schemas.complaint import TaxonomyChangeDocument


class TaxonomyChangeRepository(BaseRepository[TaxonomyChangeDocument]):
    """카테고리 체계 병합·분할 이력 저장소."""

    COLLECTION = "taxonomy_changes"
    INDEXES = [IndexModel([("createdAt", DESCENDING)], name="createdAt")]

    def __init__(self, db: AsyncDatabase[Document]) -> None:
        super().__init__(db, TaxonomyChangeDocument)

    async def list_recent(self, limit: int = 100) -> list[TaxonomyChangeDocument]:
        """최근 변경 이력을 최신순으로 돌려준다."""
        return await self._find({}, [("createdAt", DESCENDING), ("_id", DESCENDING)], limit=limit)
