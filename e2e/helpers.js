// @ts-check
/* E2E 공통 헬퍼 (TRD §5.3, DATABASE_DESIGN §8). */
const base = require('@playwright/test');

const STORAGE_KEY = 'kanban.board';
const COLUMNS = ['todo', 'in-progress', 'done'];
const LABELS = { todo: 'To-Do', 'in-progress': 'In-Progress', done: 'Done' };

/**
 * 모든 테스트에서 Google Fonts 요청을 차단하는 test.
 * 네트워크 상태와 관계없이 같은 결과가 나오게 한다.
 */
const test = base.test.extend({
  page: async ({ page }, use) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
    await use(page);
  },
});
const { expect } = base;

/** { todo: ['a'] } 형태의 레이아웃을 DATABASE_DESIGN §3 스키마 JSON으로 만든다. */
function boardJson(layout) {
  const now = '2026-11-12T00:00:00.000Z';
  const board = { version: 1, cards: {}, columns: { todo: [], 'in-progress': [], done: [] } };
  Object.entries(layout).forEach(([col, ids]) => {
    ids.forEach((id) => {
      board.columns[col].push(id);
      board.cards[id] = { id, title: `카드 ${id}`, description: '', createdAt: now, updatedAt: now };
    });
  });
  return JSON.stringify(board);
}

/**
 * 페이지 스크립트보다 먼저 localStorage에 보드를 넣는다.
 * value는 레이아웃 객체 또는 그대로 넣을 문자열(손상 데이터 등)이다.
 * 새로고침 때 다시 덮어쓰지 않도록 탭당 한 번만 넣는다.
 */
async function seedBoard(page, value) {
  const text = typeof value === 'string' ? value : boardJson(value);
  await page.addInitScript(([key, data]) => {
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    localStorage.setItem(key, data);
  }, [STORAGE_KEY, text]);
}

/** 저장된 보드를 읽는다. 없으면 null. */
async function readBoard(page) {
  const text = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  return text ? JSON.parse(text) : null;
}

/** localStorage.setItem 호출 횟수를 세도록 계측한다(goto 전에 호출). */
async function countStorageWrites(page) {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    window.__writes = 0;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === 'kanban.board') window.__writes += 1;
      return original.call(this, key, value);
    };
  });
  return () => page.evaluate(() => window.__writes);
}

/** @param {import('@playwright/test').Page} page */
const column = (page, col) => page.locator(`.column[data-column="${col}"]`);
const cards = (page, col) => column(page, col).locator('.card');
const card = (page, id) => page.locator(`.card[data-card-id="${id}"]`);
const countBadge = (page, col) => column(page, col).locator('[data-count]');
const cardDialog = (page) => page.locator('[data-card-dialog]');
const confirmDialog = (page) => page.locator('[data-confirm-dialog]');
const menu = (page) => page.locator('[data-menu]');
const live = (page) => page.locator('[data-live]');
const titleField = (page) => page.getByLabel('제목', { exact: true });
const descField = (page) => page.getByLabel('설명 (선택)');

/** 컬럼의 카드 id 순서 */
async function cardIds(page, col) {
  return cards(page, col).evaluateAll((els) => els.map((el) => el.dataset.cardId));
}

/** locator의 중심 좌표 */
async function center(locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('요소가 화면에 없습니다');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** 마우스로 from 좌표에서 to 좌표로 끌어 놓는다. */
async function mouseDrag(page, from, to, { steps = 12, release = true } = {}) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 6, from.y + 6, { steps: 2 });
  await page.mouse.move(to.x, to.y, { steps });
  if (release) await page.mouse.up();
}

/**
 * Chromium CDP로 실제 터치 입력을 만들어 끈다.
 * 롱프레스 시간은 page.clock으로 흘려보낸다(page.clock.install()이 먼저 필요).
 */
async function touchDrag(page, from, to, { holdMs = 250, steps = 10, release = true } = {}) {
  const cdp = await page.context().newCDPSession(page);
  const point = (p) => [{ x: Math.round(p.x), y: Math.round(p.y), id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(from) });
  if (holdMs) await page.clock.runFor(holdMs);
  for (let i = 1; i <= steps; i += 1) {
    const p = { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps };
    // eslint-disable-next-line no-await-in-loop
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(p) });
  }
  if (release) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  return cdp;
}

/** 다이얼로그로 카드를 추가한다. */
async function addCard(page, col, title, description) {
  await column(page, col).getByRole('button', { name: '카드 추가' }).click();
  await titleField(page).fill(title);
  if (description !== undefined) await descField(page).fill(description);
  await page.getByRole('button', { name: '저장' }).click();
  await expect(cardDialog(page)).toBeHidden();
}

module.exports = {
  test,
  expect,
  STORAGE_KEY,
  COLUMNS,
  LABELS,
  boardJson,
  seedBoard,
  readBoard,
  countStorageWrites,
  column,
  cards,
  card,
  countBadge,
  cardDialog,
  confirmDialog,
  menu,
  live,
  titleField,
  descField,
  cardIds,
  center,
  mouseDrag,
  touchDrag,
  addCard,
};
