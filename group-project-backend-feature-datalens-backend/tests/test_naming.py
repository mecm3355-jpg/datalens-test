"""신규 후보 상위 그룹 고르기(LLM 없이 자동 승인할 때)."""

from app.services.naming import OTHER_GROUP, guess_group


def test_guess_group_by_keywords_and_exemplars() -> None:
    assert guess_group(["가로등", "고장"], ["골목 가로등이 꺼져 어둡습니다"]) == "안전·조명"
    assert guess_group(["불법", "주차"], ["상가 앞 불법 주차가 많습니다"]) == "교통·주정차"
    # 핵심어에 없어도 대표 민원 본문에 많이 나오면 그 그룹을 고른다
    assert (
        guess_group(["공터", "방치"], ["쓰레기가 쌓여 악취가 납니다", "쓰레기 무단 투기"])
        == "환경·청소"
    )


def test_guess_group_falls_back_to_other() -> None:
    assert guess_group(["감사", "인사"], ["친절하게 응대해 주셔서 감사합니다"]) == OTHER_GROUP
