"""Vercel Python 서비스가 가져갈 ASGI 진입점."""

import os
import tempfile

# 군집화에 쓰는 UMAP(numba)은 컴파일 캐시를 쓰는데, Vercel 함수는 임시 폴더만 쓸 수 있다.
# numba를 불러오기 전에 정해야 하므로 앱을 불러오기 전에 둔다
os.environ.setdefault("NUMBA_CACHE_DIR", os.path.join(tempfile.gettempdir(), "numba"))

from app.main import create_app  # noqa: E402

app = create_app()
