# Kanban

Google·GitHub·이메일로 인증하고 개인 보드를 Supabase에 저장하는 HTML/CSS/JavaScript 칸반 앱입니다. GitHub Pages에서 실행하며 별도 빌드 서버는 필요하지 않습니다.

## 준비 및 실행

1. `config.js`의 프로젝트 URL과 publishable key를 확인합니다. 공개 클라이언트 설정이며 비밀 키를 넣으면 안 됩니다.
2. Supabase SQL Editor에서 `supabase/migrations/202611120001_boards.sql`을 한 번 실행합니다.
3. [배포 및 인증 설정](GITHUB.md)에 따라 Google·GitHub OAuth, Redirect URLs, 이메일 확인, SMTP를 설정합니다.
4. 로컬 서버로 실행합니다. 인증 복귀가 필요하므로 `file://`로 열지 않습니다.

```bash
npm ci
node e2e/server.js
# http://localhost:4173/
```

## 사용

로그인 후 세 컬럼에서 카드를 추가·편집·삭제하고 마우스·터치·키보드로 이동합니다. 비밀번호 가입은 12자 이상과 메일 확인이 필요합니다. 메일 확인·재설정 링크는 요청한 브라우저에서 엽니다. 비밀번호 재설정·확인 메일 재발송은 로그인 화면에서 제공합니다.

보드는 사용자당 하나이며 Supabase PostgreSQL에 저장합니다. 저장 성공 후 화면에 확정 반영하고 실패하면 입력을 유지합니다. 충돌하면 초안을 보관한 뒤 최신 보드를 불러와 다시 적용합니다. 새로고침·화면 재진입 시 최신 데이터를 조회합니다. 편집 중에는 자동 조회를 미룹니다. 실시간 공동 편집과 오프라인 쓰기는 제공하지 않습니다.

기존 `kanban.board` 데이터는 빈 클라우드 보드에서 미리보기를 확인한 뒤 가져올 수 있습니다. 원본은 삭제하지 않습니다. 세션은 SDK가 관리하며 비밀번호와 보드는 로컬에 저장하지 않습니다(기존 이전 원본 제외).

## 테스트

```bash
npx playwright install chromium
npm test -- --runInBand  # Jest 유닛·DOM 및 임베디드 PostgreSQL 테스트
npm run test:db         # SQL/RLS 테스트만 실행
npm run test:e2e        # SDK 대역과 테스트 서버 저장소를 사용하는 desktop/mobile E2E
npm run test:all        # 전체 자동 테스트
npm run check:supabase  # 실제 프로젝트 공개 설정·미인증 RPC 차단 확인
```

DB 자동 테스트는 PGlite의 PostgreSQL에서 실제 마이그레이션·RLS·RPC를 실행하고 Auth UID만 테스트용으로 대체합니다. 실제 Supabase의 전체 통합 검증과 동일하지 않습니다. 실제 프로젝트에서는 SQL Editor로 `supabase/tests/boards.sql`을 실행합니다. 테스트 데이터 변경은 ROLLBACK됩니다. OAuth 공급자 동의·메일 수신·Pages 복귀는 별도 수동 검증이 필요합니다.

## 구성

- `board.js`: 순수 보드 연산
- `app.js`: 카드 UI, 비동기 저장과 오류 처리
- `services.js`: Supabase Auth·DB 어댑터
- `bootstrap.js`: 인증 화면과 계정별 보드 생명주기
- `config.js`: 공개 프로젝트 설정
- `vendor/`: Supabase SDK 2.119.0의 UMD 번들과 MIT 라이선스
- `supabase/`: 스키마 마이그레이션 및 실제 DB 검증 SQL

SDK를 갱신할 때는 의존성 버전을 고정하고 `npm run vendor:supabase`로 배포 번들을 다시 생성한 뒤 전체 테스트를 실행합니다. 설정·외부 연동을 포함한 실제 완료 상태는 [TASKS](TASKS.md)를 참고하세요.

설계: [PLAN](PLAN.md) · [PRD](PRD.md) · [TRD](TRD.md) · [사용자 흐름](USER_FLOW.md) · [DB](DATABASE_DESIGN.md) · [디자인](DESIGN_SYSTEM.md)
