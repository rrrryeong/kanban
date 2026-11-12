// @ts-check
// E2E-06 — USER_FLOW §3.5 터치 드래그 (mobile 프로젝트)
const {
  test, expect, seedBoard, readBoard, column, card, cardDialog, cardIds, center, touchDrag, titleField,
} = require('./helpers');

async function listCenter(page, col) {
  return center(column(page, col).locator('[data-list]'));
}

test.describe('E2E-06 터치 드래그', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install();
    await seedBoard(page, { todo: ['a'], 'in-progress': ['b'] });
    await page.goto('/');
  });

  test('길게 누른 뒤 끌면 다른 컬럼으로 옮겨진다', async ({ page }) => {
    await touchDrag(page, await center(card(page, 'a')), await listCenter(page, 'done'), { holdMs: 250 });
    expect(await cardIds(page, 'todo')).toEqual([]);
    expect(await cardIds(page, 'done')).toEqual(['a']);
    expect((await readBoard(page)).columns.done).toEqual(['a']);
    await expect(cardDialog(page)).toBeHidden();
  });

  test('드래그 중에는 고스트가 손가락을 따라오고, 놓으면 정리된다', async ({ page }) => {
    const cdp = await touchDrag(page, await center(card(page, 'a')), await listCenter(page, 'done'), { release: false });
    await expect(page.locator('.card--ghost')).toBeVisible();
    await expect(column(page, 'done').locator('.card-placeholder')).toBeVisible();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('.card--ghost')).toHaveCount(0);
    expect(await cardIds(page, 'done')).toEqual(['a']);
  });

  test('롱프레스 전에 움직이면 드래그되지 않는다(스크롤로 처리)', async ({ page }) => {
    await touchDrag(page, await center(card(page, 'a')), await listCenter(page, 'done'), { holdMs: 0 });
    await page.clock.runFor(500);
    await expect(page.locator('.card--ghost')).toHaveCount(0);
    expect(await cardIds(page, 'todo')).toEqual(['a']);
    expect(await cardIds(page, 'done')).toEqual([]);
  });

  test('짧게 탭하면 편집 다이얼로그가 열린다', async ({ page }) => {
    await card(page, 'b').tap();
    await expect(cardDialog(page)).toBeVisible();
    await expect(titleField(page)).toHaveValue('카드 b');
  });
});
