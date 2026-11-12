# 칸반보드 구현 계획

## Context
`day14/kanban/`은 현재 `AGENTS.md`, `CLAUDE.md`, `WORKFLOW.md`만 있는 빈 폴더다. 여기에 프레임워크 없이 HTML/CSS/JS만으로 칸반보드를 만든다.
- 컬럼은 To-Do, In-Progress, Done 세 개다.
- 카드를 드래그해서 컬럼 사이로 옮기고, 같은 컬럼 안에서 순서도 바꿀 수 있다.
- UI는 Material Design 3을 따르고, 반응형으로 모바일에서도 문제없이 보여야 한다.
- 테스트는 Jest로 구성하며, 모든 테스트가 통과해야 작업이 끝난다(AGENTS.md 규칙).

day13/todo와 같은 패턴을 따른다.
- 순수 로직 모듈과 DOM 모듈을 나누고, 브라우저 전역과 CommonJS를 둘 다 지원하는 UMD 패턴을 쓴다.
- 테스트는 `jest` + `jest-environment-jsdom` 조합이다.
- DOM 테스트는 `index.html`의 `<body>`를 읽어 jsdom에 주입한다.

## 기본값으로 정한 사항 (승인 시 변경 가능)
- **저장:** `localStorage`에 저장해 새로고침해도 유지한다. 서버는 쓰지 않는다.
- **카드 기능:** 추가(컬럼별 "+ 카드 추가"), 제목/설명 편집, 삭제, 드래그 이동을 지원한다.
- **Material:** 외부 JS 라이브러리 없이 Material Design 3 토큰(색상, 엘리베이션, 라운드, 상태 레이어)을 `style.css`에 직접 구현한다. Google Fonts의 Roboto 폰트와 Material Symbols 아이콘만 CDN으로 불러온다.
- **드래그:** HTML5 DnD는 모바일 터치에서 동작하지 않는다. 그래서 **Pointer Events**로 직접 구현해 마우스와 터치를 함께 지원한다.
  - 터치에서는 롱프레스(약 200ms)를 해야 드래그가 시작되고, 그 전에는 스크롤로 동작한다.
  - 키보드 접근성을 위해 카드 메뉴에 "다음 컬럼으로 이동"을 둔다.
- **반응형:**
  - 데스크톱(≥ 900px)은 3컬럼 그리드다.
  - 태블릿은 가로 스크롤과 scroll-snap을 쓴다.
  - 모바일(< 600px)은 컬럼을 세로로 쌓는다.
  - 상단에 Material Top App Bar를 둔다.

## 파일 구성
| 파일 | 역할 |
|---|---|
| `index.html` | 마크업: 앱 바, 3개 컬럼, 카드 편집 다이얼로그(`<dialog>`) |
| `style.css` | M3 토큰(`:root` CSS 변수, 다크모드는 `prefers-color-scheme`), 카드·컬럼·FAB·다이얼로그 스타일, 드래그 중 고스트·플레이스홀더, 미디어 쿼리 |
| `board.js` | 순수 상태 로직, DOM 의존 없음 |
| `app.js` | DOM 렌더링, 이벤트, 포인터 드래그, `localStorage` 연동 |
| `package.json` | `"test": "jest"`, devDependencies `jest`, `jest-environment-jsdom` |
| `tests/board.test.js` | 상태 로직 유닛 테스트(node 환경) |
| `tests/app.test.js` | DOM 통합 테스트(`@jest-environment jsdom`) |
| `.gitignore` | `node_modules` |

`board.js`가 제공하는 함수:
- `COLUMNS = ['todo','in-progress','done']`
- `createBoard()`
- `addCard(board, column, {title, description})`
- `updateCard`, `deleteCard`
- `moveCard(board, id, toColumn, toIndex)`: 컬럼 간 이동과 같은 컬럼 내 재정렬을 모두 처리한다.
- `serialize` / `deserialize`: 손상된 데이터는 빈 보드로 복구한다.

모든 함수는 불변으로 새 보드를 반환한다. 제목은 trim 후 비어 있으면 에러를 낸다.

`app.js`가 제공하는 것:
- `initApp({ root, storage })`
- 드롭 위치 계산 함수 `getDropIndex(cardRects, pointerY)`: 순수 함수로 분리하고 export해서 테스트한다.

## 테스트 계획
- **board.test.js:**
  - 추가: id가 고유한지, 빈 제목이면 거부하는지 확인한다.
  - 편집과 삭제를 확인한다.
  - moveCard: 컬럼 간 이동, 같은 컬럼 내 재정렬, 범위를 벗어난 index는 끝으로 보내는지, 없는 id/컬럼은 에러인지 확인한다.
  - 불변성과 serialize/deserialize(손상 데이터 포함)를 확인한다.
- **app.test.js:**
  - 초기 렌더링(3개 컬럼, 카운트 배지)을 확인한다.
  - 카드 추가/편집/삭제가 DOM과 `localStorage`에 반영되는지 확인한다.
  - 새로고침(재초기화) 후 복원되는지 확인한다.
  - PointerEvent(`pointerdown` → `pointermove` → `pointerup`)를 시뮬레이션해 카드가 다른 컬럼으로 이동하는지 확인한다. jsdom에는 레이아웃이 없으므로 `getBoundingClientRect`와 `document.elementFromPoint`를 mock한다.
  - 메뉴의 "다음 컬럼으로 이동"을 확인한다.
  - `getDropIndex`를 확인한다.

## 검증
1. `npm install` 후 `npm test`를 실행해 모든 테스트가 통과하는지 확인하고, 통과 수를 보고한다.
2. `index.html`을 브라우저로 열어 수동으로 확인할 수 있다. 데스크톱 드래그, 모바일 뷰포트(DevTools)의 터치 드래그, 레이아웃 전환을 본다.
3. AGENTS.md 규칙에 따라 `WORKFLOW.md`에 다음 번호 항목(프롬프트 원문과 결과 요약)을 추가한다.

---

## 계획 변경 (2026-11-12): Playwright E2E와 TDD 도입

### Context
Phase 0~6을 마쳤고, 브라우저 수동 점검(T6-1, T6-2)은 사용자가 직접 확인했다. 앞으로는 브라우저 테스트도 Claude가 자동으로 할 수 있도록 Playwright E2E를 도입한다. 모든 테스트 작업은 **test first, Red → Green → Refactor** 순서를 원칙으로 한다.

### 변경 내용
- **테스트 구성:** 기존 Jest(유닛·통합)는 그대로 둔다. 여기에 Playwright(Chromium) E2E를 추가한다.
  - 프로젝트: `desktop`(1280×800), `mobile`(Pixel 7, 터치)
  - 서버: 의존성 없는 Node 정적 서버(`e2e/server.js`)를 Playwright `webServer`로 띄운다.
  - 터치 드래그: CDP `Input.dispatchTouchEvent`로 실제 터치 입력을 만든다.
- **E2E 범위:** USER_FLOW.md의 흐름을 시나리오 E2E-01~10으로 대응시킨다(USER_FLOW §5). 반응형과 테마 기준은 DESIGN_SYSTEM §8에 있다.
- **완료 기준:** `npm run test:all`(= `npm test` + `npm run test:e2e`)이 모두 통과해야 한다.
- **TDD:** 테스트를 먼저 쓰고 실패(Red)를 확인한 뒤 구현(Green)하고 정리(Refactor)한다. 이미 구현된 동작에 붙이는 테스트는 동작을 잠시 깨뜨려 Red를 검증한다(TRD §5.1).
- **작업 순서:**
  - 사용자가 직접 해야 하는 일(sudo로 Chromium 시스템 라이브러리 설치)을 TASKS Phase 7로 맨 앞에 모은다.
  - 그 뒤 Phase 8~10을 Claude가 한 번에 진행한다.

### 변경된 문서
- `PRD.md`: G5, NFR-8(E2E), NFR-9(TDD), 출시 기준
- `TRD.md`: 기술 스택, 파일 구조와 스크립트, §5 테스트 전략(5.1 TDD, 5.2 레벨, 5.3 E2E 구성)
- `USER_FLOW.md`: §5 E2E 시나리오 매핑
- `DATABASE_DESIGN.md`: §8 E2E 시딩과 검증
- `DESIGN_SYSTEM.md`: §8 E2E로 검증하는 디자인 기준
- `TASKS.md`: T6-1, T6-2 완료 처리, Phase 7(사용자 작업)과 Phase 8~10 추가
- `AGENTS.md`: TDD 원칙과 E2E 실행 규칙

### 검증
1. 사용자가 Phase 7을 마친 뒤 Claude가 Phase 8~10을 TDD로 진행한다.
2. `npm run test:all`이 모두 통과하는지 확인하고, Jest와 E2E의 통과 수를 각각 보고한다.
