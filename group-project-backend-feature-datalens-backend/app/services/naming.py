"""신규 카테고리 후보의 이름·정의·상위 그룹 초안(PRD 5.1 명명, 6장 B, 6.1: deep 배포).

LLM에는 후보의 핵심어와 대표 민원 마스킹본만 보낸다. LLM을 쓸 수 없거나 실패하면 핵심어로
이름을 만든다(담당자가 승인 때 고친다).
"""

from dataclasses import dataclass

from pydantic import BaseModel, ConfigDict, Field

from app.core.errors import AppError
from app.services.llm import LlmClient

# 프롬프트(SYSTEM)를 고치면 올린다. LLM 응답 캐시가 이 버전 + 입력 해시로 묶이므로(PRD 6.1),
# 버전을 그대로 두면 바뀐 프롬프트에도 이전 응답이 재사용된다
PROMPT_VERSION = "category-name@1"
# PRD 5.4 초기 상위 그룹(참고용). 어느 것에도 맞지 않으면 새 그룹을 제안한다
GROUPS = (
    "교통·주정차",
    "대중교통",
    "도로·보행",
    "안전·조명",
    "환경·청소",
    "물·하천",
    "공원·공공시설",
    "소음·건축·주거",
    "행정·법령 질의",
)
SYSTEM = f"""너는 지방자치단체 민원 분류 체계를 만드는 도우미다.
비슷한 민원을 묶은 군집 하나의 핵심어와 대표 민원을 보고 카테고리 초안을 만든다.
- name: 짧은 명사구(예: 가로등 고장, 불법 현수막·광고물). 15자 이내
- definition: 한 줄 정의와 경계 메모(예: 가로등·보안등이 꺼지거나 깜빡임. 설치 요청은 제외)
- group: 상위 그룹. 다음 중 하나를 고르고, 맞는 것이 없으면 새 그룹을 짓는다:
  {", ".join(GROUPS)}
[전화], [인명] 같은 표시는 개인정보를 가린 것이다."""


class CategoryDraft(BaseModel):
    """LLM 응답: 카테고리 이름·정의·상위 그룹 초안."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(description="카테고리 이름(15자 이내)")
    definition: str = Field(description="한 줄 정의와 경계 메모")
    group: str = Field(description="상위 그룹")


@dataclass(frozen=True)
class NameSuggestion:
    """후보 하나의 이름 제안(LLM이 없으면 정의·그룹은 None)."""

    name: str
    definition: str | None
    group: str | None


def keyword_name(keywords: list[str]) -> str:
    """핵심어 앞 3개로 만든 임시 이름.

    파라미터:
        keywords: 후보 핵심어
    """
    # 핵심어는 c-TF-IDF 점수 순이라 앞쪽일수록 그 군집에만 두드러진 낱말이다
    return "·".join(keywords[:3]) if keywords else "이름 없음"


async def suggest_name(
    keywords: list[str], exemplars: list[str], client: LlmClient | None
) -> NameSuggestion:
    """후보 하나의 이름 초안을 만든다. 실패하면 핵심어 이름으로 대신한다.

    파라미터:
        keywords: 핵심어
        exemplars: 대표 민원 본문(마스킹본)
        client: deep 배포 LLM 호출기. None이면 핵심어 이름만 만든다
    """
    # LLM이 꺼져 있거나 실패해도 후보 목록은 나와야 하므로 핵심어 이름을 먼저 만들어 둔다
    fallback = NameSuggestion(keyword_name(keywords), None, None)
    if client is None:
        return fallback
    # 대표 민원은 200자까지만 보낸다. 주제를 알기엔 충분하고, 외부 전송량·토큰 비용을 줄인다
    lines = "\n".join(f"- {text[:200]}" for text in exemplars)
    try:
        draft = await client.generate(
            prompt_version=PROMPT_VERSION,
            system=SYSTEM,
            masked_input=f"핵심어: {', '.join(keywords)}\n대표 민원:\n{lines}",
            response_model=CategoryDraft,
        )
    except AppError:
        # 호출·형식 오류는 분석 전체를 멈출 일이 아니다. 담당자가 승인 때 이름을 고친다
        return fallback
    # 이름은 15자 이내로 요청했지만 지키지 않을 수 있어 저장 전에 100자로 자른다
    return NameSuggestion(draft.name.strip()[:100], draft.definition.strip(), draft.group.strip())


# 상위 그룹을 고르는 낱말(LLM 없이 자동 승인할 때). 그룹 이름은 GROUPS와 같다
GROUP_TERMS: dict[str, tuple[str, ...]] = {
    "교통·주정차": ("주차", "주정차", "견인", "단속", "신호", "교통", "차량", "과속"),
    "대중교통": ("버스", "정류장", "지하철", "택시", "노선", "배차", "환승"),
    "도로·보행": (
        "도로",
        "보도",
        "인도",
        "횡단보도",
        "포트홀",
        "보행",
        "차선",
        "보도블록",
        "방지턱",
    ),
    "안전·조명": ("가로등", "보안등", "조명", "CCTV", "위험", "안전", "감지기", "소방"),
    "환경·청소": ("쓰레기", "청소", "악취", "투기", "재활용", "매연", "환경", "분리수거"),
    "물·하천": ("하천", "상수도", "하수", "배수", "누수", "침수", "수도"),
    "공원·공공시설": ("공원", "놀이터", "화장실", "체육", "시설", "도서관"),
    "소음·건축·주거": ("소음", "공사", "건축", "층간", "주택", "아파트", "진동", "주거"),
    "행정·법령 질의": ("문의", "질의", "법령", "정보공개", "행정", "서류", "제도", "규정"),
}
# 어느 그룹 낱말도 나오지 않을 때의 상위 그룹
OTHER_GROUP = "기타"


def guess_group(keywords: list[str], exemplars: list[str]) -> str:
    """핵심어·대표 민원에 가장 많이 나온 그룹 낱말로 상위 그룹을 고른다. 없으면 기타.

    LLM 없이 후보를 자동 승인할 때 상위 그룹(집계용, PRD 5.4)을 채우는 데 쓴다.

    파라미터:
        keywords: 후보 핵심어
        exemplars: 대표 민원 본문(마스킹본)
    """
    # 핵심어는 군집을 대표하므로 대표 민원 본문보다 무겁게 센다
    text = " ".join(exemplars)
    best, best_score = OTHER_GROUP, 0
    for group in GROUPS:
        terms = GROUP_TERMS.get(group, ())
        score = sum(3 for keyword in keywords if any(term in keyword for term in terms))
        score += sum(text.count(term) for term in terms)
        if score > best_score:
            best, best_score = group, score
    return best
