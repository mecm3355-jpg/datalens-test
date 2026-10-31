"""AI 모델 없는 단어 벡터(term-hash-v1) 테스트."""

import numpy as np

from app.core.config import Settings
from app.services.embedding import TERM_HASH_MODEL, TermHashEmbedder, get_embedder


def test_same_text_gets_same_normalized_vector() -> None:
    """같은 본문은 늘 같은 벡터이고 길이는 1이다."""
    embedder = TermHashEmbedder()
    first = embedder.embed(["가로등 고장 신고"])
    second = TermHashEmbedder().embed(["가로등 고장 신고"])
    assert np.array_equal(first, second)
    assert abs(np.linalg.norm(first[0]) - 1) < 1e-5


def test_fitted_lowers_common_words() -> None:
    """어디에나 나오는 낱말이 겹치는 것보다 주제 낱말이 겹치는 쪽이 더 비슷하다."""
    texts = [
        "가로등 고장 아파트 주민 불편",
        "가로등 파손 아파트 주민 불편",
        "쓰레기 투기 아파트 주민 불편",
        "주차 위반 아파트 주민 불편",
        "소음 피해 아파트 주민 불편",
    ]
    vectors = TermHashEmbedder().fitted(texts).embed(texts)
    same_topic = float(vectors[0] @ vectors[1])
    other_topic = float(vectors[0] @ vectors[2])
    assert same_topic > other_topic
    # 가중치가 없으면 공통 낱말 3개가 대부분을 차지해 다른 주제도 비슷해 보인다
    plain = TermHashEmbedder().embed(texts)
    assert other_topic < float(plain[0] @ plain[2])


def test_empty_inputs() -> None:
    """본문이 없거나 명사가 없어도 오류 없이 처리한다."""
    embedder = TermHashEmbedder()
    assert embedder.embed([]).shape == (0, 0)
    assert not embedder.embed(["..."]).any()


def test_default_setting_needs_no_model_package() -> None:
    """기본 설정은 sentence-transformers 없이 단어 벡터를 돌려준다."""
    settings = Settings(mongodb_uri="mongodb://localhost:27017")
    assert settings.embedding_model == TERM_HASH_MODEL
    assert isinstance(get_embedder(settings), TermHashEmbedder)
