# GitHub Pages 배포 가이드

GitHub 계정 `rrrryeong`, 저장소 이름 `kanban`, macOS 터미널을 기준으로 설명합니다. 저장소 이름을 바꾸면 아래 원격 주소와 배포 URL의 `kanban`도 바꾸세요. 이 문서는 실행 절차만 안내하며, 저장소 생성·SSH 설정·커밋·push·배포를 실제로 수행한 상태는 아닙니다.


## Supabase 설정 — Pages 공개 전 필수

### 프로젝트 및 DB

- 개발/테스트 프로젝트와 운영 프로젝트를 별도로 구성합니다. 현재 config.js는 사용자가 제공한 `https://rcyhfsenjctcijwytfsq.supabase.co`를 가리킵니다. 운영 전 환경 구분을 확정하세요.
- Project Settings → API에서 프로젝트 URL과 publishable key를 확인해 `config.js`에 넣습니다. 이 파일은 공개됩니다. secret/service_role·OAuth secret·SMTP 비밀번호를 넣지 않습니다.
- SQL Editor에서 `supabase/migrations/202611120001_boards.sql` 전체를 **최초 한 번** 실행합니다. 이미 적용했다면 재실행하지 않습니다. 후속 변경은 새 마이그레이션으로 적용합니다.
- 검증용 `supabase/tests/boards.sql`은 별도 쿼리로 실행합니다. 마지막 PASS 결과를 확인하세요. 테스트 사용자·보드는 ROLLBACK으로 제거됩니다.

### 복귀 URL

Authentication → URL Configuration:

| 설정 | 값 |
|---|---|
| Site URL | `https://rrrryeong.github.io/kanban/` |
| 운영 Redirect URL | `https://rrrryeong.github.io/kanban/` |
| 개발 Redirect URL | `http://localhost:4173/` |
| 공급자 콜백 URL | `https://rcyhfsenjctcijwytfsq.supabase.co/auth/v1/callback` |

개발/운영 프로젝트를 나누면 각 프로젝트의 콜백을 해당 OAuth 앱에 등록합니다. 앱은 현재 origin+pathname으로 복귀하며, Pages의 `/kanban/`를 유지합니다. 개발 시 정확히 위 주소로 접속하세요. `file://`와 허용 목록에 없는 임의 주소는 사용하지 않습니다. [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)

### Google

1. Google Cloud Console에서 프로젝트와 OAuth 동의 화면을 구성합니다. 테스트 상태라면 테스트 사용자를 등록합니다.
2. Web application OAuth 클라이언트를 만듭니다. Authorized JavaScript origins에는 운영 `https://rrrryeong.github.io`와 개발 `http://localhost:4173`을, Authorized redirect URIs에는 위 Supabase 콜백을 등록합니다.
3. Supabase Authentication → Sign In / Providers → Google에 Client ID·Client Secret을 입력하고 활성화합니다. 비밀 값은 대시보드에만 저장합니다.
4. Google로 계속 → 동의 → Pages 복귀 → 개인 보드 조회를 확인합니다.

[Google 공식 연동 안내](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)

### GitHub

1. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App을 엽니다.
2. Homepage URL은 운영 Pages 주소, Authorization callback URL은 위 Supabase 콜백으로 지정합니다.
3. Client ID와 생성한 Client Secret을 Supabase의 GitHub 공급자 설정에 저장하고 활성화합니다.
4. GitHub로 계속 → 동의 → Pages 복귀를 확인합니다. 앱 인증은 OAuth이며 저장소 push에 사용하는 SSH 인증과 별개입니다.

[GitHub 공식 연동 안내](https://supabase.com/docs/guides/auth/social-sign-in/auth-github)

### 이메일 및 SMTP

1. Email 공급자의 가입과 Confirm email을 활성화하고 최소 비밀번호 길이를 **12**로 설정합니다.
2. Authentication → Email/SMTP 설정에서 본인 SMTP 제공자의 호스트·포트·인증 정보·발신 주소를 등록합니다. 실제 메일 서비스 계정과 발신 도메인 인증이 필요합니다.
3. 메일 템플릿은 기본 ConfirmationURL을 사용하고, 링크 추적을 끕니다. 확인·복구 메일이 허용된 앱 주소로 돌아오는지 확인합니다.
4. 신규 가입 → 확인 메일 → 같은 브라우저에서 확인 → 로그인, 확인 메일 재발송, 비밀번호 찾기 → 새 비밀번호 → 재로그인을 검증합니다.

기본 SMTP는 일반 사용자 대상 운영 발송용으로 사용할 수 없으므로 사용자 지정 SMTP를 설정해야 합니다. PKCE 메일 링크는 요청한 브라우저에서 완료합니다. 만료·다른 브라우저 오류 시 원래 브라우저에서 새 링크를 요청합니다. [SMTP 공식 안내](https://supabase.com/docs/guides/auth/auth-smtp)

### 배포 전 검증

```bash
npm run test:all
npm run check:supabase
```

check:supabase는 공급자 활성화와 **미인증** RPC 차단만 확인합니다. 실제 두 계정 격리는 SQL 테스트와 로그인한 브라우저에서 별도로 검증합니다. 개발과 운영에서 Google/GitHub/메일 인증, 다른 기기 보드 조회, 로그아웃 시 화면 비움, 충돌 처리, 모바일 동작을 확인합니다. 비밀 키가 클라이언트 번들에 없고 RLS가 적용되어야 합니다. [API 키와 RLS](https://supabase.com/docs/guides/getting-started/api-keys)

## 1. 배포 구조

이 앱은 정적 HTML/CSS/JavaScript 프런트엔드와 Supabase Auth·PostgreSQL로 동작합니다. 빌드 스크립트나 별도 서버가 필요하지 않고, CSS와 JavaScript 경로도 상대 경로이므로 `/kanban/` 아래에서 사용할 수 있습니다.

- 저장소: https://github.com/rrrryeong/kanban
- SSH 원격 주소: `git@github.com:rrrryeong/kanban.git`
- 배포 후 접속 주소: https://rrrryeong.github.io/kanban/
- 배포 소스: `main` 브랜치의 `/ (root)`

별도 빌드가 필요 없는 프로젝트이므로 GitHub의 브랜치 배포 방식을 사용합니다. [공식 배포 소스 설정 안내](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## 2. SSH 인증 준비

SSH는 Git의 push·pull 인증에 사용합니다. GitHub 웹사이트의 저장소 생성과 Pages 설정에는 브라우저 로그인이 필요합니다.

### 기존 키 확인 및 생성

```bash
ls -al ~/.ssh
```

이미 GitHub에 등록한 키가 있으면 재사용하고 연결 확인으로 넘어가세요. 키가 없다면 아래 이메일을 본인의 GitHub 이메일로 바꿔 실행합니다.

```bash
ssh-keygen -t ed25519 -C "YOUR_GITHUB_EMAIL"
```

저장 경로는 기본값을 사용하고 암호문(passphrase)을 설정합니다. 기존 키가 있으면 덮어쓰지 마세요. 다른 이름으로 저장했다면 이후 명령의 키 경로도 바꿉니다.

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
pbcopy < ~/.ssh/id_ed25519.pub
```

GitHub 계정의 **Settings → SSH and GPG keys → New SSH key**에서 제목을 입력하고, Key type을 **Authentication Key**로 선택한 뒤 복사한 공개 키를 붙여 넣고 저장합니다. `.pub` 공개 키만 등록하며 개인 키는 업로드하지 않습니다.

참고: [SSH 키 생성 및 에이전트 등록](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent), [GitHub에 공개 키 등록](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account)

### 연결 확인

```bash
ssh -T git@github.com
```

최초 접속 때 호스트 확인이 나오면 [GitHub 공식 지문](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints)과 비교한 뒤 승인합니다. 다음 문구가 나오면 성공입니다.

```text
Hi rrrryeong! You've successfully authenticated, but GitHub does not provide shell access.
```

성공해도 종료 코드는 `1`일 수 있습니다. 다른 사용자 이름이 나오면 키와 계정을 다시 확인하세요. SSH 주소의 사용자는 `rrrryeong`이 아니라 항상 `git`입니다. [공식 SSH 연결 확인 안내](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/testing-your-ssh-connection)

## 3. GitHub 저장소 생성

1. 브라우저에서 `rrrryeong` 계정으로 로그인합니다.
2. [새 저장소 생성](https://github.com/new)에서 Owner를 `rrrryeong`, Repository name을 `kanban`으로 입력합니다.
3. 무료 계정에서도 Pages를 사용할 수 있도록 **Public**을 선택합니다. 저장소 파일이 공개되므로 업로드할 내용을 확인하세요.
4. 로컬 프로젝트를 올릴 것이므로 README, `.gitignore`, license 자동 생성 옵션은 선택하지 않고 빈 저장소를 만듭니다.

이미 같은 이름의 저장소가 있다면 새로 만들지 말고 원격의 내용과 이력을 먼저 확인하세요. 아래 초기 업로드 명령은 빈 저장소를 전제로 합니다.

## 4. 로컬 확인 및 최초 업로드

작성 시점에 이 프로젝트 폴더에는 `.git`이 없습니다. 아래 명령은 사용자가 실제 배포할 때 실행하는 절차입니다.

```bash
cd /Users/ryeong/work/vibe/day11/kanban
```

배포 전 테스트를 실행합니다. Node.js와 npm이 필요하며, 아직 의존성과 브라우저를 설치하지 않았다면 먼저 준비합니다.

```bash
npm ci
npx playwright install chromium
npm run test:all
```

Jest와 Playwright가 모두 통과한 뒤 업로드합니다. 테스트 도구는 개발용이며 Pages에서 실행되지 않습니다.

```bash
git init -b main
git status --short
```

커밋 작성자 설정이 없다면 본인의 이름과 이메일을 이 저장소에 설정합니다. 이 값은 SSH 인증과 별개입니다.

```bash
git config user.name "rrrryeong"
git config user.email "YOUR_GITHUB_EMAIL"
```

현재 앱에는 Jekyll 처리가 필요하지 않으므로 빈 `.nojekyll` 파일을 생성합니다. [GitHub 공식 사이트 생성 안내](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)

```bash
touch .nojekyll
git add .
git diff --cached --stat
git diff --cached
```

커밋할 파일을 검토하고, 개인 키나 비밀 정보·불필요한 산출물이 포함되지 않았는지 확인한 뒤 진행합니다. `main`의 루트를 배포하므로 커밋한 문서와 테스트 파일도 공개 저장소에 포함됩니다.

```bash
git commit -m "Initial kanban application"
git remote add origin git@github.com:rrrryeong/kanban.git
git remote -v
git push -u origin main
```

이미 Git 저장소라면 `git init`은 생략하고 `git branch --show-current`와 `git remote -v`로 기존 상태를 확인하세요. `origin`이 이미 있고 이 저장소로 연결을 바꾸려는 경우에만 다음을 사용합니다.

```bash
git remote set-url origin git@github.com:rrrryeong/kanban.git
```

## 5. GitHub Pages 활성화

1. [저장소 Pages 설정](https://github.com/rrrryeong/kanban/settings/pages)을 엽니다.
2. **Build and deployment → Source**에서 **Deploy from a branch**를 선택합니다.
3. **Branch**에서 `main`, 폴더에서 `/ (root)`를 선택하고 **Save**를 누릅니다.
4. 저장소의 **Actions**에서 Pages 배포 작업의 성공 여부를 확인합니다.
5. Settings → Pages에 표시된 사이트 링크로 접속합니다. 반영에는 몇 분이 걸릴 수 있습니다.

[공식 Pages 설정 안내](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

배포 예상 주소: [https://rrrryeong.github.io/kanban/](https://rrrryeong.github.io/kanban/)

화면 표시, 카드 추가·편집·삭제·이동, 새로고침 후 저장 유지, 모바일 화면을 확인합니다. 보드는 로그인한 계정의 Supabase DB에 저장되어 다른 기기에서도 조회할 수 있습니다. 기존 로컬 데이터는 미리보기와 확인 후 빈 클라우드 보드에만 가져옵니다. OAuth와 메일 복귀는 아래 Supabase 설정을 먼저 완료해야 합니다.

## 6. 이후 업데이트

변경 후 전체 테스트를 실행하고, 원하는 파일만 명시해서 커밋합니다. 아래 파일명은 예시이므로 실제 변경 파일로 바꾸세요.

```bash
npm run test:all
git status --short
git add index.html style.css board.js app.js services.js bootstrap.js config.js vendor package.json package-lock.json supabase
git diff --cached
git commit -m "Update kanban application"
git push origin main
```

`main`에 push하면 Pages가 다시 배포합니다. 원격 변경 때문에 push가 거절되면 rebase나 강제 push를 사용하지 않고 merge합니다.

```bash
git pull --no-rebase origin main
```

충돌이 없으면 테스트를 다시 실행하고 push합니다. 충돌이 발생하면 임의로 해결하지 말고 충돌한 파일과 내용을 확인해 사용자 지시에 따릅니다.

## 7. 문제 해결

| 증상 | 확인할 내용 |
|---|---|
| `Permission denied (publickey)` | 공개 키가 `rrrryeong`에 등록되어 있는지, `ssh-add -l`에 키가 있는지, `ssh -T git@github.com` 결과 확인 |
| `Repository not found` | 저장소 존재 여부, 계정 권한, `git remote -v`의 소유자·이름 확인 |
| `remote origin already exists` | 기존 원격 주소를 확인하고 필요한 경우에만 `git remote set-url` 사용 |
| `src refspec main does not match any` | 최초 커밋 유무와 현재 브랜치 이름 확인 |
| 사이트가 404 | 배포 작업 성공 여부, `main`의 루트에 `index.html` 존재 여부, Pages 소스와 `/kanban/` URL 확인 |
| CSS·JS가 로드되지 않음 | 파일명 대소문자, 상대 경로, 브라우저 Network의 404 확인 |
| 이전 화면이 보임 | 최신 Pages 배포 완료 여부를 확인하고 강력 새로고침 |
| 폰트·아이콘이 표시되지 않음 | Google Fonts 네트워크 접근 여부 확인 |
