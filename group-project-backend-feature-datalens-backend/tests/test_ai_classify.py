"""AI 민원 분류(app/services/ai_classify.py)."""

import json
import re

import pytest
from pydantic import BaseModel

from app.core.errors import AppError
from app.schemas.complaint_analysis import ComplaintRecord
from app.services import ai_classify
from app.services.ai_classify import ExistingCategory, classify_by_ai
from app.services.llm import ChatReply, LlmClient

pytestmark = pytest.mark.anyio

# 주제 낱말 → (기존 카테고리 ID 또는 None, 새 카테고리 이름, 그룹)
TOPICS = {
    "가로등": ("CAT-0001", None, None),
    "침수": (None, "침수·배수 불량", "물·하천"),
    "범람": (None, "침수·배수 불량", "물·하천"),
    "버스": (None, "버스 노선·배차", "대중교통"),
}


class TopicBackend:
    """민원 글의 주제 낱말로 분류 응답을 만드는 가짜 AI. 받은 요청을 기록한다."""

    deployment = "fake-classifier"

    def __init__(self, fail_batches: set[int] | None = None) -> None:
        """가짜 AI를 만든다.

        파라미터:
            fail_batches: 실패로 답할 묶음 번호(0부터)
        """
        self.fail_batches = fail_batches or set()
        self.sent: list[str] = []

    async def complete(self, system: str, user: str, response_model: type[BaseModel]) -> ChatReply:
        """민원 줄마다 주제 낱말을 찾아 분류한다. 모르는 글은 둘 다 null.

        파라미터:
            system: 시스템 지시문
            user: 사용자 메시지(민원 목록)
            response_model: 응답 모델(사용하지 않음)
        """
        batch = len(self.sent)
        self.sent.append(user)
        if batch in self.fail_batches:
            raise AppError("LLM_ERROR", "실패", 502)
        assignments, new = [], {}
        for match in re.finditer(r"^\[(\d+)\] (.*)$", user, re.MULTILINE):
            index, text = int(match.group(1)), match.group(2)
            topic = next((TOPICS[t] for t in TOPICS if t in text), (None, None, None))
            existing, name, group = topic
            assignments.append({"index": index, "category_id": existing, "new_category": name})
            if name:
                new[name] = {"name": name, "group": group, "definition": f"{name} 민원"}
        # 존재하지 않는 카테고리 ID와 범위를 벗어난 번호도 섞어 보낸다(무시돼야 함)
        assignments.append({"index": 999, "category_id": "CAT-9999", "new_category": None})
        content = json.dumps({"assignments": assignments, "new_categories": list(new.values())})
        return ChatReply(content=content, prompt_tokens=10, completion_tokens=5)


def records(texts: list[str]) -> list[ComplaintRecord]:
    """번호를 붙인 민원 레코드.

    파라미터:
        texts: 민원 글(마스킹본)
    """
    return [ComplaintRecord(record_id=f"r{i}", text=text) for i, text in enumerate(texts)]


EXISTING = [ExistingCategory("CAT-0001", "가로등 고장", "안전·조명", "가로등이 꺼짐")]


async def test_assigns_existing_and_names_new_categories() -> None:
    backend = TopicBackend()
    texts = [
        "골목 가로등이 꺼졌어요",
        "도로가 비만 오면 침수",
        "버스 배차 간격이 깁니다",
        "이건 참기가 힘드네요",
    ]

    result = await classify_by_ai(records(texts), EXISTING, LlmClient(backend, None))

    assert result.existing == {"r0": "CAT-0001"}
    assert [(c.name, c.group, c.member_ids) for c in result.new] == [
        ("침수·배수 불량", "물·하천", ["r1"]),
        ("버스 노선·배차", "대중교통", ["r2"]),
    ]
    # 주제를 알 수 없는 글은 군집화로 넘긴다
    assert result.unclassified == ["r3"]
    assert "CAT-0001 | 가로등 고장" in backend.sent[0]


async def test_same_topic_across_batches_joins_one_category(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(ai_classify, "BATCH_SIZE", 2)
    backend = TopicBackend()
    texts = ["도로 침수", "하천 범람", "지하차도 침수", "또 범람"]

    result = await classify_by_ai(records(texts), [], LlmClient(backend, None))

    assert [(c.name, c.member_ids) for c in result.new] == [
        ("침수·배수 불량", ["r0", "r1", "r2", "r3"])
    ]
    # 두 번째 묶음에는 앞에서 만든 새 카테고리 이름을 알려 같은 이름을 쓰게 한다
    assert "- 침수·배수 불량 | 물·하천" in backend.sent[1]


async def test_failed_batch_falls_back_to_unclassified(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ai_classify, "BATCH_SIZE", 2)
    backend = TopicBackend(fail_batches={0})

    result = await classify_by_ai(
        records(["가로등 꺼짐", "침수", "버스", "가로등"]), EXISTING, LlmClient(backend, None)
    )

    assert result.unclassified == ["r0", "r1"]
    assert result.existing == {"r3": "CAT-0001"}
    assert [c.member_ids for c in result.new] == [["r2"]]
