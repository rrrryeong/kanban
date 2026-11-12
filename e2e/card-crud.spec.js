// @ts-check
// E2E-02 ~ E2E-04 — USER_FLOW §3.1 추가, §3.2 편집, §3.3 삭제
const {
  test, expect, seedBoard, readBoard, column, cards, card, countBadge, cardDialog, confirmDialog, menu, live, cardIds, addCard, titleField, descField,
} = require('./helpers');

test.describe('E2E-02 카드 추가', () => {
  test('컬럼 버튼으로 열고 Enter로 저장하면 맨 아래에 추가된다', async ({ page }) => {
    await seedBoard(page, { todo: ['a'] });
    await page.goto('/');
    await column(page, 'todo').getByRole('button', { name: '카드 추가' }).click();
    await expect(cardDialog(page)).toBeVisible();
    await expect(page.getByRole('heading', { name: '새 카드 — To-Do' })).toBeVisible();
    await expect(titleField(page)).toBeFocused();

    await titleField(page).fill('  새 작업  ');
    await expect(page.locator('[data-counter="title"]')).toHaveText('8/100');
    await titleField(page).press('Enter');

    await expect(cardDialog(page)).toBeHidden();
    await expect(cards(page, 'todo')).toHaveCount(2);
    await expect(cards(page, 'todo').last()).toContainText('새 작업');
    await expect(cards(page, 'todo').last()).toBeFocused();
    await expect(countBadge(page, 'todo')).toHaveText('2');
    await expect(live(page)).toHaveText("'새 작업' 카드를 To-Do에 추가했습니다.");
    const saved = await readBoard(page);
    expect(saved.columns.todo).toHaveLength(2);
    expect(saved.cards[saved.columns.todo[1]].title).toBe('새 작업');
  });

  test('빈 제목은 오류를 보이고 다이얼로그가 유지된다', async ({ page }) => {
    await page.goto('/');
    await column(page, 'done').getByRole('button', { name: '카드 추가' }).click();
    await titleField(page).fill('   ');
    await page.getByRole('button', { name: '저장' }).click();
    await expect(cardDialog(page)).toBeVisible();
    await expect(page.getByText('제목을 입력해 주세요.')).toBeVisible();
    await expect(titleField(page)).toHaveAttribute('aria-invalid', 'true');

    await titleField(page).fill('이제 저장');
    await page.getByRole('button', { name: '저장' }).click();
    await expect(cardDialog(page)).toBeHidden();
    await expect(cards(page, 'done')).toHaveCount(1);
  });

  test('취소 버튼과 Esc로 닫으면 아무것도 바뀌지 않는다', async ({ page }) => {
    await page.goto('/');
    const add = column(page, 'todo').getByRole('button', { name: '카드 추가' });

    await add.click();
    await titleField(page).fill('버릴 내용');
    await page.getByRole('button', { name: '취소' }).click();
    await expect(cardDialog(page)).toBeHidden();
    await expect(add).toBeFocused();

    await add.click();
    await expect(titleField(page)).toHaveValue('');
    await page.keyboard.press('Escape');
    await expect(cardDialog(page)).toBeHidden();

    await expect(cards(page, 'todo')).toHaveCount(0);
    expect(await readBoard(page)).toBeNull();
  });

  test('배경을 클릭하면 닫힌다 (데스크톱)', async ({ page, isMobile }) => {
    test.skip(isMobile, '모바일은 전체 화면 다이얼로그라 배경이 없다');
    await page.goto('/');
    await column(page, 'todo').getByRole('button', { name: '카드 추가' }).click();
    await expect(cardDialog(page)).toBeVisible();
    await page.mouse.click(5, 400);
    await expect(cardDialog(page)).toBeHidden();
    await expect(cards(page, 'todo')).toHaveCount(0);
  });

  test('모바일 FAB는 To-Do에 카드를 추가한다', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'FAB는 Compact 구간에서만 보인다');
    await page.goto('/');
    await page.getByRole('button', { name: 'To-Do에 카드 추가' }).click();
    await titleField(page).fill('FAB로 추가');
    await page.getByRole('button', { name: '저장' }).click();
    await expect(cards(page, 'todo')).toHaveCount(1);
    await expect(cards(page, 'todo').first()).toContainText('FAB로 추가');
  });
});

test.describe('E2E-03 카드 편집', () => {
  test('카드를 클릭하면 기존 값이 채워지고, 저장하면 위치는 그대로 내용만 바뀐다', async ({ page }) => {
    await seedBoard(page, { todo: ['a', 'b', 'c'] });
    await page.goto('/');
    await card(page, 'b').click();
    await expect(page.getByRole('heading', { name: '카드 편집' })).toBeVisible();
    await expect(titleField(page)).toHaveValue('카드 b');

    await titleField(page).fill('고친 제목');
    await descField(page).fill('고친 설명');
    await page.getByRole('button', { name: '저장' }).click();

    await expect(cardDialog(page)).toBeHidden();
    expect(await cardIds(page, 'todo')).toEqual(['a', 'b', 'c']);
    await expect(card(page, 'b')).toContainText('고친 제목');
    await expect(card(page, 'b')).toContainText('고친 설명');
    await expect(live(page)).toHaveText("'고친 제목' 카드를 수정했습니다.");
    const saved = await readBoard(page);
    expect(saved.cards.b).toMatchObject({ title: '고친 제목', description: '고친 설명' });
  });

  test('포커스한 카드에서 Enter로 편집을 연다', async ({ page }) => {
    await seedBoard(page, { done: ['a'] });
    await page.goto('/');
    await card(page, 'a').focus();
    await page.keyboard.press('Enter');
    await expect(cardDialog(page)).toBeVisible();
    await expect(titleField(page)).toHaveValue('카드 a');
  });
});

test.describe('E2E-04 카드 삭제', () => {
  test('메뉴 → 삭제 → 확인하면 사라진다', async ({ page }) => {
    await seedBoard(page, { todo: ['a', 'b'] });
    await page.goto('/');
    await page.getByRole('button', { name: '카드 메뉴: 카드 a' }).click();
    await expect(menu(page)).toBeVisible();
    await page.getByRole('menuitem', { name: '삭제' }).click();
    await expect(confirmDialog(page)).toBeVisible();
    await expect(confirmDialog(page)).toContainText("'카드 a' 카드를 삭제할까요?");

    await confirmDialog(page).getByRole('button', { name: '삭제' }).click();
    await expect(confirmDialog(page)).toBeHidden();
    expect(await cardIds(page, 'todo')).toEqual(['b']);
    await expect(countBadge(page, 'todo')).toHaveText('1');
    await expect(live(page)).toHaveText("'카드 a' 카드를 삭제했습니다.");
    expect((await readBoard(page)).cards.a).toBeUndefined();
  });

  test('취소하면 삭제하지 않는다', async ({ page }) => {
    await seedBoard(page, { todo: ['a'] });
    await page.goto('/');
    await page.getByRole('button', { name: '카드 메뉴: 카드 a' }).click();
    await page.getByRole('menuitem', { name: '삭제' }).click();
    await confirmDialog(page).getByRole('button', { name: '취소' }).click();
    await expect(confirmDialog(page)).toBeHidden();
    expect(await cardIds(page, 'todo')).toEqual(['a']);
  });
});

test('추가한 카드는 이후 흐름에도 쓸 수 있다 (추가 → 편집 → 삭제)', async ({ page }) => {
  await page.goto('/');
  await addCard(page, 'todo', '한 바퀴');
  const created = cards(page, 'todo').first();
  await created.click();
  await titleField(page).fill('한 바퀴 수정');
  await page.getByRole('button', { name: '저장' }).click();
  await page.getByRole('button', { name: '카드 메뉴: 한 바퀴 수정' }).click();
  await page.getByRole('menuitem', { name: '삭제' }).click();
  await confirmDialog(page).getByRole('button', { name: '삭제' }).click();
  await expect(cards(page, 'todo')).toHaveCount(0);
});
