# TASKS — 칸반보드

> 기반 문서: [PLAN.md](PLAN.md) · [PRD.md](PRD.md) · [TRD.md](TRD.md) · [USER_FLOW.md](USER_FLOW.md) · [DATABASE_DESIGN.md](DATABASE_DESIGN.md) · [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)
>
> 완료 기준: 각 단계가 끝날 때마다 모든 테스트가 통과해야 한다(AGENTS.md). Phase 8부터는 `npm run test:all`(Jest와 Playwright E2E)을 기준으로 한다. 체크박스는 작업이 끝나면 `[x]`로 바꾼다.
>
> **TDD 원칙:** 모든 작업은 Red → Green → Refactor 순서의 test first로 진행한다(TRD §5.1).
>
> **변경 이력**
> - 2026-11-12: Phase 0~6 완료(T6-1, T6-2는 사용자가 수동으로 확인함).
> - 2026-11-12: Playwright E2E를 추가하고 TDD 원칙을 도입했다. 사용자가 직접 할 작업을 Phase 7로 맨 앞에 모았다. Phase 8~10은 Claude가 한 번에 구현한다.

## Phase 0. 프로젝트 셋업
- [x] T0-1 `package.json`을 만든다(`"test": "jest"`, devDependencies `jest`, `jest-environment-jsdom`).
- [x] T0-2 `npm install`을 실행한다.
- [x] T0-3 `.gitignore`에 `node_modules/`, `coverage/`를 넣는다.
- [x] T0-4 `tests/` 디렉터리를 만들고 빈 스모크 테스트로 Jest가 실행되는지 확인한다.

## Phase 1. 상태 로직 — `board.js` (TDD)
> 참고: TRD §3.1, DATABASE_DESIGN §3–5
- [x] T1-1 UMD 골격과 `COLUMNS`, `COLUMN_LABELS`, `createBoard`를 만든다.
- [x] T1-2 `addCard`: 입력 검증(빈 제목, 100자 제한, 1000자 제한)과 id·시각 주입을 구현한다.
- [x] T1-3 `updateCard`, `deleteCard`를 구현한다(없는 id면 에러, updatedAt 갱신).
- [x] T1-4 `moveCard`: 컬럼 간 이동, 같은 컬럼 내 재정렬, 인덱스 보정을 구현한다.
- [x] T1-5 `moveCardBy`(이전·다음 컬럼), `getColumnCards`, `findCardColumn`을 구현한다.
- [x] T1-6 `serialize`와 `deserialize`를 구현한다. 무결성 규칙 1–6을 반영한다.
- [x] T1-7 `tests/board.test.js`를 작성한다. 모든 함수의 정상·예외 경로와, `Object.freeze`한 입력으로 불변성을 확인한다.
- [x] ✅ `npm test` 통과

## Phase 2. 마크업 — `index.html`
> 참고: DESIGN_SYSTEM §5, §7
- [x] T2-1 head를 작성한다: 뷰포트 메타, Google Fonts, `style.css`, `board.js`·`app.js`(`defer`).
- [x] T2-2 Top App Bar와 `main.board`를 만들고, 세 개의 `section.column[data-column]`에 헤더·배지·목록·카드 추가 버튼을 둔다.
- [x] T2-3 카드 편집 `<dialog>`를 만든다: 폼, 제목·설명 필드, 오류 영역, 글자 수 카운터.
- [x] T2-4 삭제 확인 `<dialog>`, 카드 메뉴 템플릿, `aria-live` 영역, 모바일 FAB를 만든다.

## Phase 3. 스타일 — `style.css`
> 참고: DESIGN_SYSTEM 전체
- [x] T3-1 `:root` 토큰을 정의한다(색상, 타이포, shape, spacing, elevation, motion)와 다크모드 재정의를 넣는다.
- [x] T3-2 기본 스타일을 잡는다: reset, body 배경, 포커스 링, `prefers-reduced-motion`.
- [x] T3-3 앱 바와 컬럼(액센트 바, 배지, 빈 상태, 드롭 대상 하이라이트) 스타일을 만든다.
- [x] T3-4 카드, 고스트, 플레이스홀더, 상태 레이어 스타일을 만든다.
- [x] T3-5 버튼(Filled, Text, Icon, FAB), Outlined Text Field, Menu, Dialog 스타일을 만든다.
- [x] T3-6 반응형 구간 Compact, Medium, Expanded를 적용하고, 360px에서 가로 넘침이 없는지 확인한다.

## Phase 4. 앱 로직 — `app.js`
> 참고: TRD §3.2, USER_FLOW §3
- [x] T4-1 `initApp({ root, storage })`: 불러오기, `render`, 저장(예외는 무시)을 구현한다.
- [x] T4-2 렌더링: `textContent`로 카드와 배지, 빈 상태를 그린다.
- [x] T4-3 카드 추가·편집 다이얼로그 흐름을 만든다(유효성 오류 표시, 포커스 복귀).
- [x] T4-4 카드 메뉴(편집, 이전·다음 이동, 삭제)와 삭제 확인을 만든다. 경계 컬럼에서는 메뉴 항목을 비활성화한다.
- [x] T4-5 `aria-live`로 이동 결과를 알린다.
- [x] T4-6 `tests/app.test.js`를 작성한다: 렌더링, 추가·편집·삭제, 복원, 손상 복구, storage 예외, XSS, 메뉴 이동.
- [x] ✅ `npm test` 통과

## Phase 5. 드래그 앤 드롭 (Pointer Events)
> 참고: TRD §3.3, USER_FLOW §3.4–3.5
- [x] T5-1 `getDropIndex(cardRects, pointerY)` 순수 함수와 테스트를 작성한다.
- [x] T5-2 마우스 드래그: 4px 임계값, 고스트, 플레이스홀더, `elementFromPoint`로 대상 탐색, 드롭 시 `moveCard`.
- [x] T5-3 터치 드래그: 200ms 롱프레스, 그 전 10px 이동이면 취소, `touch-action`, 드래그 중 스크롤 방지.
- [x] T5-4 취소 처리(`Esc`, `pointercancel`, 컬럼 밖), 드래그 직후 click 무시, 같은 자리면 저장 생략.
- [x] T5-5 화면 가장자리 자동 스크롤과 `requestAnimationFrame` 쓰로틀링을 넣는다.
- [x] T5-6 드래그 통합 테스트를 작성한다: 컬럼 간 이동, 같은 컬럼 내 재정렬, 취소, 롱프레스(fake timers), click 무시.
- [x] ✅ `npm test` 통과

## Phase 6. 마무리 & 검증
- [x] T6-1 수동 점검: 데스크톱 Chrome에서 드래그·키보드 조작, DevTools 모바일 에뮬레이션(360px, 768px)에서 터치 드래그와 레이아웃. (사용자 확인 완료)
- [x] T6-2 라이트·다크 모드 대비와 포커스 링을 확인한다. (사용자 확인 완료)
- [x] T6-3 `npm test -- --coverage`로 `board.js` 커버리지가 90% 이상인지 확인한다.
- [x] T6-4 `README.md`에 실행 방법(`index.html` 열기)과 테스트 방법(`npm test`)을 적는다.
- [x] T6-5 최종 보고에 통과한 테스트 수를 적고, `WORKFLOW.md`를 업데이트한다.
- [x] ✅ 최종 `npm test` 모두 통과

---

# 남은 작업

## Phase 7. 사용자 작업 — 사용자가 직접 수행 ⚠️ (가장 먼저)
> Claude는 sudo 비밀번호를 입력할 수 없으므로 이 단계는 사용자가 직접 해야 한다. 이 단계가 끝나야 Phase 8~10을 한 번에 진행할 수 있다.
- [x] U-1 (사용자 완료) Chromium 실행에 필요한 시스템 라이브러리를 설치한다(sudo 필요).
  - 2026-11-12 점검 결과, 이 환경(Ubuntu 22.04, WSL2)에는 `libnss3`, `libnspr4`, `libasound2`가 없다.
  - Node가 nvm으로 설치되어 있어 `sudo npx`는 node를 찾지 못한다. PATH를 넘겨서 실행한다.
  ```bash
  cd ~/work/vibe/day14/kanban
  sudo env "PATH=$PATH" npx -y playwright install-deps chromium
  ```
  - 위 명령이 실패하면 최소 패키지만 설치한다: `sudo apt-get install -y libnss3 libnspr4 libasound2`
- [x] U-2 (사용자 완료) 설치가 끝났다고 Claude에게 알린다. 그러면 Claude가 Phase 8~10을 진행한다.

## Phase 8. Playwright 셋업 (Claude)
> 참고: TRD §1, §4, §5.3
- [x] T8-1 `npm install -D @playwright/test`를 실행하고, `npx playwright install chromium`으로 브라우저를 내려받는다.
- [x] T8-2 `e2e/server.js`를 만든다. 의존성 없는 Node 정적 서버로, 기본 포트는 4173이다.
- [x] T8-3 `playwright.config.js`를 만든다.
  - `webServer`로 위 정적 서버를 띄운다.
  - 프로젝트는 `desktop`(Desktop Chrome, 1280×800)과 `mobile`(Pixel 7, hasTouch)이다.
  - `trace: 'on-first-retry'`
- [x] T8-4 `package.json`을 정리한다.
  - 스크립트: `test`(jest), `test:e2e`(playwright test), `test:all`(둘 다)
  - Jest 설정에 `testPathIgnorePatterns: ['/node_modules/', '/e2e/']`를 넣는다.
- [x] T8-5 `.gitignore`에 `test-results/`, `playwright-report/`, `blob-report/`를 추가한다.
- [x] T8-6 E2E 공통 헬퍼 `e2e/helpers.js`를 만든다: localStorage 시딩, 보드 상태 읽기, Google Fonts 요청 차단, 터치 드래그(CDP).
- [x] T8-7 **Red → Green:** 스모크 E2E(`e2e/smoke.spec.js`, 제목 "Kanban"과 세 컬럼)를 먼저 작성한다. 서버나 설정이 없는 상태에서 실패(Red)를 확인한 뒤 셋업을 마쳐 통과(Green)시킨다.
- [x] ✅ `npm run test:all` 통과

## Phase 9. User Flow 기반 E2E (Claude, TDD)
> 참고: USER_FLOW §5(시나리오 표), DESIGN_SYSTEM §8, DATABASE_DESIGN §8
>
> 각 시나리오는 **테스트를 먼저 작성 → Red 확인 → Green → Refactor** 순서로 진행한다.
> - 이미 구현된 동작이라 테스트가 바로 통과하면, 해당 동작을 잠시 깨뜨려 실패하는지 확인(Red 검증)한 뒤 원복한다.
> - E2E가 버그를 찾으면 먼저 Jest 유닛 테스트로 버그를 재현(Red)하고, 고쳐서(Green) 정리(Refactor)한다.
- [x] T9-1 E2E-01 첫 실행, 저장된 보드 복원, 새로고침 후 유지 (`e2e/board.spec.js`)
- [x] T9-2 E2E-02 카드 추가: 컬럼 버튼, Enter 저장, 빈 제목 오류, 취소·Esc·배경 클릭, 모바일 FAB (`e2e/card-crud.spec.js`)
- [x] T9-3 E2E-03 카드 편집: 카드 클릭, 키보드 Enter (`e2e/card-crud.spec.js`)
- [x] T9-4 E2E-04 카드 삭제: 확인과 취소 (`e2e/card-crud.spec.js`)
- [x] T9-5 E2E-05 마우스 드래그: 컬럼 간 이동, 같은 컬럼 내 재정렬, 빈 컬럼으로 이동, Esc·보드 밖 취소 (`e2e/drag-mouse.spec.js`, desktop)
- [x] T9-6 E2E-06 터치 드래그: 롱프레스 후 이동, 롱프레스 전 움직이면 드래그되지 않음 (`e2e/drag-touch.spec.js`, mobile)
- [x] T9-7 E2E-07 키보드 메뉴 이동: Tab, Enter, 화살표, 경계 컬럼 비활성화, 포커스 복귀, 이동 알림 (`e2e/keyboard.spec.js`)
- [x] T9-8 E2E-08 예외 흐름: 손상된 저장 데이터, `localStorage` 쓰기 실패 (`e2e/resilience.spec.js`)
- [x] T9-9 E2E-09 반응형 레이아웃: 360·768·1280px의 컬럼 배치, 가로 넘침 없음, FAB 노출, 전체 화면 다이얼로그 (`e2e/responsive.spec.js`)
- [x] T9-10 E2E-10 테마·접근성: 다크모드 색상 토큰, `:focus-visible` 포커스 링, `prefers-reduced-motion` (`e2e/theme-a11y.spec.js`)
- [x] ✅ `npm run test:all` 통과

## Phase 10. 마무리 (Claude)
- [x] T10-1 Refactor: E2E 헬퍼의 중복을 정리하고, 불안정한(flaky) 대기 코드가 없는지 점검한다(`waitForTimeout` 금지).
- [x] T10-2 `README.md`에 E2E 실행 방법(`npm run test:e2e`, `npx playwright show-report`)과 사전 준비(Phase 7)를 적는다.
- [x] T10-3 최종 보고에 Jest와 E2E의 통과 수를 각각 적고, `WORKFLOW.md`를 업데이트한다.
- [x] ✅ 최종 `npm run test:all` 모두 통과
