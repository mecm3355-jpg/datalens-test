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


class AssignmentCounts(ApiModel):
    """배정 상태별 활성 민원 수(PRD 8.1 배정 상태)."""

    auto: int
    ambiguous: int
    unassigned: int
    confirmed: int


class LabelCount(ApiModel):
    """값 하나와 그 건수. 값이 없는 민원은 label이 None이다."""

    label: str | None
    count: int


class PendingCandidate(ApiModel):
    """승인 대기 후보 — 정식 카테고리 전의 임시 분류(PRD 8.2 신규 후보)."""

    candidate_id: str
    suggested_name: str
    suggested_group: str | None
    size: int
    keywords: list[str]


class ComplaintStats(ApiModel):
    """대시보드 현황. 기간 비교(categories)는 최근 두 달, 나머지는 period(없으면 전체) 기준."""

    current_period: str | None
    previous_period: str | None
    categories: list[CategoryPeriodCount]
    # 집계 기준 처리 월. None이면 활성 민원 전체
    period: str | None
    total: int
    assignment: AssignmentCounts
    # 상위 그룹·행정동·긴급도는 건수 많은 순, 월별은 오래된 달부터(값 없는 민원은 label None)
    groups: list[LabelCount]
    # 카테고리 ID별 건수(값 없음 = 미분류는 label None). 대시보드의 카테고리별 건수
    categories_total: list[LabelCount]
    regions: list[LabelCount]
    urgency: list[LabelCount]
    monthly: list[LabelCount]
    # 첫 달처럼 승인된 카테고리가 없어도 현황이 보이도록 승인 대기 후보를 큰 순서로 담는다
    pending_candidates: list[PendingCandidate]
    pending_candidate_count: int
    pending_candidate_complaints: int
    pending_reviews: int


class ComplaintInsight(ApiModel):
    type: Literal["growth", "urgent", "repeat", "candidates"]
    title: str
    description: str
    count: int


class ComplaintInsights(ApiModel):
    items: list[ComplaintInsight]
