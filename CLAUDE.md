# 프로젝트: 데이터 수집 및 분석 (가칭 : DataLens)
## 프로젝트 개요
다양한 원본 데이터를 하나의 분석 작업으로 관리하는 AI 데이터 품질 관리 플랫폼의 프론트엔드

## 기술 스택
React.js (Typescript) + Vite

## 명령어
- 개발 서버: `npm run dev`
- 전체 테스트: `npm test`
- 단일 테스트: `npm test -- src/orders/order.test.ts`
- 린트/타입체크: `npm run lint && npm run typecheck`

## 구조
- `src/pages/` — 각 기능별 화면
- `src/api/` — API 관련 로직을 관리
- `src/components/` — 재사용 가능한 UI 컴포넌트
- `src/features/` — 기능(도메인) 단위로 코드를 모아 관리
- `src/hooks/` — 여러 컴포넌트에서 재사용할 수 있는 커스텀 훅

## UI 작업 규칙
- 컴포넌트, 스타일 작업 전 @DESIGN.md 를 따를 것

## 코드 규칙
- 에러는 `AppError` 클래스로 던지고 라우터에서 처리
- 새 기능에는 반드시 테스트 추가
- `any` 타입 사용 금지
- method 정의 시 반드시 주석으로 어떤 내용의 method이며, 파라미터는 어떤 것이 들어와야 하는 지 명시할 것
- 코드에 비밀 키를 넣지 않기

## 작업 흐름
- 커밋 메시지: `feat:`, `fix:`, `refactor:` 접두사 사용
- 작업 마치기 전 lint, typecheck, test 모두 통과 확인

## 주의
- IMPORTANT: DB 마이그레이션 파일은 직접 만들지 말고 `npm run migrate:new` 사용
- 환경변수는 `.env.example` 참고, `.env, .env.example, .env.local` 등 관련 `.env` 파일들은 절대 커밋하지 않음
