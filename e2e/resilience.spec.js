// @ts-check
// E2E-08 — USER_FLOW §4 예외 흐름
const {
  test, expect, COLUMNS, seedBoard, readBoard, countStorageWrites, column, cards, card, countBadge, cardIds, center, mouseDrag, addCard,
} = require('./helpers');

test.describe('E2E-08 예외 흐름', () => {
  test('손상된 저장 데이터면 빈 보드로 시작하고, 다음 저장 때 덮어쓴다', async ({ page }) => {
    await seedBoard(page, '{"version":1,"cards":');
    await page.goto('/');
    for (const col of COLUMNS) await expect(countBadge(page, col)).toHaveText('0');
    await addCard(page, 'todo', '복구 후 첫 카드');
    const saved = await readBoard(page);
    expect(saved.version).toBe(1);
    expect(saved.columns.todo).toHaveLength(1);
  });

  test('localStorage 쓰기가 실패해도 화면은 동작한다(새로고침하면 사라짐)', async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = function setItem() {
        throw new DOMException('quota', 'QuotaExceededError');
      };
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e));
    await page.goto('/');
    await addCard(page, 'todo', '메모리 카드');
    await expect(cards(page, 'todo')).toHaveCount(1);
    await page.reload();
    await expect(cards(page, 'todo')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('같은 자리에 놓으면 저장하지 않는다', async ({ page }) => {
    await seedBoard(page, { todo: ['a', 'b'] });
    const writes = await countStorageWrites(page);
    await page.goto('/');
    const from = await center(card(page, 'a'));
    const box = await card(page, 'a').boundingBox();
    await mouseDrag(page, from, { x: from.x, y: box.y + 4 });
    expect(await cardIds(page, 'todo')).toEqual(['a', 'b']);
    expect(await writes()).toBe(0);
  });

  test('XSS 문자열은 텍스트로만 표시된다', async ({ page }) => {
    let dialogOpened = false;
    page.on('dialog', async (d) => { dialogOpened = true; await d.dismiss(); });
    await page.goto('/');
    await addCard(page, 'todo', '<img src=x onerror=alert(1)>');
    await expect(cards(page, 'todo').first()).toContainText('<img src=x onerror=alert(1)>');
    await expect(column(page, 'todo').locator('img')).toHaveCount(0);
    expect(dialogOpened).toBe(false);
  });
});
