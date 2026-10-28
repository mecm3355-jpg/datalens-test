# 0002. MongoDB 사용자 인증과 데이터 소유권

- 상태: 적용
- 결정일: 2026-10-29

## 결정

외부 인증 공급자 대신 FastAPI와 MongoDB에서 사용자 인증을 관리한다.

- `users`: 정규화 이메일, 표시 이름, Argon2id 비밀번호 해시, 역할, 로그인 실패·잠금 상태
- `sessions`: 사용자 ID, 불투명 토큰의 SHA-256 해시, 생성·만료 시각
- `password_resets`: 사용자 ID, 일회용 토큰의 SHA-256 해시, 생성·만료·사용 시각
- `files`, `processing_jobs`, `processing_results`, `complaints`, `category_candidates`,
  `reviews`, `issues`: 사용자 격리를 위한 `ownerId`

보호 API는 HttpOnly·Secure·SameSite=Lax 세션 쿠키를 검증한다. 저장소 계층은 인증된
`ownerId`를 모든 조회·집계·수정·삭제 조건에 강제로 포함한다. 작업 워커는 작업의
`ownerId`를 결과와 민원 분석 산출물에 전파한다.

## 기존 데이터 이전

첫 회원가입 요청이 원자적으로 관리자 자리를 차지한다. 이 계정에 기존 `ownerId` 없는
업무 문서를 일괄 귀속한다. 두 번째 가입자부터는 일반 사용자이며 다른 사용자의 문서를
조회하거나 변경할 수 없다.

## 비밀번호 재설정

일회용 토큰 생성·만료·사용과 비밀번호 변경 후 전체 세션 폐기는 구현한다. 로컬 데모는
`AUTH_EXPOSE_RESET_TOKEN=true`일 때만 토큰을 응답한다. 운영 메일 발송은 수신자 이메일과
토큰을 외부 공급자에 보내므로 공급자를 별도로 승인·구성하기 전에는 503으로 안내한다.
