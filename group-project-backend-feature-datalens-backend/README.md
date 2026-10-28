# DataLens (가칭) — 민원 자동분류·분석

| 경로 | 내용 | 비고 |
| --- | --- | --- |
| CLAUDE.md | AI 코딩 도구 작업 지침 + 기준 문서 위치 | 원본: 민원정보_프로젝트/CLAUDE.md에 "기준 문서" 섹션 추가 |
| docs/prd/PRD.md | PRD v2 Markdown 변환본 | 그림 2개는 Word 파일 참고 |
| docs/prd/민원_자동분류_PRD_v2.docx | PRD v2 Word 사본 | 원본은 claude.ai 문서 |
| docs/db-schema/*.xlsx | DB 스키마 설계 원본 3개 (기준) | |
| docs/db-schema/schema.md | 위 3개의 Markdown 변환본 | 원본과 동일 내용 |
| docs/api-spec/api_명세서.hwpx | API 명세서 원본 (기준) | |
| docs/api-spec/api-spec.md | 위 명세서의 Markdown 변환본 | 원본과 동일 내용 |
| docs/DESIGN.md | 화면 디자인 참고 | |

샘플 데이터는 `G:\내 드라이브\다운로드\민원정보_프로젝트`에 있다. 프로젝트 안 `샘플데이타/`에 사본을 두면
`scripts/m2_simulation.py`가 읽는다(실제 민원이 들어 있어 git에서 제외).

## 프런트엔드 통합 설정

백엔드 환경에 다음 값을 둔다. 실제 값은 `.env` 또는 배포 환경의 비밀/설정 관리 기능에 저장하고 Git에 커밋하지 않는다.

```text
MONGODB_URI=mongodb+srv://...
MONGODB_DB_NAME=datalens
CORS_ORIGINS=http://localhost:5173,https://datalenstest.vercel.app
MAX_UPLOAD_BYTES=104857600
MAX_PDF_PAGES=500
AUTH_REQUIRED=false
AUTH_COOKIE_SECURE=false
AUTH_REGISTRATION_ENABLED=true
AUTH_SESSION_SECONDS=28800
AUTH_MAX_FAILED_ATTEMPTS=5
AUTH_LOCKOUT_SECONDS=900
AUTH_PASSWORD_RESET_SECONDS=1800
AUTH_EXPOSE_RESET_TOKEN=false
```

운영 배포에서는 `AUTH_REQUIRED=true`, `AUTH_COOKIE_SECURE=true`로 설정한다. 첫 가입자는
관리자가 되며 기존 `ownerId` 없는 파일·작업·결과는 그 계정 소유로 이전된다. 이후 가입자는
자신의 파일과 처리 결과만 조회·수정·삭제할 수 있다. 비밀번호는 MongoDB에 Argon2id 해시로만
저장되고 세션 쿠키 원문도 DB에는 저장하지 않는다.

`AUTH_EXPOSE_RESET_TOKEN=true`는 이메일 발송 연동 전 로컬 기능 확인용이다. 재설정 토큰이
API 응답에 포함되므로 운영 환경에서는 사용하지 않는다.

Azure OpenAI 키와 배포 이름은 AI 리포트를 사용할 때만 백엔드 환경에 추가한다. 프런트엔드 `VITE_*` 변수에는 비밀값을 넣지 않는다.

독립 배포 구성에서는 프런트엔드 `VITE_API_BASE_URL`이 이 서버를 가리켜야 하며, 해당 프런트 주소를 `CORS_ORIGINS`에 추가해야 한다.

두 폴더를 Vercel 한 프로젝트로 배포할 때는 상위 폴더의 `VERCEL_DEPLOY.md`를 따른다.
이 구성은 Private Blob 직접 업로드와 Vercel Queue를 사용해 Function 요청 크기 제한과
상태 없는 임시 디스크 문제를 피한다.

## 검증

```bash
ruff check .
ruff format --check .
mypy app tests
pytest
```

`pymongo-inmemory`가 현재 OS용 MongoDB 실행 파일을 제공하지 못하면 DB 통합 테스트는 자동으로 건너뛴다. 전체 통합 검증에는 운영 DB가 아닌 테스트 전용 MongoDB 주소를 `MONGODB_TEST_URI`로 지정한다.
