# TRD — Supabase 인증·클라우드 저장

## 구조
정적 HTML/CSS와 바닐라 JavaScript, Supabase JS SDK를 사용한다. board.js는 순수 상태 로직, app.js는 카드 UI, services.js는 Auth/DB 어댑터, bootstrap.js는 인증 화면과 계정별 앱 생명주기를 담당한다. 실제 설정 없이는 인증 우회 없이 설정 안내를 표시한다.

## 인터페이스
Auth는 session, subscribe, oauth, signIn, signUp, resend, reset, updatePassword, signOut을 제공한다. 보드 저장소는 load/create/save(board, expectedRevision)/importBoard를 제공한다. initApp은 초기 보드와 비동기 저장 함수를 주입받으며 저장 완료 Promise를 UI가 기다린다. 기존 동기 storage 주입은 유닛 테스트 호환용으로만 유지한다.

## 동작
초기 확인 중 보드 숨김 → 인증 → 서버 조회/최초 생성 → 렌더링. 계정 전환·로그아웃 시 구독·이벤트·다이얼로그·드래그·상태를 폐기하고 이전 요청 결과를 무시한다. 토큰 갱신만으로 편집 화면을 재생성하지 않는다.

저장 중 추가 조작 차단. 성공 후 상태 확정. 실패 시 기존 상태·입력 유지. 충돌은 자동 덮어쓰지 않으며 최신 보드 불러오기와 초안 표시로 재적용을 지원한다. 화면 재진입 시 편집 중이면 새로고침을 미룬다. 조회 오류를 빈 보드로 처리하지 않는다.

## 인증
OAuth/메일은 PKCE, SDK 세션 지속·자동 갱신 사용. 복귀는 진입 페이지. recovery 세션은 비밀번호 변경 화면을 우선한다. 동일 브라우저 제약을 안내한다. 이메일 비밀번호 최소 12자, 가입 비밀번호 확인. 공급자 기본 계정 연결을 따른다.

## 검증
Jest 유닛/DOM, Playwright desktop/mobile, 별도 실제 Supabase DB 통합 검증. 실제 OAuth/메일은 운영 전 수동 확인. 기능마다 Red → Green → Refactor와 전체 회귀 테스트 필수.
