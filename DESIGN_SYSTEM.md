# Design System — 칸반보드 (Material Design 3)

> 기반 문서: [PLAN.md](PLAN.md) · [PRD.md](PRD.md)

외부 컴포넌트 라이브러리 없이 **Material Design 3(M3)** 토큰과 컴포넌트 규칙을 `style.css`의 CSS 변수와 클래스로 직접 구현한다.

## 1. 리소스

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0..1,0&display=swap" rel="stylesheet">
```

아이콘 요소(`.material-symbols-rounded`)는 `width/height: 1em; overflow: hidden`으로 크기를 고정한다. 아이콘 폰트를 불러오지 못하면 `more_vert` 같은 글자가 그대로 보이는데, 이때도 버튼 밖으로 넘치지 않게 하기 위해서다(E2E-09에서 발견).

사용 아이콘: `add`, `more_vert`, `edit`, `delete`, `arrow_back`, `arrow_forward`, `drag_indicator`, `view_kanban`

## 2. 색상 토큰

시드 색상 `#6750A4`(M3 기본 보라)를 기준으로 한 톤 팔레트다. `:root`에 정의하고, `prefers-color-scheme: dark`일 때 다시 정의한다.

| 토큰 | Light | Dark | 용도 |
|---|---|---|---|
| `--md-primary` | `#6750A4` | `#D0BCFF` | 주요 버튼, FAB, 포커스 링 |
| `--md-on-primary` | `#FFFFFF` | `#381E72` | primary 위 텍스트 |
| `--md-primary-container` | `#EADDFF` | `#4F378B` | 카운트 배지 |
| `--md-on-primary-container` | `#21005D` | `#EADDFF` | 배지 텍스트 |
| `--md-surface` | `#FEF7FF` | `#141218` | 페이지 배경 |
| `--md-surface-container` | `#F3EDF7` | `#211F26` | 컬럼 배경 |
| `--md-surface-container-lowest` | `#FFFFFF` | `#0F0D13` | 카드 배경 |
| `--md-surface-container-high` | `#ECE6F0` | `#2B2930` | 다이얼로그, 메뉴 |
| `--md-on-surface` | `#1D1B20` | `#E6E0E9` | 본문 텍스트 |
| `--md-on-surface-variant` | `#49454F` | `#CAC4D0` | 보조 텍스트, 아이콘 |
| `--md-outline` | `#79747E` | `#938F99` | 입력란 테두리 |
| `--md-outline-variant` | `#CAC4D0` | `#49454F` | 구분선, 플레이스홀더 테두리 |
| `--md-error` | `#B3261E` | `#F2B8B5` | 유효성 오류, 삭제 버튼 |

### 컬럼 액센트

컬럼 헤더 왼쪽의 4px 바와 카드 왼쪽 테두리에 쓴다.

| 컬럼 | 토큰 | Light | Dark |
|---|---|---|---|
| To-Do | `--kb-todo` | `#7D5260` (tertiary) | `#EFB8C8` |
| In-Progress | `--kb-progress` | `#6750A4` (primary) | `#D0BCFF` |
| Done | `--kb-done` | `#386A20` | `#9CD67D` |

## 3. 타이포그래피

글꼴은 `Roboto, "Noto Sans KR", system-ui, sans-serif`다.

| 토큰 | 크기 / 줄높이 / 굵기 | 용도 |
|---|---|---|
| `title-large` | 22 / 28 / 400 | 앱 바 제목 |
| `title-medium` | 16 / 24 / 500 | 컬럼 이름, 다이얼로그 제목 |
| `body-large` | 16 / 24 / 400 | 입력란 |
| `body-medium` | 14 / 20 / 400 | 카드 제목 |
| `body-small` | 12 / 16 / 400 | 카드 설명(최대 3줄, 말줄임), 오류 문구 |
| `label-large` | 14 / 20 / 500 | 버튼 |
| `label-small` | 11 / 16 / 500 | 카운트 배지 |

## 4. 형태 · 간격 · 엘리베이션

| 구분 | 토큰 | 값 |
|---|---|---|
| Shape | `--md-shape-xs` / `-sm` / `-md` / `-lg` / `-xl` / `-full` | 4 / 8 / 12 / 16 / 28 / 9999px |
| Spacing | `--sp-1` … `--sp-6` | 4 / 8 / 12 / 16 / 24 / 32px |
| Elevation 0 | `--md-elev-0` | none (컬럼) |
| Elevation 1 | `--md-elev-1` | `0 1px 2px rgb(0 0 0 / .3), 0 1px 3px 1px rgb(0 0 0 / .15)` (카드) |
| Elevation 2 | `--md-elev-2` | `0 1px 2px rgb(0 0 0 / .3), 0 2px 6px 2px rgb(0 0 0 / .15)` (카드 hover, 메뉴) |
| Elevation 3 | `--md-elev-3` | `0 4px 8px 3px rgb(0 0 0 / .15), 0 1px 3px rgb(0 0 0 / .3)` (FAB, 다이얼로그) |
| Elevation 4 | `--md-elev-4` | `0 6px 10px 4px rgb(0 0 0 / .15), 0 2px 3px rgb(0 0 0 / .3)` (드래그 중 고스트) |

### 상태 레이어 (State layer)

인터랙티브 요소의 `::before` 가상 요소에 `currentColor`를 깔고 불투명도로 상태를 나타낸다.

| 상태 | 불투명도 |
|---|---|
| hover | 0.08 |
| focus | 0.10 |
| pressed | 0.10 |
| dragged | 0.16 |

포커스 링은 `outline: 3px solid var(--md-primary); outline-offset: 2px`이고, `:focus-visible`에서만 보인다.

### 모션

| 토큰 | 값 | 용도 |
|---|---|---|
| `--md-motion-short` | `150ms cubic-bezier(0.2, 0, 0, 1)` | hover, 상태 레이어 |
| `--md-motion-medium` | `250ms cubic-bezier(0.2, 0, 0, 1)` | 다이얼로그, 카드 들어올림 |

`prefers-reduced-motion: reduce`일 때는 모든 전환을 0ms로 만든다.

## 5. 컴포넌트

### Top App Bar (`.app-bar`)
- 높이는 64px(모바일 56px)이고 배경은 `--md-surface`, 스크롤되면 `--md-surface-container`로 바뀐다.
- 왼쪽에 `view_kanban` 아이콘과 "Kanban" 제목(`title-large`)을 둔다.

### Column (`.column`)
- 배경 `--md-surface-container`, 라운드 `--md-shape-lg`, 안쪽 여백 `--sp-3`.
- 헤더에는 액센트 바, 컬럼명(`title-medium`), 카운트 배지(`--md-primary-container`, 라운드 `full`, 최소 폭 24px)를 둔다.
- 카드 목록은 세로 Flex이고 간격은 `--sp-2`, 최소 높이는 120px(빈 컬럼에도 드롭할 수 있도록)이다.
- 빈 상태는 `--md-on-surface-variant` 색의 `body-small` 문구 "카드를 여기로 끌어오세요"다.
- 드롭 대상이 되면 배경에 primary 8% 오버레이를 깔고, `outline: 2px dashed var(--md-primary)`를 그린다.

### Card (`.card`) — M3 Elevated Card
- 배경 `--md-surface-container-lowest`, 라운드 `--md-shape-md`, 엘리베이션 1.
- 왼쪽에 컬럼 액센트 색의 4px 테두리를 둔다.
- 안쪽 여백은 `--sp-3 --sp-4`이고, 오른쪽 위에 ⋮ 아이콘 버튼(40×40 터치 영역)을 둔다.
- hover하면 엘리베이션 2, 커서 `grab`이 된다.
- `.card--ghost`: 엘리베이션 4, `rotate(2deg) scale(1.02)`, `cursor: grabbing`, `pointer-events: none`.
- `.card-placeholder`: 원래 카드 높이를 유지하고 `2px dashed var(--md-outline-variant)`, 투명 배경, 라운드 `md`.

### Buttons
| 종류 | 클래스 | 스타일 |
|---|---|---|
| Filled | `.btn-filled` | primary 배경, on-primary 텍스트, 높이 40px, 라운드 full (다이얼로그 저장) |
| Text | `.btn-text` | 투명 배경, primary 텍스트 (취소, 카드 추가) |
| Icon | `.btn-icon` | 40×40, 라운드 full, on-surface-variant (⋮) |
| FAB | `.fab` | 56×56, 라운드 `lg`, primary-container, 엘리베이션 3. 모바일에서만 오른쪽 아래에 고정되고 To-Do에 카드를 추가한다 |

### Dialog (`dialog.dialog`) — M3 Basic Dialog
- 배경 `--md-surface-container-high`, 라운드 `--md-shape-xl`, 안쪽 여백 24px, 폭 `min(560px, 100vw - 32px)`.
- 배경막(`::backdrop`)은 `rgb(0 0 0 / .32)`이다.
- 버튼은 오른쪽으로 정렬한다(취소 Text, 저장 Filled).
- 모바일(< 600px)에서는 전체 화면(Full-screen dialog)으로 바뀐다.

### Text Field (`.text-field`) — M3 Outlined
- 1px `--md-outline` 테두리, 라운드 `xs`, 높이 56px. 설명은 `textarea`이고 최소 3줄이다.
- 포커스하면 2px `--md-primary` 테두리가 되고, 라벨이 위로 올라간다(floating label).
- 오류가 나면 테두리와 라벨, 보조 문구가 `--md-error` 색이 된다.
- 글자 수 카운터(`12/100`)를 오른쪽 아래에 둔다.

### Menu (`.menu`)
- 배경 `--md-surface-container-high`, 라운드 `xs`, 엘리베이션 2, 항목 높이 48px.
- 각 항목은 아이콘과 `label-large` 텍스트다. 삭제 항목은 `--md-error` 색이다. 비활성 항목은 불투명도 0.38이다.

## 6. 레이아웃 & 반응형

| 구간 | 폭 | 레이아웃 |
|---|---|---|
| Compact | `< 600px` | 컬럼을 세로로 쌓고(1열), 페이지 좌우 여백을 16px로 한다. FAB를 보여 주고, 다이얼로그는 전체 화면이다 |
| Medium | `600–899px` | 가로 스크롤 보드다. 컬럼 폭 `min(320px, 85vw)`, `scroll-snap-type: x mandatory`를 쓰고, 페이지에는 가로 스크롤이 생기지 않는다(보드 내부만 스크롤) |
| Expanded | `≥ 900px` | `grid-template-columns: repeat(3, 1fr)`, 최대 폭 1280px, 가운데 정렬, 간격 24px |

- 뷰포트 메타 태그: `<meta name="viewport" content="width=device-width, initial-scale=1">`
- 터치 대상은 최소 40×40px(M3 권장 48px)이다.
- 안전 영역: FAB에 `env(safe-area-inset-bottom)`을 반영한다.

## 7. 접근성 체크리스트

- [ ] 컬럼은 `<section aria-labelledby>`, 카드 목록은 `role="list"`, 카드는 `role="listitem"`으로 마크업한다.
- [ ] 카운트 배지에 `aria-label="카드 3개"`를 붙인다.
- [ ] 아이콘 버튼마다 `aria-label`을 단다("카드 메뉴", "카드 추가").
- [ ] 드래그나 메뉴로 이동한 결과를 `aria-live="polite"` 영역에 알린다("'드래그 구현'을 Done으로 옮겼습니다").
- [ ] 다이얼로그를 닫으면 포커스를 원래 요소로 되돌린다.
- [ ] 라이트·다크 모드 모두 텍스트 대비 4.5:1 이상이다.

## 8. E2E로 검증하는 디자인 기준

Playwright(`e2e/responsive.spec.js`, `e2e/theme-a11y.spec.js`)로 다음 기준을 자동 검증한다. 폰트 로딩에 따라 결과가 흔들리지 않도록 스크린샷 비교 대신 레이아웃 수치와 계산된 스타일로 확인한다.

| 구간 | 뷰포트 | 검증 |
|---|---|---|
| Compact | 360×740 | 세 컬럼의 `x`가 같고 `y`가 증가한다(세로로 쌓임). FAB가 보인다. 카드 다이얼로그 폭이 뷰포트와 같다(전체 화면) |
| Medium | 768×1024 | 세 컬럼의 `y`가 같다. 보드에만 가로 스크롤이 있다(`board.scrollWidth > board.clientWidth`). FAB가 숨겨진다 |
| Expanded | 1280×800 | 세 컬럼의 `y`와 폭이 같다. 보드 폭은 1280px 이하이고 가운데 정렬이다. FAB가 숨겨진다 |
| 공통 | 모든 구간 | 페이지에 가로 스크롤이 없다(`documentElement.scrollWidth <= innerWidth`). 터치 대상(⋮, 카드 추가, FAB)이 40×40px 이상이다 |

| 항목 | 검증 |
|---|---|
| 다크모드 | `emulateMedia({ colorScheme: 'dark' })`일 때 `body` 배경이 `rgb(20, 18, 24)`(`#141218`)다. 라이트일 때는 `rgb(254, 247, 255)`(`#FEF7FF`)다 |
| 포커스 링 | 키보드(Tab)로 포커스한 버튼의 `outline-style`이 `solid`이고 `outline-width`가 3px이다 |
| 모션 줄이기 | `emulateMedia({ reducedMotion: 'reduce' })`일 때 카드의 `transition-duration`이 `0s`다 |
| 컬럼 액센트 | To-Do, In-Progress, Done 카드의 왼쪽 테두리 색이 각각 `--kb-todo`, `--kb-progress`, `--kb-done`이다 |
