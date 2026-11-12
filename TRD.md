# TRD — 칸반보드 기술 요구사항

> 기반 문서: [PLAN.md](PLAN.md) · [PRD.md](PRD.md)

## 1. 기술 스택

| 구분 | 선택 | 비고 |
|---|---|---|
| 마크업 | HTML5 (`index.html`) | 다이얼로그는 `<dialog>` 요소로 만든다 |
| 스타일 | CSS3 (`style.css`) | CSS 변수로 M3 토큰을 정의하고, Grid·Flex·미디어 쿼리를 쓴다 |
| 스크립트 | 바닐라 JavaScript (ES2020) | 빌드와 번들러 없이 `<script defer>`로 불러온다 |
| 폰트·아이콘 | Google Fonts의 Roboto와 Material Symbols Rounded | CDN에서 불러온다 |
| 저장소 | `window.localStorage` | 자세한 내용은 [DATABASE_DESIGN.md](DATABASE_DESIGN.md)에 있다 |
| 유닛·통합 테스트 | Jest 30, jest-environment-jsdom | `npm test` |
| E2E 테스트 | Playwright (`@playwright/test`, Chromium) | `npm run test:e2e`. 실제 브라우저에서 User Flow를 검증한다 |
| E2E 정적 서버 | `e2e/server.js` (Node `http`, 의존성 없음) | Playwright `webServer`가 띄운다 |
| 런타임(개발) | Node.js 20 이상 | 테스트를 실행할 때만 필요하다 |

## 2. 아키텍처

```
index.html ──loads──▶ board.js  (순수 상태 로직, DOM 의존 없음)
           └─loads──▶ app.js    (렌더링 · 이벤트 · 드래그 · 저장)
                         │
                         ├─ uses ─▶ KanbanBoard (board.js 전역)
                         └─ uses ─▶ storage (localStorage 주입)
```

- **관심사 분리:** `board.js`는 입력을 받아 새 보드 상태를 돌려주는 순수 함수만 둔다. `app.js`는 상태를 받아 DOM을 다시 그린다. 데이터는 한 방향으로만 흐른다.
  - 사용자 이벤트 → `board.js` 함수 호출 → 새 상태 → 저장 → `render(state)`
- **모듈 형식:** 두 파일 모두 UMD 패턴을 쓴다.
  - 브라우저에서는 `window.KanbanBoard`와 `window.KanbanApp` 전역으로 노출한다.
  - Jest에서는 `module.exports`로 노출한다.
- **의존성 주입:** `initApp({ root, storage })`로 문서 루트와 저장소를 주입받아, 테스트에서 가짜 storage를 넣을 수 있게 한다.

## 3. 모듈 명세

### 3.1 `board.js`

```js
COLUMNS = ['todo', 'in-progress', 'done']
COLUMN_LABELS = { todo: 'To-Do', 'in-progress': 'In-Progress', done: 'Done' }

createBoard() → Board
addCard(board, columnId, { title, description }, { id?, now? }) → Board
updateCard(board, cardId, { title?, description? }, { now? }) → Board
deleteCard(board, cardId) → Board
moveCard(board, cardId, toColumnId, toIndex) → Board
moveCardBy(board, cardId, delta /* -1 | +1 */) → Board   // 이전·다음 컬럼의 맨 아래로
getColumnCards(board, columnId) → Card[]
findCardColumn(board, cardId) → columnId | null
serialize(board) → string
deserialize(text) → Board          // 손상되었으면 createBoard()를 돌려준다
```

규칙:
- 모든 함수는 **불변**이다. 입력 객체를 바꾸지 않고 새 객체를 돌려준다.
- 잘못된 입력에는 `Error`를 던진다.
  - 빈 제목(trim 후), 100자를 넘는 제목, 1000자를 넘는 설명
  - 없는 `cardId`나 `columnId`
- `toIndex`는 0보다 작으면 0으로, 길이보다 크면 맨 끝으로 보정한다.
  - 같은 컬럼 안에서 옮길 때 `toIndex`는 "원래 카드를 뺀 뒤의 목록" 기준 인덱스다.
- id는 `crypto.randomUUID()`로 만들고, 없으면 `Date.now()`와 난수를 조합한다. 테스트에서는 `options.id`로 주입할 수 있다.

### 3.2 `app.js`

```js
initApp({ root = document, storage = window.localStorage }) → { getState(), destroy() }
getDropIndex(cardRects /* {top, height}[] */, pointerY) → number   // 순수 함수, export
```

책임:
1. **초기화:** `storage.getItem(STORAGE_KEY)`를 `deserialize`해 상태를 만들고, 첫 렌더링을 한다.
2. **렌더링:** `render(state)`는 각 컬럼의 카드 목록과 카운트 배지를 다시 그린다. 카드 수가 적으므로 전체를 다시 그린다. 사용자 입력은 `textContent`로만 넣는다(XSS 방지).
3. **이벤트 위임:** 보드 루트 하나에 `click`, `pointerdown`, `keydown` 이벤트를 위임한다.
4. **다이얼로그:** 하나의 `<dialog>`를 추가와 편집 모드에서 같이 쓴다. 유효성 오류는 `aria-live` 영역에 보여 준다.
5. **저장:** 상태가 바뀔 때마다 `storage.setItem`을 호출한다. 예외가 나면 무시하고 메모리로 계속 동작한다.

### 3.3 드래그 엔진 (Pointer Events)

| 단계 | 이벤트 | 동작 |
|---|---|---|
| 대기 | `pointerdown` (카드) | 시작 좌표를 기록한다. 마우스는 이동 임계값 4px, 터치·펜은 200ms 롱프레스 타이머를 쓴다 |
| 취소 | 터치에서 타이머가 끝나기 전 10px 이상 이동 | 드래그를 취소하고 브라우저 스크롤에 맡긴다 |
| 시작 | 임계값 또는 타이머 충족 | `setPointerCapture`를 걸고, 카드를 복제한 고스트(`position: fixed`)를 만들고, 원본 위치에 플레이스홀더를 넣는다. 보드에 `.is-dragging` 클래스를 붙인다 |
| 이동 | `pointermove` | 고스트를 `transform: translate()`로 옮긴다(`requestAnimationFrame`으로 묶음). `document.elementFromPoint`로 대상 컬럼을 찾고, `getDropIndex`로 플레이스홀더 위치를 갱신한다. 화면 끝 40px 안에 있으면 자동 스크롤한다 |
| 완료 | `pointerup` | 대상 컬럼과 인덱스로 `moveCard`를 호출하고, 저장한 뒤 다시 그린다 |
| 취소 | `pointercancel`, `Esc`, 컬럼 밖에서 놓기 | 상태를 바꾸지 않고 다시 그린다 |

- 카드에는 `touch-action: pan-y`를 지정한다. 드래그 중에는 `touchmove`를 `preventDefault`해 스크롤을 막는다.
- 드래그 직후에 따라오는 `click`은 무시해서 편집 다이얼로그가 열리지 않게 한다.
- `getDropIndex`는 각 카드의 세로 중심(`top + height / 2`)보다 위에 있는 첫 카드의 인덱스를 돌려준다. 그런 카드가 없으면 길이(맨 끝)를 돌려준다.

## 4. 파일 구조

```
kanban/
├── index.html
├── style.css
├── board.js
├── app.js
├── package.json
├── playwright.config.js
├── .gitignore
├── tests/                 # Jest
│   ├── board.test.js      # @jest-environment node
│   ├── app.test.js        # @jest-environment jsdom
│   └── server.test.js     # E2E 정적 서버의 경로 검증
└── e2e/                   # Playwright
    ├── server.js          # 정적 파일 서버
    ├── helpers.js         # 시딩, 상태 읽기, 폰트 차단, 터치 드래그
    ├── smoke.spec.js
    ├── board.spec.js
    ├── card-crud.spec.js
    ├── drag-mouse.spec.js
    ├── drag-touch.spec.js
    ├── keyboard.spec.js
    ├── resilience.spec.js
    ├── responsive.spec.js
    └── theme-a11y.spec.js
```

`package.json` 스크립트:

| 스크립트 | 명령 | 용도 |
|---|---|---|
| `test` | `jest` | 유닛·통합 테스트 |
| `test:e2e` | `playwright test` | E2E 테스트 |
| `test:all` | `npm test && npm run test:e2e` | 작업 완료를 판정하는 기준 |

Jest가 `e2e/*.spec.js`를 실행하지 않도록 Jest 설정에 `testPathIgnorePatterns: ['/node_modules/', '/e2e/']`를 둔다.

## 5. 테스트 전략

### 5.1 개발 원칙: TDD (Red → Green → Refactor, test first)

모든 기능 추가, 버그 수정, 동작 변경은 다음 순서로 진행한다.

1. **Red:** 원하는 동작을 표현하는 테스트를 **먼저** 작성하고 실행해 실패하는지 확인한다. 실패 이유가 "기능 없음"이어야 한다(오타나 설정 오류로 실패하면 안 된다).
2. **Green:** 테스트를 통과시키는 최소한의 코드를 작성하고, 모든 테스트를 실행해 통과를 확인한다.
3. **Refactor:** 테스트가 통과하는 상태를 유지하면서 중복과 구조를 정리하고, 다시 모든 테스트를 실행한다.

보조 규칙:
- 이미 구현된 동작에 테스트를 붙이면 Red를 자연스럽게 볼 수 없다. 그럴 때는 대상 동작을 잠시 깨뜨려 테스트가 실패하는지 확인(Red 검증)한 뒤 원복한다.
- E2E가 버그를 찾으면 가능한 한 Jest 유닛·통합 테스트로 먼저 재현(Red)한 뒤 고친다.
- 작업 보고에는 단계마다 Red와 Green을 확인했는지 적는다.

### 5.2 테스트 레벨

| 레벨 | 도구 | 대상 | 방법 |
|---|---|---|---|
| 유닛 | Jest (node) | `board.js` 전체 함수, `getDropIndex` | 입력과 출력을 비교하고, 불변성(`Object.freeze`한 입력)과 예외를 확인한다 |
| 통합 | Jest (jsdom) | `app.js`와 DOM | `index.html`의 `<body>`를 jsdom에 넣고 `initApp`에 메모리 storage를 주입한다 |
| 드래그(통합) | Jest (jsdom) | 포인터 시퀀스 | `PointerEvent`가 없으면 `MouseEvent`로 폴리필한다. `getBoundingClientRect`와 `document.elementFromPoint`를 mock하고, 롱프레스는 `jest.useFakeTimers()`로 시뮬레이션한다 |
| E2E | Playwright (Chromium) | User Flow 전체, 실제 레이아웃·CSS·포인터·터치 | USER_FLOW §5의 시나리오(E2E-01~10)를 실제 브라우저에서 실행한다 |

### 5.3 E2E 구성 (Playwright)

- **서버:** `playwright.config.js`의 `webServer`가 `node e2e/server.js`를 실행한다. 포트는 4173이고 `reuseExistingServer: !process.env.CI`로 둔다. `baseURL`은 `http://localhost:4173`이다.
- **프로젝트:**

| 이름 | 디바이스 | 대상 spec |
|---|---|---|
| `desktop` | Desktop Chrome, 1280×800 | `drag-touch.spec.js`를 뺀 전부 |
| `mobile` | Pixel 7 (hasTouch, isMobile) | `smoke`, `card-crud`, `drag-touch`, `responsive` |

  프로젝트별 대상은 `testMatch`/`testIgnore`로 지정한다.
- **격리:** 테스트마다 새 브라우저 컨텍스트를 쓰므로 `localStorage`가 비어 있다. 초기 데이터가 필요하면 `page.addInitScript`로 `kanban.board` 키를 미리 넣는다(DATABASE_DESIGN §8).
- **외부 리소스:** 네트워크 상태와 무관하게 결과가 같도록 `fonts.googleapis.com`과 `fonts.gstatic.com` 요청은 `page.route`로 차단한다.
- **로케이터:** 역할과 이름(`getByRole`), 라벨(`getByLabel`)을 우선 쓴다. 구조를 확인해야 할 때만 `data-*` 속성 셀렉터를 쓴다.
- **대기:** `waitForTimeout`은 쓰지 않는다. 자동 대기(`expect(...).toBeVisible()` 등)를 쓴다. 롱프레스처럼 시간이 조건인 경우에만 `page.clock`을 쓴다.
- **마우스 드래그:** `page.mouse.down()`, `move(x, y, { steps })`, `up()`으로 실제 포인터 이벤트를 만든다. 좌표는 `locator.boundingBox()`로 구한다.
- **터치 드래그:** Playwright에는 터치 드래그 API가 없다. 그래서 Chromium CDP 세션의 `Input.dispatchTouchEvent`(touchStart → 대기 → touchMove × n → touchEnd)로 실제 터치 입력을 만든다. 헬퍼는 `e2e/helpers.js`의 `touchDrag(page, from, to, { holdMs })`다.
- **실패 진단:** `trace: 'on-first-retry'`, `screenshot: 'only-on-failure'`. 보고서는 `playwright-report/`에 생긴다.
- **사전 준비:** Chromium 시스템 라이브러리가 필요하다. 이 설치는 사용자가 직접 한다(TASKS Phase 7).

주요 케이스:
- 카드 추가/편집/삭제가 DOM, 카운트 배지, storage에 반영되는지 확인한다.
- 재초기화했을 때 복원되는지, 손상된 storage에서 복구되는지, `setItem`이 예외를 던져도 동작하는지 확인한다.
- 드래그 동작을 확인한다.
  - 컬럼 간 이동과 같은 컬럼 내 재정렬
  - `Esc`나 컬럼 밖에서 놓았을 때 취소되는지
  - 드래그 뒤 click이 무시되는지
- 터치 롱프레스 전에 움직이면 드래그가 시작되지 않는지 확인한다.
- 메뉴의 이전·다음 이동과 경계 컬럼에서 비활성화되는지 확인한다.
- 사용자 입력 `<script>` 문자열이 텍스트로 표시되는지(XSS) 확인한다.

완료 조건: `npm run test:all`(Jest와 Playwright E2E)이 모두 통과해야 한다(AGENTS.md).

## 6. 보안·제약

- 사용자 입력은 `innerHTML`에 넣지 않는다.
- 외부 스크립트는 불러오지 않는다. 외부 리소스는 Google Fonts CSS만 쓴다.
- `localStorage` 용량은 약 5MB로 충분하다. 저장할 때 `QuotaExceededError`가 나면 무시한다.
