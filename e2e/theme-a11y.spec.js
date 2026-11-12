// @ts-check
// E2E-10 — DESIGN_SYSTEM §2 색상, §4 포커스·모션, §7 접근성
const {
  test, expect, seedBoard, card, column,
} = require('./helpers');

const bg = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe('E2E-10 테마와 접근성', () => {
  test('라이트/다크 모드에 따라 배경 색 토큰이 바뀐다', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    expect(await bg(page)).toBe('rgb(254, 247, 255)');
    await page.emulateMedia({ colorScheme: 'dark' });
    expect(await bg(page)).toBe('rgb(20, 18, 24)');
  });

  test('키보드 포커스에는 3px solid 포커스 링이 보인다', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const focused = column(page, 'todo').getByRole('button', { name: '카드 추가' });
    await expect(focused).toBeFocused();
    await expect(focused).toHaveCSS('outline-style', 'solid');
    await expect(focused).toHaveCSS('outline-width', '3px');
  });

  test('모션 줄이기 설정이면 전환 시간이 0이다', async ({ page }) => {
    await seedBoard(page, { todo: ['a'] });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const duration = await card(page, 'a').evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(duration).toMatch(/^0s(, 0s)*$/);
  });

  test('컬럼별 카드 액센트 색', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await seedBoard(page, { todo: ['a'], 'in-progress': ['b'], done: ['c'] });
    await page.goto('/');
    await expect(card(page, 'a')).toHaveCSS('border-left-color', 'rgb(125, 82, 96)');
    await expect(card(page, 'b')).toHaveCSS('border-left-color', 'rgb(103, 80, 164)');
    await expect(card(page, 'c')).toHaveCSS('border-left-color', 'rgb(56, 106, 32)');
  });

  test('카운트 배지와 아이콘 버튼에 접근 가능한 이름이 있다', async ({ page }) => {
    await seedBoard(page, { todo: ['a', 'b', 'c'] });
    await page.goto('/');
    await expect(column(page, 'todo').locator('[data-count]')).toHaveAttribute('aria-label', '카드 3개');
    await expect(page.getByRole('button', { name: '카드 메뉴: 카드 a' })).toHaveAttribute('aria-haspopup', 'menu');
  });
});
