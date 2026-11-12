const { test, expect, addCard, cards } = require('./helpers');

test('로그아웃하면 보드를 숨기고 이메일 로그인으로 돌아온다',async({page})=>{
 await page.goto('/');await addCard(page,'todo','비공개 카드');
 await page.getByRole('button',{name:'로그아웃',exact:true}).click();
 await expect(page.locator('[data-board]')).toBeHidden();
 await expect(page.getByRole('heading',{name:'로그인',exact:true})).toBeVisible();
 await page.getByLabel('이메일',{exact:true}).fill('member@example.com');
 await page.getByLabel('비밀번호',{exact:true}).fill('123456789012');
 await page.getByRole('button',{name:'로그인',exact:true}).click();
 await expect(cards(page,'todo')).toHaveCount(1);
});
test('회원가입은 확인 메일 대기를 안내한다',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'로그아웃',exact:true}).click();
 await page.getByRole('button',{name:'회원가입',exact:true}).click();
 await page.getByLabel('이메일',{exact:true}).fill('new@example.com');
 await page.getByLabel('비밀번호',{exact:true}).fill('123456789012');
 await page.getByLabel('비밀번호 확인',{exact:true}).fill('123456789012');
 await page.getByRole('button',{name:'가입하기',exact:true}).click();
 await expect(page.locator('[data-auth-status]')).toContainText('확인 메일');
 await expect(page.locator('[data-board]')).toBeHidden();
});
test('저장 실패 시 초안을 유지하며 재시도할 수 있다',async({page})=>{
 await page.goto('/');await page.evaluate(()=>window.__failSave=true);
 await page.locator('[data-action=add]').first().click();
 await page.getByLabel('제목',{exact:true}).fill('실패 초안');
 await page.getByRole('button',{name:'저장',exact:true}).click();
 await expect(page.locator('[data-cloud-status]')).toContainText('저장');
 await expect(page.locator('[data-card-dialog]')).toBeVisible();
 await expect(cards(page,'todo')).toHaveCount(0);
 await page.evaluate(()=>window.__failSave=false);
 await page.getByRole('button',{name:'저장',exact:true}).click();
 await expect(cards(page,'todo')).toHaveCount(1);
});

test('잘못된 로그인과 OAuth 취소를 안내하고 보드를 노출하지 않는다',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'로그아웃',exact:true}).click();
 await page.getByLabel('이메일',{exact:true}).fill('member@example.com');
 await page.getByLabel('비밀번호',{exact:true}).fill('wrong');
 await page.getByRole('button',{name:'로그인',exact:true}).click();
 await expect(page.locator('[data-auth-status]')).toContainText('확인');
 await page.evaluate(()=>{window.__oauthFail=true;});
 await page.getByRole('button',{name:'Google로 계속'}).click();
 await expect(page.locator('[data-auth-status]')).toContainText('취소');
 await expect(page.locator('[data-workspace]')).toBeHidden();
});
test('두 OAuth 공급자와 확인 메일 재발송·비밀번호 복구를 제공한다',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'로그아웃',exact:true}).click();
 await page.getByRole('button',{name:'GitHub로 계속'}).click();
 await expect(page.locator('[data-workspace]')).toBeVisible();
 expect(await page.evaluate(()=>window.__provider)).toBe('github');
 await page.getByRole('button',{name:'로그아웃',exact:true}).click();
 await page.getByRole('button',{name:'Google로 계속'}).click();
 await expect(page.locator('[data-workspace]')).toBeVisible();
 expect(await page.evaluate(()=>window.__provider)).toBe('google');
 await page.getByRole('button',{name:'로그아웃',exact:true}).click();
 await page.getByLabel('이메일',{exact:true}).fill('member@example.com');
 await page.getByRole('button',{name:'확인 메일 재발송'}).click();
 await expect(page.locator('[data-auth-status]')).toContainText('재요청');
 await page.getByRole('button',{name:'비밀번호 찾기',exact:true}).click();
 await page.getByRole('button',{name:'재설정 메일 보내기'}).click();
 await expect(page.locator('[data-auth-status]')).toContainText('재설정 메일');
 await page.evaluate(()=>window.__authEvent('PASSWORD_RECOVERY',{user:{id:'member',email:'member@example.com'}}));
 await expect(page.getByRole('heading',{name:'새 비밀번호 설정'})).toBeVisible();
 await expect(page.locator('[data-workspace]')).toBeHidden();
 await page.getByLabel('비밀번호',{exact:true}).fill('newpassword123');
 await page.getByLabel('비밀번호 확인',{exact:true}).fill('newpassword123');
 await page.getByRole('button',{name:'비밀번호 변경',exact:true}).click();
 await expect(page.getByRole('heading',{name:'로그인',exact:true})).toBeVisible();
});
test('계정 전환과 다른 브라우저 세션은 서버 데이터를 기준으로 동작한다',async({page,context})=>{
 await page.goto('/');await addCard(page,'todo','계정 A');
 const second=await context.newPage();await second.goto('/');
 await expect(cards(second,'todo')).toHaveCount(1);
 await second.close();
 await page.getByRole('button',{name:'로그아웃',exact:true}).click();
 await page.getByLabel('이메일',{exact:true}).fill('other@example.com');
 await page.getByLabel('비밀번호',{exact:true}).fill('123456789012');
 await page.getByRole('button',{name:'로그인',exact:true}).click();
 await expect(page.locator('[data-workspace]')).toBeVisible();
 await expect(cards(page,'todo')).toHaveCount(0);
 await expect(page.locator('body')).not.toContainText('계정 A');
});
test('기존 로컬 보드는 미리보기와 확인 후 가져오고 원본을 보존한다',async({page})=>{
 const original={version:1,cards:{old:{id:'old',title:'이전 카드',description:'',createdAt:'2026-11-12T00:00:00.000Z',updatedAt:'2026-11-12T00:00:00.000Z'}},columns:{todo:['old'],'in-progress':[],done:[]}};
 await page.addInitScript(data=>localStorage.setItem('kanban.board',JSON.stringify(data)),original);
 await page.goto('/');await expect(page.locator('[data-legacy]')).toBeVisible();
 await expect(cards(page,'todo')).toHaveCount(0);
 await expect(page.locator('[data-legacy-preview]')).toContainText('이전 카드');
 await page.getByRole('button',{name:'확인하고 가져오기'}).click();
 await expect(cards(page,'todo')).toHaveCount(1);
 await expect(page.locator('[data-legacy]')).toBeHidden();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('kanban.board')))).toEqual(original);
});
test('다른 탭의 저장과 충돌하면 초안을 보존하고 최신 보드를 읽는다',async({page,context})=>{
 await page.goto('/');
 const second=await context.newPage();await second.goto('/');
 await addCard(second,'todo','다른 탭의 카드');await second.close();
 // 자동 재조회가 없는 상태에서 이전 revision을 사용하도록 focus 이벤트 없이 저장한다.
 await page.evaluate(()=>{
   document.querySelector('[data-action=add]').click();
   document.querySelector('#card-title').value='충돌 초안';
   document.querySelector('[data-card-form]').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
 });
 await expect(page.locator('[data-draft]')).toBeVisible();
 await expect(page.locator('[data-cloud-status]')).toContainText('변경되었습니다');
 await expect(page.locator('[data-draft-text]')).toContainText('충돌 초안');
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'최신 보드 불러오기'}).click();
 await expect(cards(page,'todo')).toHaveCount(1);
 await expect(cards(page,'todo')).toContainText('다른 탭의 카드');
 await expect(page.locator('[data-draft-text]')).toContainText('충돌 초안');
});
