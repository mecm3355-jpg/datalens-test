"""AI로 민원을 카테고리에 나누고, 맞는 카테고리가 없으면 새 카테고리를 짓는다.

사용자 결정(2026-11-02)으로 추가했다.

단어 벡터만으로는 짧은 제목·주제가 제각각인 민원을 묶지 못해 대부분 미분류로 남았다(국민신문고
49건 중 36건). AI가 연결돼 있으면(Azure 직접 또는 AI 중계) 이번 파일의 미배정 민원을 AI가 읽고
기존 카테고리에 넣거나 새 카테고리 이름을 짓는다. AI가 판단하지 못한 민원은 기존 군집화로 넘긴다.

LLM에는 마스킹본만 보낸다(LlmClient가 전송 직전에 개인정보를 다시 검사한다).
"""

import logging
from dataclasses import dataclass, field

from pydantic import BaseModel, ConfigDict, Field

from app.core.errors import AppError
from app.schemas.complaint_analysis import ComplaintRecord
from app.services.llm import LlmClient
from app.services.naming import GROUPS, guess_group

logger = logging.getLogger(__name__)

# 프롬프트(SYSTEM·입력 형식)를 고치면 올린다. LLM 응답 캐시가 이 버전 + 입력 해시로 묶인다
PROMPT_VERSION = "complaint-classify@1"
# 한 번에 보내는 민원 수. 응답(민원마다 한 줄)이 출력 한도 안에 들어오고, 한 묶음이 실패해도
# 나머지는 분류되게 작게 나눈다
BATCH_SIZE = 40
# 민원 하나당 보내는 글자 수. 주제를 알기엔 충분하고 외부 전송량·비용을 줄인다
TEXT_LIMIT = 160

SYSTEM = f"""너는 지방자치단체 민원을 카테고리로 나누는 도우미다.
민원 목록의 각 민원을 아래 규칙으로 하나씩 분류한다.
1. 기존 카테고리 중 주제가 맞는 것이 있으면 그 categoryId를 그대로 적는다.
2. 맞는 것이 없으면 new_category에 새 카테고리 이름을 적는다. 이름은 여러 민원에 두루 쓸 수 있게
   일반적으로 짓는다(예: 보도 불편·보행 방해, 침수·배수 불량, 정보공개 청구, 버스 노선·배차).
   15자 이내 명사구. 지명·사람·기관 이름은 넣지 않는다. 같은 주제는 반드시 같은 이름을 다시 쓴다
   ("이미 만든 새 카테고리"에 있는 이름을 우선 쓴다).
3. 새 카테고리는 new_categories에 이름·상위 그룹·한 줄 정의를 적는다.
   상위 그룹은 다음 중 하나를 고르고, 맞는 것이 없으면 새 그룹을 짓는다: {", ".join(GROUPS)}
4. 민원 내용만으로 주제를 알 수 없으면(감탄·하소연만 있는 글 등) 둘 다 null로 둔다.
[전화], [인명] 같은 표시는 개인정보를 가린 것이다."""


class AiAssignment(BaseModel):
    """LLM 응답: 민원 하나의 분류."""

    model_config = ConfigDict(extra="forbid")

    index: int = Field(description="민원 번호([n])")
    category_id: str | None = Field(description="기존 카테고리 ID. 없으면 null")
    new_category: str | None = Field(description="새 카테고리 이름. 기존에 넣었으면 null")


class AiNewCategoryDraft(BaseModel):
    """LLM 응답: 새로 지은 카테고리."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(description="카테고리 이름(15자 이내)")
    group: str = Field(description="상위 그룹")
    definition: str = Field(description="한 줄 정의")


class ClassifyReply(BaseModel):
    """LLM 응답 전체."""

    model_config = ConfigDict(extra="forbid")

    assignments: list[AiAssignment]
    new_categories: list[AiNewCategoryDraft]


@dataclass(frozen=True)
class ExistingCategory:
    """AI에 알려 줄 기존 카테고리."""

    category_id: str
    name: str
    group: str
    definition: str


@dataclass
class AiNewCategory:
    """AI가 새로 지은 카테고리와 그 민원들. 후보로 만들어 자동 승인한다."""

    name: str
    group: str
    definition: str
    member_ids: list[str] = field(default_factory=list)


@dataclass
class AiClassification:
    """AI 분류 결과. 어디에도 넣지 못한 민원은 unclassified로 남아 군집화로 넘어간다."""

    existing: dict[str, str] = field(default_factory=dict)
    new: list[AiNewCategory] = field(default_factory=list)
    unclassified: list[str] = field(default_factory=list)


def _clean_name(name: str) -> str:
    """새 카테고리 이름의 앞뒤 공백과 따옴표를 없애고 100자로 자른다.

    파라미터:
        name: LLM이 지은 이름
    """
    return name.strip().strip("\"'「」").strip()[:100]


def _batch_input(
    batch: list[ComplaintRecord], existing: list[ExistingCategory], made: list[AiNewCategory]
) -> str:
    """한 묶음의 사용자 메시지(마스킹본).

    파라미터:
        batch: 이번 묶음 민원
        existing: 기존 카테고리
        made: 앞 묶음에서 이미 만든 새 카테고리(같은 주제에 같은 이름을 쓰게 알려 준다)
    """
    lines = ["기존 카테고리:"]
    lines += [f"- {c.category_id} | {c.name} | {c.group} | {c.definition}" for c in existing] or [
        "(없음)"
    ]
    lines.append("이미 만든 새 카테고리:")
    lines += [f"- {c.name} | {c.group}" for c in made] or ["(없음)"]
    lines.append("민원:")
    lines += [f"[{i}] {r.text[:TEXT_LIMIT]}" for i, r in enumerate(batch)]
    return "\n".join(lines)


async def classify_by_ai(
    records: list[ComplaintRecord], existing: list[ExistingCategory], client: LlmClient
) -> AiClassification:
    """민원을 AI로 기존 카테고리에 넣거나 새 카테고리로 묶는다.

    묶음마다 따로 보내고, 앞 묶음에서 만든 새 카테고리 이름을 다음 묶음에 알려 같은 주제가 한
    카테고리로 모이게 한다. 한 묶음이 실패하면(연결·형식 오류, 개인정보 검출) 그 묶음 민원은
    unclassified로 두고 다음 묶음을 계속한다.

    파라미터:
        records: 분류할 민원(마스킹본)
        existing: 현재 체계의 활성 카테고리
        client: LLM 호출기
    """
    result = AiClassification()
    known_ids = {c.category_id for c in existing}
    made: dict[str, AiNewCategory] = {}
    for start in range(0, len(records), BATCH_SIZE):
        batch = records[start : start + BATCH_SIZE]
        try:
            reply = await client.generate(
                prompt_version=PROMPT_VERSION,
                system=SYSTEM,
                masked_input=_batch_input(batch, existing, list(made.values())),
                response_model=ClassifyReply,
            )
        except AppError as exc:
            logger.warning("AI 분류 묶음 실패: code=%s size=%d", exc.code, len(batch))
            result.unclassified += [r.record_id for r in batch]
            continue
        drafts = {_clean_name(d.name): d for d in reply.new_categories if _clean_name(d.name)}
        placed: set[int] = set()
        for item in reply.assignments:
            # 범위를 벗어난 번호나 같은 번호를 두 번 준 경우는 첫 답만 쓴다
            if not 0 <= item.index < len(batch) or item.index in placed:
                continue
            record = batch[item.index]
            if item.category_id in known_ids:
                result.existing[record.record_id] = str(item.category_id)
                placed.add(item.index)
                continue
            name = _clean_name(item.new_category or "")
            if not name:
                continue
            if name not in made:
                draft = drafts.get(name)
                made[name] = AiNewCategory(
                    name=name,
                    # 정의를 빠뜨린 이름은 그룹을 낱말로 고른다
                    group=(draft.group.strip()[:50] if draft else "")
                    or guess_group([name], [record.text]),
                    definition=draft.definition.strip()[:500] if draft else "",
                )
            made[name].member_ids.append(record.record_id)
            placed.add(item.index)
        result.unclassified += [r.record_id for i, r in enumerate(batch) if i not in placed]
    result.new = list(made.values())
    return result
