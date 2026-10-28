# DataLens

민원 데이터 업로드·품질 진단·정제·분석을 제공하는 프런트엔드와 백엔드 모노레포입니다.

| 경로 | 역할 |
| --- | --- |
| `group-project-frontend-feature-datalens-frontend/` | React + Vite 웹 앱 |
| `group-project-backend-feature-datalens-backend/` | FastAPI API 및 Vercel Queue 작업 처리기 |
| `vercel.json` | 두 서비스를 하나의 Vercel 배포로 묶는 설정 |
| `VERCEL_DEPLOY.md` | 배포 환경변수와 확인 절차 |

## 검증

```powershell
cd group-project-frontend-feature-datalens-frontend
npm install
npm run lint
npm run test
npm run build
```

```powershell
cd group-project-backend-feature-datalens-backend
uv sync --extra dev
uv run --extra dev ruff check .
uv run --extra dev mypy app tests
uv run --extra dev pytest
```

배포는 [VERCEL_DEPLOY.md](VERCEL_DEPLOY.md)를 참고하세요.
