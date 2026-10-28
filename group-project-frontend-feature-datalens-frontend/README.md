# DataLens Frontend

파일 업로드, 데이터 품질 분석, 정제 규칙 승인 및 결과 다운로드 흐름을 제공하는 React 프론트엔드입니다. 브라우저 데모와 FastAPI 연결 모드를 함께 지원합니다.

## 기술 구성

- React 19 + React Compiler
- React Router 8
- Vite 8 + TypeScript 6
- Axios, Recharts
- Oxlint
- Vitest + Testing Library

## 실행

```bash
npm install
npm run dev
```

개발 서버는 `http://localhost:5173`을 사용합니다.

## 백엔드 연결

로컬 `.env.local` 또는 Vercel 프로젝트 환경 변수에 다음 공개 설정을 추가합니다. `VITE_*` 값은 브라우저에 노출되므로 비밀 키를 넣으면 안 됩니다.

```text
VITE_DATA_MODE=api
VITE_API_BASE_URL=https://your-backend.example.com
VITE_MAX_FILE_SIZE_MB=100
```

- `VITE_DATA_MODE=demo`: 기존 브라우저/localStorage 데모와 시드 데이터를 사용합니다.
- `VITE_DATA_MODE=api`: FastAPI의 파일 목록·업로드·작업·진단·정제·다운로드 API를 사용합니다.
- 프리뷰·프로덕션마다 다른 백엔드를 사용하면 Vercel에서 환경별 Config 값으로 나눠 설정합니다.
- MongoDB URI와 Azure OpenAI 키는 백엔드에만 설정합니다.

## 검증

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## 프로젝트 지침

- 제품 요구사항: `PRD.md`
- 개발 지침: `CLAUDE.md`
- 디자인 시스템: `DESIGN.md`

환경 변수는 `.env*` 파일에 보관하며 Git에 커밋하지 않습니다. 이 저장소의 CLAUDE 지침에 따라 `.env.example`도 커밋하지 않으므로 필요한 공개 키는 위 목록을 기준으로 합니다.
