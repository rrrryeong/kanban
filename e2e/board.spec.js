// @ts-check
// E2E-01 — USER_FLOW §2 전체 흐름: 앱 열기, 복원, 새로고침 유지
const {
  test, expect, COLUMNS, LABELS, seedBoard, readBoard, column, cards, countBadge, cardIds, addCard,
} = require('./helpers');

test.describe('E2E-01 앱 열기와 복원', () => {
  test('빈 보드: 세 컬럼, 0개 배지, 빈 상태 안내', async ({ page }) => {
    await page.goto('/');
    for (const col of COLUMNS) {
      await expect(column(page, col).getByRole('heading', { level: 2 })).toHaveText(LABELS[col]);
      await expect(countBadge(page, col)).toHaveText('0');
      await expect(countBadge(page, col)).toHaveAttribute('aria-label', '카드 0개');
      await expect(column(page, col).getByText('카드를 여기로 끌어오세요')).toBeVisible();
      await expect(cards(page, col)).toHaveCount(0);
    }
  });

  test('저장된 보드를 순서대로 복원한다', async ({ page }) => {
    await seedBoard(page, { todo: ['a', 'b'], 'in-progress': ['c'], done: ['d', 'e', 'f'] });
    await page.goto('/');
    expect(await cardIds(page, 'todo')).toEqual(['a', 'b']);
    expect(await cardIds(page, 'in-progress')).toEqual(['c']);
    expect(await cardIds(page, 'done')).toEqual(['d', 'e', 'f']);
    await expect(countBadge(page, 'done')).toHaveText('3');
    await expect(cards(page, 'todo').first()).toContainText('카드 a');
    await expect(column(page, 'todo').getByText('카드를 여기로 끌어오세요')).toBeHidden();
  });

  test('카드를 추가하고 새로고침해도 유지된다', async ({ page }) => {
    await page.goto('/');
    await addCard(page, 'in-progress', '유지되는 카드', '새로고침 테스트');
    await page.reload();
    await expect(cards(page, 'in-progress')).toHaveCount(1);
    await expect(cards(page, 'in-progress').first()).toContainText('유지되는 카드');
    await expect(cards(page, 'in-progress').first()).toContainText('새로고침 테스트');
    const saved = await readBoard(page);
    expect(saved.columns['in-progress']).toHaveLength(1);
  });
});
