// @ts-check
// E2E-07 — USER_FLOW §3.6 키보드 메뉴 이동
const {
  test, expect, seedBoard, readBoard, card, menu, live, cardIds,
} = require('./helpers');

test.describe('E2E-07 키보드 메뉴 이동', () => {
  test('Tab → Enter → 화살표 → Enter로 다음 컬럼으로 옮긴다', async ({ page }) => {
    await seedBoard(page, { todo: ['a', 'b'] });
    await page.goto('/');
    const menuButton = page.getByRole('button', { name: '카드 메뉴: 카드 a' });

    await card(page, 'a').focus();
    await page.keyboard.press('Tab');
    await expect(menuButton).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(menu(page)).toBeVisible();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('menuitem', { name: '편집' })).toBeFocused();
    await expect(page.getByRole('menuitem', { name: '이전 컬럼으로 이동' })).toBeDisabled();

    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: '다음 컬럼으로 이동' })).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(menu(page)).toBeHidden();
    expect(await cardIds(page, 'todo')).toEqual(['b']);
    expect(await cardIds(page, 'in-progress')).toEqual(['a']);
    await expect(page.getByRole('button', { name: '카드 메뉴: 카드 a' })).toBeFocused();
    await expect(live(page)).toHaveText("'카드 a' 카드를 In-Progress(으)로 옮겼습니다.");
    expect((await readBoard(page)).columns['in-progress']).toEqual(['a']);
  });

  test('이전 컬럼으로 이동하고, 마지막 컬럼에서는 "다음"이 비활성화된다', async ({ page }) => {
    await seedBoard(page, { done: ['a'] });
    await page.goto('/');
    await page.getByRole('button', { name: '카드 메뉴: 카드 a' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: '다음 컬럼으로 이동' })).toBeDisabled();
    await expect(page.getByRole('menuitem', { name: '이전 컬럼으로 이동' })).toBeEnabled();

    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: '이전 컬럼으로 이동' })).toBeFocused();
    await page.keyboard.press('Enter');
    expect(await cardIds(page, 'in-progress')).toEqual(['a']);
  });

  test('Esc로 메뉴를 닫으면 ⋮ 버튼으로 포커스가 돌아온다', async ({ page }) => {
    await seedBoard(page, { todo: ['a'] });
    await page.goto('/');
    const menuButton = page.getByRole('button', { name: '카드 메뉴: 카드 a' });
    await menuButton.focus();
    await page.keyboard.press('Enter');
    await expect(menu(page)).toBeVisible();
    await page.keyboard.press('End');
    await expect(page.getByRole('menuitem', { name: '삭제' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu(page)).toBeHidden();
    await expect(menuButton).toBeFocused();
  });
});
