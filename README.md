# Kanban

HTML, CSS, JavaScript만으로 만든 칸반보드입니다. To-Do, In-Progress, Done 세 컬럼 사이로 카드를 드래그해 옮길 수 있고, Material Design 3 스타일과 반응형 레이아웃(데스크톱·태블릿·모바일)을 적용했습니다.

## 실행

빌드 과정이 없습니다. `index.html`을 브라우저로 열면 됩니다.

```bash
# 또는 로컬 서버로 열기
npx serve .
```

데이터는 브라우저 `localStorage`의 `kanban.board` 키에 저장됩니다.

## 사용법

- **추가:** 각 컬럼의 "카드 추가" 버튼을 누릅니다. 모바일에서는 오른쪽 아래 + 버튼으로도 추가할 수 있습니다(To-Do에 추가).
- **편집:** 카드를 클릭하거나, 카드에 포커스한 뒤 `Enter`를 누릅니다.
- **이동:**
  - 마우스: 카드를 끌어 원하는 컬럼이나 위치에 놓습니다.
  - 터치: 카드를 약 0.2초 길게 누른 뒤 끕니다.
  - 키보드: ⋮ 메뉴에서 "이전/다음 컬럼으로 이동"을 고릅니다.
  - 끄는 도중 `Esc`를 누르거나 보드 밖에 놓으면 취소됩니다.
- **삭제:** ⋮ 메뉴에서 "삭제"를 고른 뒤 확인합니다.

## 테스트

모든 개발은 test first(Red → Green → Refactor)로 진행합니다.

```bash
npm install
npm test            # Jest 유닛·통합 테스트
npm run test:e2e    # Playwright E2E (데스크톱·모바일 Chromium)
npm run test:all    # 둘 다 실행 (작업 완료 기준)
npx playwright show-report   # 마지막 E2E 결과 보고서 열기
```

### E2E 사전 준비 (처음 한 번)

```bash
npx playwright install chromium
# Linux에서 Chromium 시스템 라이브러리가 없다면 (sudo 필요, nvm 사용 시 PATH 전달)
sudo env "PATH=$PATH" npx -y playwright install-deps chromium
```

- E2E는 `e2e/server.js`(의존성 없는 정적 서버, 포트 4173)를 Playwright가 자동으로 띄웁니다.
- 시나리오(E2E-01~10)와 User Flow의 대응은 [USER_FLOW.md](USER_FLOW.md) §5에 있습니다.

## 파일 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 마크업 |
| `style.css` | Material Design 3 토큰과 컴포넌트, 반응형 스타일 |
| `board.js` | 순수 상태 로직(추가·편집·삭제·이동·직렬화) |
| `app.js` | 렌더링, 이벤트, Pointer Events 드래그, 저장 |
| `tests/` | Jest 테스트 (`board.test.js`, `app.test.js`, `server.test.js`) |
| `e2e/` | Playwright E2E (시나리오 spec, `helpers.js`, `server.js`) |
| `playwright.config.js` | E2E 설정 (`desktop`, `mobile` 프로젝트, webServer) |

설계 문서: [PRD](PRD.md) · [TRD](TRD.md) · [User Flow](USER_FLOW.md) · [Database Design](DATABASE_DESIGN.md) · [Design System](DESIGN_SYSTEM.md) · [TASKS](TASKS.md)
