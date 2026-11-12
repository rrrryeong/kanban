// @ts-check
// E2E-09 — DESIGN_SYSTEM §6 반응형, §8 검증 기준
const {
  test, expect, COLUMNS, seedBoard, column, cardDialog,
} = require('./helpers');

async function columnBoxes(page) {
  return Promise.all(COLUMNS.map((col) => column(page, col).boundingBox()));
}

async function expectNoPageHorizontalScroll(page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

async function expectTouchTargets(page) {
  const targets = [
    page.getByRole('button', { name: '카드 메뉴: 카드 a' }),
    column(page, 'todo').getByRole('button', { name: '카드 추가' }),
  ];
  for (const t of targets) {
    const box = await t.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(40);
    expect(box.height).toBeGreaterThanOrEqual(40);
  }
}

const fab = (page) => page.getByRole('button', { name: 'To-Do에 카드 추가' });

test.describe('E2E-09 반응형 레이아웃', () => {
  test.beforeEach(async ({ page }) => {
    await seedBoard(page, { todo: ['a', 'b'], 'in-progress': ['c'], done: ['d'] });
  });

  test('Compact 360px: 컬럼을 세로로 쌓고, FAB가 보이고, 다이얼로그는 전체 화면', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/');
    const [a, b, c] = await columnBoxes(page);
    expect(Math.abs(a.x - b.x)).toBeLessThan(1);
    expect(Math.abs(b.x - c.x)).toBeLessThan(1);
    expect(b.y).toBeGreaterThan(a.y + a.height - 1);
    expect(c.y).toBeGreaterThan(b.y + b.height - 1);
    expect(a.x).toBeGreaterThanOrEqual(16 - 1); // 16px 거터
    await expect(fab(page)).toBeVisible();
    const fabBox = await fab(page).boundingBox();
    expect(fabBox.width).toBeGreaterThanOrEqual(56);

    await fab(page).click();
    await expect(cardDialog(page)).toBeVisible();
    // 열림 애니메이션(scale)이 끝난 뒤 크기를 잰다
    await cardDialog(page).evaluate((d) => Promise.all(d.getAnimations().map((a) => a.finished)));
    const dlg = await cardDialog(page).boundingBox();
    expect(Math.round(dlg.width)).toBe(360);
    await page.keyboard.press('Escape');

    await expectNoPageHorizontalScroll(page);
    await expectTouchTargets(page);
  });

  test('Medium 768px: 컬럼이 가로로 놓이고 보드 안에서만 가로 스크롤된다', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    const [a, b, c] = await columnBoxes(page);
    expect(Math.abs(a.y - b.y)).toBeLessThan(1);
    expect(Math.abs(b.y - c.y)).toBeLessThan(1);
    expect(b.x).toBeGreaterThan(a.x);
    const board = await page.locator('[data-board]').evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
    expect(board.sw).toBeGreaterThan(board.cw);
    await expect(fab(page)).toBeHidden();
    await expectNoPageHorizontalScroll(page);
    await expectTouchTargets(page);
  });

  test('Expanded 1280px: 같은 폭의 3열 그리드, 최대 1280px 가운데 정렬', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const [a, b, c] = await columnBoxes(page);
    expect(Math.abs(a.y - b.y)).toBeLessThan(1);
    expect(Math.abs(b.y - c.y)).toBeLessThan(1);
    expect(Math.abs(a.width - b.width)).toBeLessThan(1);
    expect(Math.abs(b.width - c.width)).toBeLessThan(1);
    expect(c.x).toBeGreaterThan(b.x);
    const boardBox = await page.locator('[data-board]').boundingBox();
    const vw = await page.evaluate(() => document.documentElement.clientWidth);
    expect(boardBox.width).toBeLessThanOrEqual(1280);
    expect(Math.abs(boardBox.x - (vw - (boardBox.x + boardBox.width)))).toBeLessThan(2);
    await expect(fab(page)).toBeHidden();
    await expectNoPageHorizontalScroll(page);
  });
});
