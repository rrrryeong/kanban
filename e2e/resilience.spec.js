// @ts-check
// E2E-08 — USER_FLOW §4 예외 흐름
const {
  test, expect, COLUMNS, seedBoard, readBoard, countStorageWrites, column, cards, card, countBadge, cardIds, center, mouseDrag, addCard,
} = require('./helpers');

test.describe('E2E-08 예외 흐름', () => {
  test('손상된 서버 데이터는 빈 보드로 덮어쓰지 않고 조회 오류를 표시한다', async ({ page }) => {
    await seedBoard(page, '{"version":1,"cards":');
    await page.goto('/');
    await expect(page.locator('[data-cloud-status]')).toContainText('조회 실패');
    await expect(page.locator('[data-workspace]')).toBeHidden();
  });

  test('서버 조회가 실패하면 재시도로 복구한다', async ({ page }) => {
    await page.addInitScript(()=>{window.__failLoad=true;});
    await page.goto('/');
    await expect(page.locator('[data-cloud-status]')).toContainText('조회 실패');
    await page.evaluate(()=>{window.__failLoad=false;});
    await page.getByRole('button',{name:'최신 보드 불러오기'}).click();
    await expect(page.locator('[data-workspace]')).toBeVisible();
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
