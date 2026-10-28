# DataLens 프런트엔드 + 백엔드 Vercel 동시 배포

상위 `group project-merge` 폴더를 Vercel 프로젝트 루트로 배포한다. Vercel Services(Beta)가
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
VITE_DATA_MODE=api
VITE_UPLOAD_MODE=blob
```

Blob 연결 시 `BLOB_READ_WRITE_TOKEN`이 자동 등록된다. Azure OpenAI 기능을 쓸 때만
`AZURE_OPENAI_*` 값을 추가한다. Python 함수 번들이 기본 한도를 넘을 때는
`VERCEL_SUPPORT_LARGE_FUNCTIONS=1`도 추가한다.

## 배포

PowerShell에서 두 서비스의 상위 폴더로 이동해 실행한다.

```powershell
cd "C:\Users\USER\Desktop\group project-merge"
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

## Git 자동 배포 주의

현재 프런트엔드 폴더 안에만 `.git`이 있으므로 CLI 동시 배포는 가능하지만, Git 연동으로
두 서비스를 자동 배포하려면 상위 `group project-merge`를 하나의 Git 저장소로 만들고 두
하위 폴더를 함께 커밋해야 한다. 기존 프런트 Git 이력을 제거하거나 이동하는 작업은 별도
백업 후 진행한다.
