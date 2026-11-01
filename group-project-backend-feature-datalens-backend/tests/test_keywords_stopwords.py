from app.services.keywords import noun_tokens


def test_form_words_are_not_keywords() -> None:
    tokens = noun_tokens("횡단보도 설치 여부 질의")

    assert "횡단보도" in tokens
    assert not {"설치", "여부", "질의"} & set(tokens)
