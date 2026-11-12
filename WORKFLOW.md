# WORKFLOW

---

## 1. 프롬프트

```
@../../day13/todo/에서 AGENTS.md와 CLAUDE.md를 이 폴더로 복사해줘. 기존 프로젝트에 의존적인 내용은 모두 삭제하고 중립적인 규칙만 남겨줘. 이번에 만들 어플리케이션은 칸반보드야.
```

### 결과
- `../../day13/todo/`의 `AGENTS.md`, `CLAUDE.md`를 이 폴더로 복사했다.
- 원본 내용을 검토한 결과 todo 프로젝트에 의존적인 내용(특정 파일·기술 스택·명령어 등)이 없어 규칙은 그대로 유지했다. (기본 규칙, Git 규칙, WORKFLOW.md 작업 기록 규칙)
- `CLAUDE.md`는 `@AGENTS.md`를 참조하는 한 줄 그대로 유지했다.
- 작업 기록 규칙에 따라 `WORKFLOW.md`를 새로 만들고 이 항목을 기록했다.

---

## 2. 프롬프트

```
HTML과 css, js만으로 구성되는 칸반보드를 만들려고 해. 보드에는 To-Do, In-Progress, Done의 세가지 컬럼이 있어. 카드를 드래그해서 각 컬럼간 이동이 가능하게 해야 돼. HTML과 css, js는 각각 다른 파일로 저장해줘. UI에는 머티리얼을 적용해주고 반응형으로 모바일에서도 문제없이 보이게 해줘. 테스트는 jest로 구성하고 테스트가 완료되어야 작업이 끝나는 거야.
```

### 결과
- 플랜 모드에서 구현 계획만 작성했다. 코드는 아직 작성하지 않았다.
- 계획 요약:
  - 파일 구성: `index.html` / `style.css` / `board.js`(순수 상태 로직) / `app.js`(DOM·드래그·저장)
  - 저장: `localStorage`
  - Material: Material Design 3 스타일을 CSS로 직접 구현
  - 드래그: Pointer Events로 마우스와 터치 지원
  - 반응형: 데스크톱 3컬럼, 모바일은 세로로 쌓기
  - 테스트: Jest + jsdom

---

## 3. 프롬프트

```
이 계획을 PLAN.md로 저장해줘
```

### 결과
- 2번 프롬프트에서 작성한 구현 계획을 프로젝트 루트의 `PLAN.md`로 저장했다.
- 검증 단계의 WORKFLOW 항목 번호를 "2번"에서 "다음 번호"로 바꿨다.

---

## 4. 프롬프트

```
PLAN.md를 기반으로 다음 문서들을 만들어줘: PRD, TRD, User Flow, Database Design, Design System, TASKS. 모두 md로 작성해줘.
```

### 결과
- `PLAN.md`를 바탕으로 기획·설계 문서 6개를 만들었다.
  - `PRD.md`: 목표, 비목표, 사용자 스토리, 기능·비기능 요구사항, 출시 기준
  - `TRD.md`: 기술 스택, 아키텍처(`board.js` 순수 로직 / `app.js` DOM), 모듈 API, Pointer Events 드래그 엔진, 테스트 전략
  - `USER_FLOW.md`: 화면 구성, 전체 흐름과 드래그 시퀀스(Mermaid), 추가·편집·삭제·드래그·키보드 이동 흐름, 예외 흐름
  - `DATABASE_DESIGN.md`: `localStorage` 키 `kanban.board`, 정규화 스키마(`cards` 맵 + `columns` id 배열, `version: 1`), 무결성 규칙, 마이그레이션 방침
  - `DESIGN_SYSTEM.md`: M3 색상·타이포·shape·elevation·motion 토큰(라이트/다크), 컴포넌트 규격, 반응형 구간, 접근성 체크리스트
  - `TASKS.md`: Phase 0~6 작업 목록. 단계마다 `npm test` 통과를 완료 조건으로 둔다.
- 결정 사항:
  - 카드의 컬럼과 순서는 `columns` 배열 위치로만 표현한다.
  - 제목은 100자, 설명은 1000자로 제한한다.
  - 모바일에서는 컬럼을 세로로 쌓고, 600~899px 구간은 가로 스크롤 보드로 만든다.

---

## 5. 프롬프트

```
문서를 모두 확인했으니 이제 TASKS.md의 순서대로 작업을 진행해줘
```

### 결과
- TASKS.md의 Phase 0~6을 순서대로 진행했다.
  - Phase 0: `package.json`(jest, jest-environment-jsdom), `.gitignore`, `npm install`, 스모크 테스트로 Jest 동작 확인(확인 후 삭제)
  - Phase 1: `board.js`(불변 순수 함수, 에러 `code` 부여)와 `tests/board.test.js`
  - Phase 2: `index.html`(앱 바, 3컬럼, FAB, 카드 메뉴, 추가·편집 다이얼로그, 삭제 확인 다이얼로그, `aria-live` 영역)
  - Phase 3: `style.css`(M3 토큰과 다크모드, 상태 레이어, 카드·고스트·플레이스홀더, 버튼·메뉴·다이얼로그·Outlined Text Field, 반응형 3구간, reduced-motion)
  - Phase 4·5: `app.js`(렌더링, 다이얼로그, 메뉴 키보드 탐색, Pointer Events 드래그, `localStorage` 저장)와 `tests/app.test.js`
  - Phase 6: `README.md` 작성, `TASKS.md` 체크박스 갱신
- 드래그 구현:
  - 마우스는 4px 이동부터 드래그로 본다.
  - 터치는 200ms 롱프레스 후 드래그가 시작되고, 그 전 10px 넘게 움직이면 스크롤로 본다.
  - Esc, pointercancel, 보드 밖에 놓기는 취소로 처리하고, 드래그 직후의 click은 무시한다.
  - 화면 가장자리에서 자동 스크롤하고, 고스트 이동은 rAF로 묶는다.
- 결정 사항:
  - `moveCard`, `updateCard`는 변경이 없으면 같은 보드 객체를 돌려준다. 앱은 이를 이용해 저장을 생략한다.
  - 메뉴가 열린 상태에서 메뉴 밖을 클릭하면 메뉴만 닫는다.
- 테스트 결과:
  - `npm test`: 2개 스위트, 103개 테스트 모두 통과
  - 커버리지: `board.js` 문장 99%, `app.js` 문장 93%
- 미완료: T6-1(브라우저 수동 점검), T6-2(라이트·다크 대비 확인)는 이 환경에 브라우저가 없어 사용자 확인으로 남겼다.

---

## 6. 프롬프트

```
T6-1, T6-2는 완료했어. 그런데 앞으로는 브라우저에서의 테스트도 네가 할 수 있도록 playwright를 사용했으면 좋곘어. 그리고 테스트시에는 반드시 red-green-refactor의 순서로, test first의 순서로 진행하는 걸 원칙으로 하자. playwright를 설치하고 User Flow 기반으로 E2E 테스트를 추가하는 걸로 계획을 변경하고 구현할 거야. 내가 입력한 프롬프트 기반으로 설계문서들을 변경해줘. TASKS.md에서는 내가 직접 해야 하는 일이 있을 것 같은데 이 부분은 남은 작업 중 가장 앞쪽에 몰아서 배치해줘. 그후 네가 한번에 구현할 수 있게 하자.
```

### 결과
- 설계 문서를 Playwright E2E 도입과 TDD 원칙에 맞게 고쳤다. 코드와 설치는 아직 하지 않았다.
  - `PLAN.md`: "계획 변경" 섹션을 추가했다.
  - `PRD.md`: G5, NFR-8(E2E), NFR-9(TDD)를 넣고 출시 기준을 갱신했다.
  - `TRD.md`: 스택에 Playwright와 정적 서버를 넣었다.
    - 파일 구조에 `e2e/`, `playwright.config.js`를 넣고, 스크립트 `test`/`test:e2e`/`test:all`을 정의했다.
    - §5.1 TDD, §5.2 테스트 레벨, §5.3 E2E 구성(desktop/mobile 프로젝트, CDP 터치 드래그, 폰트 차단, `waitForTimeout` 금지)을 썼다.
  - `USER_FLOW.md`: §5에 E2E-01~10 시나리오 매핑 표를 넣었다.
  - `DATABASE_DESIGN.md`: §8에 `addInitScript` 시딩, `readBoard` 검증, 손상·쓰기 실패 시뮬레이션을 썼다.
  - `DESIGN_SYSTEM.md`: §8에 360·768·1280px 레이아웃, 다크모드, 포커스 링, 모션 줄이기 검증 기준을 썼다.
  - `TASKS.md`: T6-1, T6-2를 완료 처리했다. 사용자 작업(Phase 7)을 남은 작업 맨 앞에 두고, Phase 8(셋업), 9(E2E, TDD), 10(마무리)을 추가했다.
  - `AGENTS.md`: TDD 원칙(Red → Green → Refactor, test first)을 넣고, E2E도 함께 실행하도록 테스트 규칙을 바꿨다.
- 환경 점검 결과:
  - Chromium 실행에 필요한 `libnss3`, `libnspr4`, `libasound2`가 없다.
  - sudo는 비밀번호가 필요하고, node가 nvm으로 설치되어 있다.
  - 그래서 U-1 명령을 `sudo env "PATH=$PATH" npx -y playwright install-deps chromium`으로 정했다.

---

## 7. 프롬프트

```
Phase 7이 끝났으니 이제 공용 repo의 /home/ubuntu/work/kosa-ict-genai-2026-hyundai/src/exercise/bardroh 폴더에 이 프로젝트의 필요한 파일들을 복사하고 commit & push해줘. 그후 Phase 8부터 Phase 10까지 모두 구현해줘
```

### 결과
- **공용 repo 반영:**
  - 기존 관례(`bardroh/day13/todo`)에 맞춰 `src/exercise/bardroh/day14/kanban/`에 프로젝트 파일을 복사했다(`node_modules`, `coverage` 제외).
  - 원격이 1커밋 앞서 있어 `git pull --no-rebase`로 merge했다(충돌 없음).
  - `main`에 커밋 `16a8457`("[day14] bardroh: 칸반보드 앱 - 3컬럼 드래그 앤 드롭·머티리얼 디자인")을 만들고 push했다.
  - 이 커밋은 Phase 8~10 이전 상태다.
- **Phase 8 (Playwright 셋업):**
  - `@playwright/test` 1.65.0과 Chromium headless shell을 설치했다.
  - `e2e/server.js`(의존성 없는 정적 서버)와 `playwright.config.js`(desktop 1280×800, mobile Pixel 7)를 만들었다.
  - 스크립트 `test`/`test:e2e`/`test:all`을 정의하고, Jest에서 `e2e/`를 제외했다. `.gitignore`도 갱신했다.
  - `e2e/helpers.js`를 만들었다: 폰트 차단 fixture, `seedBoard`, `readBoard`, `countStorageWrites`, `mouseDrag`, CDP `touchDrag`.
  - TDD:
    - 스모크 E2E를 먼저 작성해, 서버와 baseURL이 없어 실패하는 것(Red)을 확인한 뒤 셋업으로 통과(Green)시켰다.
    - `tests/server.test.js`는 경로 검사를 깨뜨려 Red를 검증했다.
    - 처음 작성한 경로 탐색 기대값은 WHATWG URL 정규화 때문에 틀려서 테스트를 바로잡았다.
- **Phase 9 (User Flow E2E-01~10):** spec 9개를 작성했다: board, card-crud, drag-mouse, drag-touch, keyboard, resilience, responsive, theme-a11y, smoke.
  - E2E가 찾은 실제 버그(Red):
    - 아이콘 폰트를 불러오지 못하면 `more_vert` 글자가 ⋮ 버튼 밖으로 넘쳐 1280px에서 페이지 가로 넘침(1299px)이 생겼다.
    - CSS 레이아웃 문제라 jsdom으로는 재현할 수 없어서 E2E를 Red로 삼았다.
    - `.material-symbols-rounded`에 `width/height: 1em; overflow: hidden`을 넣어 고쳤다(Green).
  - 테스트 쪽 오류 수정:
    - 카운터 기대값을 9에서 8로 고쳤다(공백 포함 8자).
    - 다이얼로그 폭은 열림 애니메이션이 끝난 뒤 재도록 했다.
  - 이미 구현된 동작이라 바로 통과한 시나리오는 뮤테이션 16개로 Red를 검증했다. 모두 실패를 확인하고 원복했다.
- **Phase 10:**
  - Refactor: `titleField`/`descField` 헬퍼로 중복을 정리했다. `waitForTimeout`은 쓰지 않는다.
  - E2E를 3회 반복 실행해 156개가 통과했다(flaky 없음).
  - README에 E2E 실행 방법과 사전 준비를 적었다.
  - TRD(파일 구조), DESIGN_SYSTEM(아이콘 규칙)을 보완하고, TASKS와 PRD 체크박스를 완료로 바꿨다.
- **테스트 결과:**
  - Jest: 3개 스위트, 115개 통과
  - Playwright: 52개 통과, 2개는 설계상 건너뜀(데스크톱 전용 배경 클릭, 모바일 전용 FAB)

---

## 8. 프롬프트

```
공용 repo에도 복사해서 commit & push해줘
```

### 결과
- Phase 8~10 결과를 공용 repo의 `src/exercise/bardroh/day14/kanban/`에 다시 복사했다. `node_modules`, `coverage`, `test-results`, `playwright-report`, `blob-report`는 제외했다.
- 원격 변경을 `git pull --no-rebase`로 merge한 뒤 `main`에 커밋하고 push했다.

---

## 9. 프롬프트

```
# AGENTS.md instructions for /Users/ryeong/work/vibe/day11/kanban

<INSTRUCTIONS>
# AGENTS.md

## 기본 규칙

- **언어:** 사용자에게 보여 주는 모든 메시지(답변, 작업 중 안내, 요약)는 한국어로 작성한다. 코드, 명령어, 파일 이름, 오류 원문은 그대로 둔다.
- **요청 범위:** 사용자가 명시적으로 요청한 작업만 수행한다. 요청하지 않은 파일 추가·수정, 리팩터링, 설치, 설정 변경, 다른 폴더로의 복사·동기화, 커밋·push 등은 하지 않는다. 필요해 보이는 추가 작업은 실행하지 말고 제안만 한다.
  - 예외: 이 파일의 작업 기록 규칙에 따른 `WORKFLOW.md` 업데이트는 항상 수행한다.
- **TDD 원칙:** 기능 추가, 버그 수정, 동작 변경은 test first로, Red → Green → Refactor 순서로 진행한다.
  - Red: 원하는 동작을 표현하는 테스트를 먼저 작성하고 실행해, 기대한 이유로 실패하는지 확인한다.
  - Green: 테스트를 통과시키는 최소한의 코드를 작성하고 모든 테스트를 실행한다.
  - Refactor: 테스트가 통과하는 상태를 유지하면서 코드를 정리하고 다시 모든 테스트를 실행한다.
  - 이미 구현된 동작에 테스트를 붙여 바로 통과하면, 대상 동작을 잠시 깨뜨려 테스트가 실패하는지 확인한 뒤 원복한다.
  - 최종 보고에 각 단계의 Red와 Green을 확인했는지 적는다.
- **테스트 필수:** 코드(소스 파일, 테스트 파일, 의존성 설정)를 수정하면 작업을 마치기 전에 반드시 프로젝트의 테스트를 **모두** 실행한다. 유닛 테스트뿐 아니라 브라우저 E2E 테스트(Playwright)가 있으면 함께 실행한다.
  - 화면이나 사용자 동작에 영향을 주는 변경은 브라우저 E2E 테스트로도 검증한다.
  - 모든 테스트가 통과했을 때만 작업을 완료로 보고한다. 하나라도 실패하면 완료가 아니다.
  - 실패하면 원인을 고치고 다시 실행해 통과할 때까지 반복한다. 끝내 통과시키지 못하면 완료라고 하지 말고, 실패한 테스트와 출력 내용을 그대로 보고한다.
  - 동작을 바꿔 기존 테스트의 기대값이 달라지면, 테스트를 새 동작에 맞게 고치고 무엇을 왜 바꿨는지 보고한다.
  - 새 기능을 추가하면 해당 기능의 유닛 테스트도 함께 작성한다.
  - 최종 보고에 테스트 실행 결과(유닛과 E2E 각각의 통과한 테스트 수)를 적는다.

## Git 규칙

- **rebase 금지:** `git rebase`, `git pull --rebase` 등 rebase는 사용하지 않는다.
- **항상 merge:** 원격에 새 커밋이 있어 push가 안 되면 `git pull --no-rebase`(또는 `git fetch` 후 `git merge origin/<브랜치>`)로 merge한 뒤 push한다.
- merge 중 충돌이 나면 임의로 해결하지 말고, 충돌한 파일과 내용을 사용자에게 보고한 뒤 지시를 따른다.

## 작업 기록 규칙 (WORKFLOW.md)

- 사용자가 입력하는 **모든 프롬프트**와 그 결과를 프로젝트 루트의 `WORKFLOW.md`에 기록한다.
- 프롬프트는 **원문 그대로**(수정·요약·번역 없이) 코드 블록 안에 저장한다.
- 결과는 수행한 작업, 생성·수정한 파일, 주요 결정 사항 위주로 **요약**해서 저장한다.
- 항목은 번호를 붙여 시간 순서대로 파일 끝에 추가한다. 기존 항목은 수정하지 않는다.
- 각 프롬프트의 작업을 마칠 때마다 같은 응답 안에서 `WORKFLOW.md`를 업데이트한다.

항목 형식:

````markdown
---

## N. 프롬프트

```
<프롬프트 원문>
```

### 결과
- <결과 요약>
````

</INSTRUCTIONS>
```

### 결과
- 프로젝트 작업 규칙을 확인했다. 한국어 응답, 요청 범위 준수, 코드 변경 시 TDD 및 전체 테스트, 프롬프트 원문 기록 규칙을 적용한다.

---

## 10. 프롬프트

```
kanban 어플리케이션을 github pages로 배포할건데 방법을 정리해서 GITHUB.md 파일에 저장해줘
```

### 결과
- 프로젝트 구성 확인 예정임을 안내한 뒤 사용자가 요청을 중단했다. 파일 변경은 없었다.

---

## 11. 프롬프트

```
kanban 어플리케이션을 github pages로 배포할건데 방법을 정리해서 GITHUB.md 파일에 저장해줘. 내 github 아이디는 rrrryeong 이고 로그인은 ssh 방법을 이용할거야.
```

### 결과
- GITHUB.md를 생성했다. 빌드 없는 정적 앱과 Git 저장소 미초기화 상태를 확인하고, rrrryeong/kanban을 가정한 SSH 인증·최초 업로드·브랜치 기반 Pages 배포·업데이트·문제 해결 절차와 공식 문서 링크를 정리했다. 실제 설정 변경, 설치, 커밋, push, 배포는 수행하지 않았다. WORKFLOW.md에 요청 원문과 결과를 추가했다. 문서만 변경하여 TDD Red/Green 및 유닛·E2E 테스트는 적용하지 않았고 실행하지 않았다.
