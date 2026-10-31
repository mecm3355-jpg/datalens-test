"""카테고리 병합·분할·통계·인사이트 API 자료형."""

from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.common import ApiModel
from app.schemas.complaint import TaxonomyChangeDocument


class CategoryMergeRequest(ApiModel):
    source_category_id: str = Field(max_length=20)
    target_category_id: str = Field(max_length=20)
    reason: str | None = Field(default=None, max_length=500)


class CategorySplitRequest(ApiModel):
    source_category_id: str = Field(max_length=20)
    name: str = Field(min_length=1, max_length=100)
    group: str | None = Field(default=None, max_length=50)
    definition: str | None = Field(default=None, max_length=500)
    keywords: list[str] = Field(default_factory=list, max_length=10)
    complaint_ids: list[str] = Field(min_length=1, max_length=500)
    reason: str | None = Field(default=None, max_length=500)


class CategoryChangeResult(ApiModel):
    change_type: Literal["merge", "split"]
    from_category_id: str
    to_category_ids: list[str]
    taxonomy_version: int
    affected_count: int


class CategoryChangeItem(ApiModel):
    change_id: str
    change_type: Literal["merge", "split"]
    from_category_id: str
    from_name: str
    to_category_ids: list[str]
    to_names: list[str]
    from_version: int
    to_version: int
    reason: str | None
    changed_by: str
    affected_count: int
    created_at: datetime

    @classmethod
    def from_document(cls, doc: TaxonomyChangeDocument) -> "CategoryChangeItem":
        return cls(
            change_id=str(doc.id),
            change_type=doc.change_type,
            from_category_id=doc.from_category_id,
            from_name=doc.from_name,
            to_category_ids=doc.to_category_ids,
            to_names=doc.to_names,
            from_version=doc.from_version,
            to_version=doc.to_version,
            reason=doc.reason,
            changed_by=doc.changed_by,
            affected_count=doc.affected_count,
            created_at=doc.created_at,
        )


class CategoryChangeList(ApiModel):
    items: list[CategoryChangeItem]


class CategoryPeriodCount(ApiModel):
    category_id: str
    current_count: int
    previous_count: int


class ComplaintStats(ApiModel):
    current_period: str | None
    previous_period: str | None
    categories: list[CategoryPeriodCount]


class ComplaintInsight(ApiModel):
    type: Literal["growth", "urgent", "repeat"]
    title: str
    description: str
    count: int


class ComplaintInsights(ApiModel):
    items: list[ComplaintInsight]
