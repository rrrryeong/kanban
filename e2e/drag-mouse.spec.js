// @ts-check
// E2E-05 — USER_FLOW §3.4 마우스 드래그
const {
  test, expect, seedBoard, readBoard, countStorageWrites, column, card, countBadge, cardDialog, live, cardIds, center, mouseDrag,
} = require('./helpers');

/** 컬럼의 카드 목록 영역에서 idx번째 카드 위/아래 경계 근처 좌표 */
async function slot(page, col, where) {
  const list = column(page, col).locator('[data-list]');
  const box = await list.boundingBox();
  const x = box.x + box.width / 2;
  const items = column(page, col).locator('.card');
  const n = await items.count();
  if (where === 'top' || n === 0) return { x, y: box.y + 8 };
  if (where === 'end') {
    const last = await items.nth(n - 1).boundingBox();
    return { x, y: last.y + last.height + 4 };
  }
  // where: 숫자 i → i-1번째와 i번째 카드 사이
  const prev = await items.nth(where - 1).boundingBox();
  return { x, y: prev.y + prev.height - 4 };
}

test.describe('E2E-05 마우스 드래그', () => {
  test('다른 컬럼의 끝으로 옮기면 저장되고 알림이 나온다', async ({ page }) => {
    await seedBoard(page, { todo: ['a', 'b'], 'in-progress': ['c'] });
    await page.goto('/');
    await mouseDrag(page, await center(card(page, 'a')), await slot(page, 'in-progress', 'end'));
    expect(await cardIds(page, 'todo')).toEqual(['b']);
    expect(await cardIds(page, 'in-progress')).toEqual(['c', 'a']);
    await expect(countBadge(page, 'in-progress')).toHaveText('2');
    await expect(live(page)).toHaveText("'카드 a' 카드를 In-Progress(으)로 옮겼습니다.");
    expect((await readBoard(page)).columns['in-progress']).toEqual(['c', 'a']);
    await expect(cardDialog(page)).toBeHidden(); // 드래그 뒤 편집이 열리지 않는다
  });

  test('다른 컬럼의 맨 앞과 카드 사이에 놓는다', async ({ page }) => {
    await seedBoard(page, { todo: ['a', 'b'], done: ['x', 'y'] });
    await page.goto('/');
    await mouseDrag(page, await center(card(page, 'a')), await slot(page, 'done', 'top'));
    expect(await cardIds(page, 'done')).toEqual(['a', 'x', 'y']);
    await mouseDrag(page, await center(card(page, 'b')), await slot(page, 'done', 2));
    expect(await cardIds(page, 'done')).toEqual(['a', 'x', 'b', 'y']);
  });

  test('빈 컬럼으로 옮긴다', async ({ page }) => {
    await seedBoard(page, { todo: ['a'] });
    await page.goto('/');
    await mouseDrag(page, await center(card(page, 'a')), await slot(page, 'done', 'top'));
    expect(await cardIds(page, 'todo')).toEqual([]);
    expect(await cardIds(page, 'done')).toEqual(['a']);
    await expect(column(page, 'todo').getByText('카드를 여기로 끌어오세요')).toBeVisible();
  });

  test('같은 컬럼 안에서 순서를 바꾼다', async ({ page }) => {
    await seedBoard(page, { todo: ['a', 'b', 'c'] });
    await page.goto('/');
    await mouseDrag(page, await center(card(page, 'a')), await slot(page, 'todo', 'end'));
    expect(await cardIds(page, 'todo')).toEqual(['b', 'c', 'a']);
    await mouseDrag(page, await center(card(page, 'a')), await slot(page, 'todo', 'top'));
    expect(await cardIds(page, 'todo')).toEqual(['a', 'b', 'c']);
  });

  test('드래그 중에는 고스트·플레이스홀더·드롭 하이라이트가 보이고, 놓으면 사라진다', async ({ page }) => {
    await seedBoard(page, { todo: ['a'] });
    await page.goto('/');
    await mouseDrag(page, await center(card(page, 'a')), await slot(page, 'done', 'top'), { release: false });
    await expect(page.locator('.card--ghost')).toBeVisible();
    await expect(column(page, 'done').locator('.card-placeholder')).toBeVisible();
    await expect(column(page, 'done')).toHaveClass(/column--drop-target/);
    await expect(card(page, 'a').and(page.locator('.column .card'))).toBeHidden();
    await page.mouse.up();
    await expect(page.locator('.card--ghost')).toHaveCount(0);
    await expect(page.locator('.card-placeholder')).toHaveCount(0);
    await expect(page.locator('.column--drop-target')).toHaveCount(0);
  });

  test('Esc를 누르면 원위치된다', async ({ page }) => {
    await seedBoard(page, { todo: ['a'] });
    await page.goto('/');
    const writes = await countStorageWrites(page);
    await page.reload();
    await mouseDrag(page, await center(card(page, 'a')), await slot(page, 'done', 'top'), { release: false });
    await page.keyboard.press('Escape');
    await expect(page.locator('.card--ghost')).toHaveCount(0);
    await page.mouse.up();
    expect(await cardIds(page, 'todo')).toEqual(['a']);
    expect(await cardIds(page, 'done')).toEqual([]);
    expect(await writes()).toBe(0);
  });

  test('보드 밖(앱 바)에 놓으면 원위치된다', async ({ page }) => {
    await seedBoard(page, { todo: ['a'] });
    await page.goto('/');
    const bar = await page.locator('[data-app-bar]').boundingBox();
    await mouseDrag(page, await center(card(page, 'a')), { x: bar.x + bar.width - 20, y: bar.y + bar.height / 2 + 4 });
    expect(await cardIds(page, 'todo')).toEqual(['a']);
    await expect(card(page, 'a')).toBeVisible();
  });
});
