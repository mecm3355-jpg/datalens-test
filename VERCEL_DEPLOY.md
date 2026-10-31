# DataLens 프런트엔드 + 백엔드 Vercel 동시 배포

상위 `datalens-test` 폴더를 Vercel 프로젝트 루트로 배포한다. Vercel Services(Beta)가
Vite 프런트엔드와 FastAPI 백엔드를 각각 빌드한 뒤 하나의 URL·하나의 배포로 묶는다.

## 최초 1회 설정

1. Vercel 프로젝트의 Storage에서 **Private Blob** 저장소를 만들고 이 프로젝트에 연결한다.
2. MongoDB Atlas에 운영용 데이터베이스와 사용자를 만들고 Vercel에서 접속할 수 있게 한다.
3. Vercel Project Settings → Environment Variables에 아래 값을 등록한다.

```text
MONGODB_URI=mongodb+srv://...
MONGODB_DB_NAME=datalens
STORAGE_PROVIDER=vercel_blob
JOB_DISPATCH_MODE=vercel_queue
CORS_ORIGINS=https://배포될도메인.vercel.app
AUTH_REQUIRED=true
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=lax
AUTH_REGISTRATION_ENABLED=true
AUTH_SESSION_SECONDS=28800
AUTH_MAX_FAILED_ATTEMPTS=5
AUTH_LOCKOUT_SECONDS=900
AUTH_PASSWORD_RESET_SECONDS=1800
AUTH_EXPOSE_RESET_TOKEN=false
RESEND_API_KEY=re_...
PASSWORD_RESET_FROM=DataLens <no-reply@your-domain.example>
FRONTEND_URL=https://배포될도메인.vercel.app
VITE_DATA_MODE=api
VITE_UPLOAD_MODE=blob
```

기존 공용 `AUTH_PASSWORD`, `AUTH_SECRET`은 제거한다. Blob 업로드 서비스도 백엔드의 MongoDB 세션 API로 인증하므로 별도 공유 비밀키가 필요하지 않다.
배포 후 첫 회원가입 계정이 관리자가 되고 기존 소유자 없는 데이터가 그 계정으로 이전되므로,
반드시 프로젝트 관리자가 첫 가입을 완료한 다음 일반 사용자에게 주소를 공개한다.

- Secret: `MONGODB_URI`, Blob 연결이 만든 토큰, `AZURE_OPENAI_*` 키
- Config: `MONGODB_DB_NAME`, `AUTH_*`, `CORS_ORIGINS`, `STORAGE_PROVIDER`,
  `JOB_DISPATCH_MODE`, `VITE_*`
- Preview에는 운영 MongoDB Secret을 재사용하지 말고 별도 DB·계정을 사용한다.

비밀번호 재설정 메일은 Resend HTTP API로 발송한다. `RESEND_API_KEY`는 Secret으로,
`PASSWORD_RESET_FROM`과 `FRONTEND_URL`은 Config로 등록한다. 발신 도메인은 Resend에서 먼저
검증해야 한다. `AUTH_EXPOSE_RESET_TOKEN=true`는 토큰을 응답에 노출하므로 로컬 확인에만 사용한다.

Queue 소비자는 백엔드 `pyproject.toml`의 Python Subscriber 하나만 사용한다. 같은 토픽을
TypeScript Worker와 동시에 구독하면 각 소비자 그룹이 메시지를 따로 받아 중복 처리되므로,
루트 `vercel.json`에는 별도 Queue Worker 서비스를 등록하지 않는다.

Blob 연결 시 `BLOB_READ_WRITE_TOKEN`이 자동 등록된다. Azure OpenAI 기능을 쓸 때만
`AZURE_OPENAI_*` 값을 추가한다. Python 함수 번들이 기본 한도를 넘을 때는
`VERCEL_SUPPORT_LARGE_FUNCTIONS=1`도 추가한다.

## 배포

PowerShell에서 두 서비스의 상위 폴더로 이동해 실행한다.

```powershell
cd "C:\Users\USER\Desktop\datalens-test"
vercel link
vercel --prod
```

배포 후 같은 도메인에서 다음 주소를 확인한다.

- `/` — Vite 프런트엔드
- `/health` — FastAPI 상태 확인
- `/api/v1/files` — FastAPI 파일 API
- `/api/blob-upload` — 100MB 파일을 Blob으로 직접 올리는 토큰 API

## 로컬 개발

기존 방식은 유지된다. 프런트엔드는 `VITE_UPLOAD_MODE=server`, 백엔드는
`STORAGE_PROVIDER=local`, `JOB_DISPATCH_MODE=local`을 사용하고 별도 worker를 실행한다.
Vercel 전체 구성을 로컬에서 확인할 때는 상위 폴더에서 `vercel dev`를 실행한다.

프런트엔드와 백엔드를 서로 다른 사이트로 독립 배포할 때만 `AUTH_COOKIE_SAMESITE=none`과
`AUTH_COOKIE_SECURE=true`를 함께 사용하고, `CORS_ORIGINS`에는 정확한 프런트엔드 출처를 넣는다.

## Git 자동 배포 주의

현재 상위 `datalens-test`가 Git 저장소 루트이며 프런트엔드와 백엔드가 함께 추적된다.
Vercel 프로젝트를 이 저장소의 `main` 브랜치에 연결하면 두 하위 서비스를 한 배포에서
자동으로 빌드할 수 있다.
