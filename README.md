# DataLens Frontend

파일 업로드, 데이터 품질 분석, 정제 규칙 승인 및 결과 다운로드 흐름을 제공하는 React 프론트엔드입니다. 현재 파일 처리는 브라우저 기반 데모이며 실제 저장소, 작업 큐, AI 분석은 백엔드 연결 단계에서 대체할 수 있도록 구성되어 있습니다.

## 기술 구성

- React 19 + React Compiler
- React Router 8
- Vite 8 + TypeScript 6
- Axios, Recharts
- Oxlint + ESLint
- Vitest + Testing Library

## 실행

```bash
npm install
npm run dev
```

개발 서버는 `http://localhost:5173`을 사용합니다.

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

환경 변수는 `.env*` 파일에 보관하며 Git에 커밋하지 않습니다.
