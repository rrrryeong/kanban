/**
 * @jest-environment jsdom
 */
const fs = require('fs');
const path = require('path');
const Board = require('../board.js');
const { initApp, getDropIndex, STORAGE_KEY } = require('../app.js');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const bodyHtml = html.match(/<body>([\s\S]*)<\/body>/)[1];

// jsdom에는 PointerEvent가 없을 수 있으므로 MouseEvent 기반으로 흉내 낸다.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type, init = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }
  window.PointerEvent = PointerEventPolyfill;
}

function createMemoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: jest.fn((k) => (data.has(k) ? data.get(k) : null)),
    setItem: jest.fn((k, v) => { data.set(k, String(v)); }),
    removeItem: jest.fn((k) => { data.delete(k); }),
  };
}

/** { todo: ['a','b'] } 형태로 저장된 보드 문자열을 만든다. */
function storedBoard(layout) {
  let board = Board.createBoard();
  Object.entries(layout).forEach(([col, ids]) => {
    ids.forEach((id) => { board = Board.addCard(board, col, { title: `카드 ${id}` }, { id }); });
  });
  return Board.serialize(board);
}

let app;
let storage;

function start({ layout, storage: customStorage } = {}) {
  document.body.innerHTML = bodyHtml;
  storage = customStorage || createMemoryStorage(layout ? { [STORAGE_KEY]: storedBoard(layout) } : {});
  app = initApp({ root: document, storage });
  return app;
}

afterEach(() => {
  if (app) app.destroy();
  app = null;
  jest.useRealTimers();
  jest.restoreAllMocks();
  delete document.elementFromPoint;
});

const $ = (sel, scope = document) => scope.querySelector(sel);
const $$ = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));
const column = (col) => $(`.column[data-column="${col}"]`);
const cardIds = (col) => $$('.card', column(col)).map((el) => el.dataset.cardId);
const card = (id) => $(`.card[data-card-id="${id}"]`);
const count = (col) => $('[data-count]', column(col)).textContent;
const cardDialog = () => $('[data-card-dialog]');
const confirmDialog = () => $('[data-confirm-dialog]');
const isOpen = (dialog) => dialog.hasAttribute('open');
const menu = () => $('[data-menu]');
const live = () => $('[data-live]').textContent;

function click(el) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function key(el, k) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
}

function fillAndSubmit({ title, description }) {
  if (title !== undefined) {
    $('#card-title').value = title;
    $('#card-title').dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (description !== undefined) {
    $('#card-description').value = description;
    $('#card-description').dispatchEvent(new Event('input', { bubbles: true }));
  }
  $('[data-card-form]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

function openMenuFor(id) {
  click($('[data-action="menu"]', card(id)));
}

function clickMenu(action) {
  click($(`[data-menu-action="${action}"]`));
}

describe('getDropIndex', () => {
  const rects = [{ top: 0, height: 50 }, { top: 60, height: 50 }, { top: 120, height: 50 }];

  test.each([
    [-10, 0],
    [10, 0],
    [25, 1],
    [84, 1],
    [85, 2],
    [144, 2],
    [145, 3],
    [500, 3],
  ])('y=%p → %p', (y, expected) => {
    expect(getDropIndex(rects, y)).toBe(expected);
  });

  test('카드가 없으면 0', () => {
    expect(getDropIndex([], 100)).toBe(0);
  });
});

describe('초기 렌더링과 저장', () => {
  test('빈 보드: 세 컬럼과 0개 배지', () => {
    start();
    expect($$('.column').map((el) => el.dataset.column)).toEqual(['todo', 'in-progress', 'done']);
    expect($$('.column__title').map((el) => el.textContent)).toEqual(['To-Do', 'In-Progress', 'Done']);
    ['todo', 'in-progress', 'done'].forEach((col) => {
      expect(count(col)).toBe('0');
      expect($('[data-count]', column(col)).getAttribute('aria-label')).toBe('카드 0개');
    });
    expect($$('.card')).toHaveLength(0);
  });

  test('저장된 보드를 복원해 순서대로 그린다', () => {
    start({ layout: { todo: ['a', 'b'], done: ['c'] } });
    expect(cardIds('todo')).toEqual(['a', 'b']);
    expect(cardIds('done')).toEqual(['c']);
    expect(count('todo')).toBe('2');
    expect($('.card__title', card('a')).textContent).toBe('카드 a');
    expect(card('a').dataset.column).toBe('todo');
  });

  test('손상된 저장 데이터는 빈 보드로 시작한다', () => {
    start({ storage: createMemoryStorage({ [STORAGE_KEY]: '{broken' }) });
    expect($$('.card')).toHaveLength(0);
  });

  test('storage.getItem이 예외를 던져도 빈 보드로 시작한다', () => {
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: jest.fn() };
    start({ storage: broken });
    expect($$('.card')).toHaveLength(0);
  });

  test('storage가 없어도(null) 메모리로 동작한다', () => {
    document.body.innerHTML = bodyHtml;
    app = initApp({ root: document, storage: null });
    click($('[data-action="add"][data-column="todo"]'));
    fillAndSubmit({ title: '메모리' });
    expect(cardIds('todo')).toHaveLength(1);
  });

  test('기본 storage는 window.localStorage', () => {
    window.localStorage.clear();
    document.body.innerHTML = bodyHtml;
    app = initApp();
    click($('[data-action="add"][data-column="done"]'));
    fillAndSubmit({ title: '로컬' });
    const saved = Board.deserialize(window.localStorage.getItem(STORAGE_KEY));
    expect(saved.columns.done).toHaveLength(1);
    window.localStorage.clear();
  });

  test('재초기화(새로고침) 후에도 카드가 유지된다', () => {
    start();
    click($('[data-action="add"][data-column="in-progress"]'));
    fillAndSubmit({ title: '유지되는 카드', description: '설명' });
    app.destroy();

    document.body.innerHTML = bodyHtml;
    app = initApp({ root: document, storage });
    const [id] = cardIds('in-progress');
    expect($('.card__title', card(id)).textContent).toBe('유지되는 카드');
    expect($('.card__desc', card(id)).textContent).toBe('설명');
  });

  test('storage.setItem이 예외를 던져도 화면은 동작한다', () => {
    const quota = createMemoryStorage();
    quota.setItem.mockImplementation(() => { throw new Error('QuotaExceededError'); });
    start({ storage: quota });
    click($('[data-action="add"][data-column="todo"]'));
    fillAndSubmit({ title: '저장 실패해도 표시' });
    expect(cardIds('todo')).toHaveLength(1);
    expect(isOpen(cardDialog())).toBe(false);
  });
});

describe('카드 추가', () => {
  test('컬럼의 추가 버튼으로 다이얼로그를 열고 맨 아래에 추가한다', () => {
    start({ layout: { todo: ['a'] } });
    click($('[data-action="add"][data-column="todo"]'));
    expect(isOpen(cardDialog())).toBe(true);
    expect($('[data-dialog-title]').textContent).toBe('새 카드 — To-Do');
    expect(document.activeElement).toBe($('#card-title'));

    fillAndSubmit({ title: '  새 작업  ', description: '내용' });

    expect(isOpen(cardDialog())).toBe(false);
    const ids = cardIds('todo');
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe('a');
    const added = card(ids[1]);
    expect($('.card__title', added).textContent).toBe('새 작업');
    expect(count('todo')).toBe('2');
    expect(document.activeElement).toBe(added);
    expect(live()).toBe("'새 작업' 카드를 To-Do에 추가했습니다.");

    const saved = Board.deserialize(storage.setItem.mock.calls.at(-1)[1]);
    expect(saved.columns.todo).toEqual(ids);
  });

  test('FAB는 To-Do에 카드를 추가한다', () => {
    start();
    click($('.fab'));
    fillAndSubmit({ title: 'FAB' });
    expect(cardIds('todo')).toHaveLength(1);
  });

  test('빈 제목은 오류를 보여 주고 다이얼로그를 유지한다', () => {
    start();
    click($('[data-action="add"][data-column="done"]'));
    fillAndSubmit({ title: '   ' });
    expect(isOpen(cardDialog())).toBe(true);
    expect($('[data-error="title"]').textContent).toBe('제목을 입력해 주세요.');
    expect($('[data-field="title"]').classList.contains('text-field--error')).toBe(true);
    expect($('#card-title').getAttribute('aria-invalid')).toBe('true');
    expect(storage.setItem).not.toHaveBeenCalled();

    fillAndSubmit({ title: '이제 됨' });
    expect(isOpen(cardDialog())).toBe(false);
    expect(cardIds('done')).toHaveLength(1);
  });

  test('너무 긴 제목·설명은 각 필드에 오류를 보여 준다', () => {
    start();
    click($('[data-action="add"][data-column="todo"]'));
    fillAndSubmit({ title: 'a'.repeat(101) });
    expect($('[data-error="title"]').textContent).toBe('제목은 100자 이하로 입력해 주세요.');

    fillAndSubmit({ title: 'ok', description: 'b'.repeat(1001) });
    expect($('[data-error="title"]').textContent).toBe('');
    expect($('[data-error="description"]').textContent).toBe('설명은 1000자 이하로 입력해 주세요.');
    expect(document.activeElement).toBe($('#card-description'));
  });

  test('글자 수 카운터가 입력에 따라 바뀐다', () => {
    start();
    click($('[data-action="add"][data-column="todo"]'));
    expect($('[data-counter="title"]').textContent).toBe('0/100');
    $('#card-title').value = 'hello';
    $('#card-title').dispatchEvent(new Event('input', { bubbles: true }));
    expect($('[data-counter="title"]').textContent).toBe('5/100');
    $('#card-description').value = 'abc';
    $('#card-description').dispatchEvent(new Event('input', { bubbles: true }));
    expect($('[data-counter="description"]').textContent).toBe('3/1000');
  });

  test('취소 버튼, Esc, 배경 클릭으로 닫으면 아무것도 바뀌지 않는다', () => {
    start();
    const addBtn = $('[data-action="add"][data-column="todo"]');

    addBtn.focus();
    click(addBtn);
    $('#card-title').value = '버릴 내용';
    click($('[data-action="cancel"]', cardDialog()));
    expect(isOpen(cardDialog())).toBe(false);
    expect(document.activeElement).toBe(addBtn);

    click(addBtn);
    expect($('#card-title').value).toBe('');
    key($('#card-title'), 'Escape');
    expect(isOpen(cardDialog())).toBe(false);

    click(addBtn);
    click(cardDialog());
    expect(isOpen(cardDialog())).toBe(false);

    click(addBtn);
    cardDialog().dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(isOpen(cardDialog())).toBe(false);

    expect($$('.card')).toHaveLength(0);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  test('사용자 입력은 HTML이 아니라 텍스트로 표시된다 (XSS 방지)', () => {
    start();
    click($('[data-action="add"][data-column="todo"]'));
    const evil = '<img src=x onerror="window.__xss=1">';
    fillAndSubmit({ title: evil, description: '<script>alert(1)</script>' });
    const [id] = cardIds('todo');
    expect($('.card__title', card(id)).textContent).toBe(evil);
    expect($('img', column('todo'))).toBeNull();
    expect($('script', column('todo'))).toBeNull();
    expect(window.__xss).toBeUndefined();
  });
});

describe('카드 편집', () => {
  test('카드를 클릭하면 기존 값으로 편집 다이얼로그가 열린다', () => {
    start({ layout: { todo: ['a'] } });
    click($('.card__title', card('a')));
    expect(isOpen(cardDialog())).toBe(true);
    expect($('[data-dialog-title]').textContent).toBe('카드 편집');
    expect($('#card-title').value).toBe('카드 a');

    fillAndSubmit({ title: '고친 제목', description: '고친 설명' });
    expect(cardIds('todo')).toEqual(['a']);
    expect($('.card__title', card('a')).textContent).toBe('고친 제목');
    expect($('.card__desc', card('a')).textContent).toBe('고친 설명');
    expect(live()).toBe("'고친 제목' 카드를 수정했습니다.");
  });

  test('카드에 포커스하고 Enter를 누르면 편집 다이얼로그가 열린다', () => {
    start({ layout: { done: ['a'] } });
    card('a').focus();
    key(card('a'), 'Enter');
    expect(isOpen(cardDialog())).toBe(true);
    expect($('#card-title').value).toBe('카드 a');
  });

  test('내용을 바꾸지 않고 저장하면 저장소를 쓰지 않는다', () => {
    start({ layout: { todo: ['a'] } });
    click(card('a'));
    fillAndSubmit({});
    expect(isOpen(cardDialog())).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  test('메뉴의 편집으로도 열 수 있다', () => {
    start({ layout: { todo: ['a'] } });
    openMenuFor('a');
    clickMenu('edit');
    expect(menu().hidden).toBe(true);
    expect(isOpen(cardDialog())).toBe(true);
    expect($('#card-title').value).toBe('카드 a');
  });
});

describe('카드 메뉴', () => {
  test('⋮ 버튼으로 메뉴를 열고, 경계 컬럼에서는 이동 항목을 비활성화한다', () => {
    start({ layout: { todo: ['a'], 'in-progress': ['b'], done: ['c'] } });

    openMenuFor('a');
    expect(menu().hidden).toBe(false);
    expect($('[data-action="menu"]', card('a')).getAttribute('aria-expanded')).toBe('true');
    expect($('[data-menu-action="prev"]').disabled).toBe(true);
    expect($('[data-menu-action="next"]').disabled).toBe(false);
    expect(document.activeElement).toBe($('[data-menu-action="edit"]'));

    openMenuFor('a'); // 같은 버튼을 다시 누르면 닫힌다
    expect(menu().hidden).toBe(true);

    openMenuFor('b');
    expect($('[data-menu-action="prev"]').disabled).toBe(false);
    expect($('[data-menu-action="next"]').disabled).toBe(false);

    openMenuFor('c'); // 다른 카드 메뉴로 바로 전환
    expect(menu().hidden).toBe(false);
    expect($('[data-menu-action="next"]').disabled).toBe(true);
  });

  test('다음 컬럼으로 이동', () => {
    start({ layout: { todo: ['a', 'b'], 'in-progress': ['c'] } });
    openMenuFor('a');
    clickMenu('next');
    expect(menu().hidden).toBe(true);
    expect(cardIds('todo')).toEqual(['b']);
    expect(cardIds('in-progress')).toEqual(['c', 'a']);
    expect(card('a').dataset.column).toBe('in-progress');
    expect(count('in-progress')).toBe('2');
    expect(live()).toBe("'카드 a' 카드를 In-Progress(으)로 옮겼습니다.");
    expect(document.activeElement).toBe($('[data-action="menu"]', card('a')));
    expect(Board.deserialize(storage.setItem.mock.calls.at(-1)[1]).columns['in-progress']).toEqual(['c', 'a']);
  });

  test('이전 컬럼으로 이동', () => {
    start({ layout: { done: ['a'] } });
    openMenuFor('a');
    clickMenu('prev');
    expect(cardIds('in-progress')).toEqual(['a']);
    expect(cardIds('done')).toEqual([]);
  });

  test('비활성 항목은 눌러도 아무 일이 없다', () => {
    start({ layout: { todo: ['a'] } });
    openMenuFor('a');
    clickMenu('prev');
    expect(menu().hidden).toBe(false);
    expect(cardIds('todo')).toEqual(['a']);
  });

  test('키보드로 메뉴를 탐색한다 (화살표, Home/End, Esc)', () => {
    start({ layout: { todo: ['a'] } });
    openMenuFor('a');
    const m = menu();
    key(m, 'ArrowDown');
    expect(document.activeElement).toBe($('[data-menu-action="next"]')); // prev는 비활성이라 건너뛴다
    key(m, 'ArrowDown');
    expect(document.activeElement).toBe($('[data-menu-action="delete"]'));
    key(m, 'ArrowDown');
    expect(document.activeElement).toBe($('[data-menu-action="edit"]'));
    key(m, 'ArrowUp');
    expect(document.activeElement).toBe($('[data-menu-action="delete"]'));
    key(m, 'Home');
    expect(document.activeElement).toBe($('[data-menu-action="edit"]'));
    key(m, 'End');
    expect(document.activeElement).toBe($('[data-menu-action="delete"]'));
    key(m, 'Escape');
    expect(m.hidden).toBe(true);
    expect(document.activeElement).toBe($('[data-action="menu"]', card('a')));
  });

  test('Tab을 누르면 메뉴가 닫힌다', () => {
    start({ layout: { todo: ['a'] } });
    openMenuFor('a');
    key(menu(), 'Tab');
    expect(menu().hidden).toBe(true);
  });

  test('메뉴 밖을 클릭하면 메뉴만 닫힌다', () => {
    start({ layout: { todo: ['a'] } });
    openMenuFor('a');
    click(card('a'));
    expect(menu().hidden).toBe(true);
    expect(isOpen(cardDialog())).toBe(false);
  });
});

describe('카드 삭제', () => {
  test('확인 후 삭제한다', () => {
    start({ layout: { todo: ['a', 'b'] } });
    openMenuFor('a');
    clickMenu('delete');
    expect(isOpen(confirmDialog())).toBe(true);
    expect($('[data-confirm-message]').textContent).toBe("'카드 a' 카드를 삭제할까요?");

    click($('[data-action="confirm-delete"]'));
    expect(isOpen(confirmDialog())).toBe(false);
    expect(cardIds('todo')).toEqual(['b']);
    expect(count('todo')).toBe('1');
    expect(live()).toBe("'카드 a' 카드를 삭제했습니다.");
    expect(Board.deserialize(storage.setItem.mock.calls.at(-1)[1]).cards.a).toBeUndefined();
  });

  test('취소하면 삭제하지 않는다', () => {
    start({ layout: { todo: ['a'] } });
    openMenuFor('a');
    clickMenu('delete');
    click($('[data-action="cancel"]', confirmDialog()));
    expect(isOpen(confirmDialog())).toBe(false);
    expect(cardIds('todo')).toEqual(['a']);
    expect(document.activeElement).toBe($('[data-action="menu"]', card('a')));
  });
});

/* ---------- 드래그 ---------- */

const COLUMN_WIDTH = 300;
const CARD_TOP = 100;
const CARD_STEP = 60;
const CARD_HEIGHT = 50;
/** idx번째 카드의 세로 중심 */
const centerY = (idx) => CARD_TOP + idx * CARD_STEP + CARD_HEIGHT / 2;
/** 컬럼의 가로 중심 */
const columnX = (col) => Board.COLUMNS.indexOf(col) * COLUMN_WIDTH + COLUMN_WIDTH / 2;

/**
 * jsdom에는 레이아웃이 없으므로 위치를 흉내 낸다.
 * - 컬럼은 가로로 300px씩
 * - 카드는 리스트 안에서 보이는(hidden 아닌) 카드 순서대로 top=100+60*i, height=50
 * - 보드 밖(x≥900 또는 y<50)은 body
 */
function mockLayout() {
  jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rect() {
    if (this.classList.contains('card')) {
      const col = this.closest('.column');
      const visible = Array.from(this.parentNode.children).filter((el) => el.classList.contains('card') && !el.hidden);
      const i = visible.indexOf(this);
      const left = col ? Board.COLUMNS.indexOf(col.dataset.column) * COLUMN_WIDTH : 0;
      const top = CARD_TOP + Math.max(i, 0) * CARD_STEP;
      return { top, left, width: 280, height: CARD_HEIGHT, right: left + 280, bottom: top + CARD_HEIGHT, x: left, y: top };
    }
    return { top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0 };
  });
  document.elementFromPoint = jest.fn((x, y) => {
    if (x < 0 || x >= COLUMN_WIDTH * 3 || y < 50) return document.body;
    return column(Board.COLUMNS[Math.floor(x / COLUMN_WIDTH)]);
  });
}

function pointer(type, target, x, y, extra = {}) {
  target.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, pointerId: 1, pointerType: 'mouse', ...extra,
  }));
}

/** 카드 id를 (fromX, fromY)에서 집어 (toX, toY)에 놓는다. */
function drag(id, to, { pointerType = 'mouse', release = true } = {}) {
  const el = card(id);
  const col = el.closest('.column').dataset.column;
  const idx = cardIds(col).indexOf(id);
  const fromX = columnX(col);
  const fromY = centerY(idx);
  pointer('pointerdown', $('.card__title', el), fromX, fromY, { pointerType });
  if (pointerType !== 'mouse') jest.advanceTimersByTime(200);
  pointer('pointermove', document, fromX + 10, fromY + 10, { pointerType });
  pointer('pointermove', document, to.x, to.y, { pointerType });
  if (release) pointer('pointerup', document, to.x, to.y, { pointerType });
}

describe('드래그 앤 드롭 (마우스)', () => {
  test('다른 컬럼의 끝으로 옮긴다', () => {
    start({ layout: { todo: ['a', 'b'], 'in-progress': ['c'] } });
    mockLayout();
    drag('a', { x: columnX('in-progress'), y: 500 });
    expect(cardIds('todo')).toEqual(['b']);
    expect(cardIds('in-progress')).toEqual(['c', 'a']);
    expect(count('in-progress')).toBe('2');
    expect(live()).toBe("'카드 a' 카드를 In-Progress(으)로 옮겼습니다.");
    expect(Board.deserialize(storage.setItem.mock.calls.at(-1)[1]).columns['in-progress']).toEqual(['c', 'a']);
  });

  test('다른 컬럼의 맨 앞으로 옮긴다', () => {
    start({ layout: { todo: ['a'], done: ['x', 'y'] } });
    mockLayout();
    drag('a', { x: columnX('done'), y: CARD_TOP });
    expect(cardIds('done')).toEqual(['a', 'x', 'y']);
  });

  test('카드 사이에 놓는다', () => {
    start({ layout: { todo: ['a'], done: ['x', 'y'] } });
    mockLayout();
    drag('a', { x: columnX('done'), y: centerY(0) + 5 });
    expect(cardIds('done')).toEqual(['x', 'a', 'y']);
  });

  test('빈 컬럼으로 옮긴다', () => {
    start({ layout: { todo: ['a'] } });
    mockLayout();
    drag('a', { x: columnX('done'), y: 200 });
    expect(cardIds('todo')).toEqual([]);
    expect(cardIds('done')).toEqual(['a']);
  });

  test('같은 컬럼 안에서 순서를 바꾼다', () => {
    start({ layout: { todo: ['a', 'b', 'c'] } });
    mockLayout();
    drag('a', { x: columnX('todo'), y: 500 });
    expect(cardIds('todo')).toEqual(['b', 'c', 'a']);
    drag('a', { x: columnX('todo'), y: CARD_TOP });
    expect(cardIds('todo')).toEqual(['a', 'b', 'c']);
  });

  test('제자리에 놓으면 저장하지 않는다', () => {
    start({ layout: { todo: ['a', 'b'] } });
    mockLayout();
    drag('a', { x: columnX('todo'), y: CARD_TOP + 5 });
    expect(cardIds('todo')).toEqual(['a', 'b']);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  test('드래그 중에는 고스트와 플레이스홀더가 보이고, 끝나면 사라진다', () => {
    start({ layout: { todo: ['a', 'b'] } });
    mockLayout();
    drag('a', { x: columnX('done'), y: 200 }, { release: false });
    const ghost = $('.card--ghost');
    expect(ghost).not.toBeNull();
    expect(ghost.getAttribute('aria-hidden')).toBe('true');
    expect(ghost.style.transform).toContain('translate3d');
    expect(card('a').hidden).toBe(true);
    expect($('.card-placeholder', column('done'))).not.toBeNull();
    expect(column('done').classList.contains('column--drop-target')).toBe(true);
    expect($('[data-board]').classList.contains('is-dragging')).toBe(true);

    pointer('pointerup', document, columnX('done'), 200);
    expect($('.card--ghost')).toBeNull();
    expect($('.card-placeholder')).toBeNull();
    expect($('.column--drop-target')).toBeNull();
    expect($('[data-board]').classList.contains('is-dragging')).toBe(false);
  });

  test('보드 밖에 놓으면 취소된다', () => {
    start({ layout: { todo: ['a'] } });
    mockLayout();
    drag('a', { x: 950, y: 200 });
    expect(cardIds('todo')).toEqual(['a']);
    expect(card('a').hidden).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  test('Esc를 누르면 취소된다', () => {
    start({ layout: { todo: ['a'] } });
    mockLayout();
    drag('a', { x: columnX('done'), y: 200 }, { release: false });
    key(document.body, 'Escape');
    expect($('.card--ghost')).toBeNull();
    pointer('pointerup', document, columnX('done'), 200);
    expect(cardIds('todo')).toEqual(['a']);
    expect(cardIds('done')).toEqual([]);
  });

  test('pointercancel이면 취소된다', () => {
    start({ layout: { todo: ['a'] } });
    mockLayout();
    drag('a', { x: columnX('done'), y: 200 }, { release: false });
    pointer('pointercancel', document, 0, 0);
    expect($('.card--ghost')).toBeNull();
    expect(cardIds('todo')).toEqual(['a']);
  });

  test('4px 미만으로 움직이면 드래그가 아니라 클릭이다', () => {
    start({ layout: { todo: ['a'] } });
    mockLayout();
    const el = $('.card__title', card('a'));
    pointer('pointerdown', el, 150, 125);
    pointer('pointermove', document, 152, 126);
    expect($('.card--ghost')).toBeNull();
    pointer('pointerup', document, 152, 126);
    click(el);
    expect(isOpen(cardDialog())).toBe(true);
  });

  test('드래그 직후의 click은 편집 다이얼로그를 열지 않는다', () => {
    jest.useFakeTimers();
    start({ layout: { todo: ['a'] } });
    mockLayout();
    drag('a', { x: columnX('done'), y: 200 });
    click(card('a'));
    expect(isOpen(cardDialog())).toBe(false);

    // click이 오지 않았더라도 다음 클릭은 정상 동작한다
    drag('a', { x: columnX('todo'), y: 200 });
    jest.runOnlyPendingTimers();
    click(card('a'));
    expect(isOpen(cardDialog())).toBe(true);
  });

  test('메뉴 버튼이나 오른쪽 버튼으로는 드래그가 시작되지 않는다', () => {
    start({ layout: { todo: ['a'] } });
    mockLayout();
    pointer('pointerdown', $('[data-action="menu"]', card('a')), 150, 125);
    pointer('pointermove', document, 400, 300);
    expect($('.card--ghost')).toBeNull();
    pointer('pointerup', document, 400, 300);

    pointer('pointerdown', card('a'), 150, 125, { button: 2 });
    pointer('pointermove', document, 400, 300);
    expect($('.card--ghost')).toBeNull();
    pointer('pointerup', document, 400, 300);
    expect(cardIds('todo')).toEqual(['a']);
  });

  test('다른 pointerId의 이벤트는 무시한다', () => {
    start({ layout: { todo: ['a'] } });
    mockLayout();
    drag('a', { x: columnX('done'), y: 200 }, { release: false });
    pointer('pointerup', document, columnX('done'), 200, { pointerId: 99 });
    expect($('.card--ghost')).not.toBeNull();
    pointer('pointerup', document, columnX('done'), 200);
    expect(cardIds('done')).toEqual(['a']);
  });

  test('화면 가장자리에서는 자동 스크롤한다', () => {
    start({ layout: { todo: ['a'] } });
    mockLayout();
    const scrollBy = jest.spyOn(window, 'scrollBy').mockImplementation(() => {});
    drag('a', { x: columnX('done'), y: window.innerHeight - 10 }, { release: false });
    expect(scrollBy).toHaveBeenCalledWith(0, 12);
    pointer('pointermove', document, columnX('done'), 60);
    expect(scrollBy).not.toHaveBeenCalledWith(0, -12);
    pointer('pointermove', document, columnX('done'), 20);
    expect(scrollBy).toHaveBeenCalledWith(0, -12);
    pointer('pointerup', document, columnX('done'), 200);
  });

  test('requestAnimationFrame이 있으면 고스트 이동을 프레임 단위로 묶는다', () => {
    start({ layout: { todo: ['a'] } });
    mockLayout();
    const callbacks = [];
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { callbacks.push(cb); return callbacks.length; });
    drag('a', { x: columnX('done'), y: 200 }, { release: false });
    pointer('pointermove', document, columnX('done'), 210);
    expect(callbacks).toHaveLength(1); // 여러 번 움직여도 한 프레임만 예약
    callbacks[0]();
    expect($('.card--ghost').style.transform).toContain(`${210 - (125 - CARD_TOP)}px`);
    pointer('pointerup', document, columnX('done'), 210);
    expect(cardIds('done')).toEqual(['a']);
  });
});

describe('드래그 앤 드롭 (터치)', () => {
  beforeEach(() => { jest.useFakeTimers(); });

  test('길게 누른 뒤 끌면 옮겨진다', () => {
    start({ layout: { todo: ['a'] } });
    mockLayout();
    drag('a', { x: columnX('in-progress'), y: 200 }, { pointerType: 'touch' });
    expect(cardIds('in-progress')).toEqual(['a']);
  });

  test('롱프레스 전에 움직이면 스크롤로 보고 드래그하지 않는다', () => {
    start({ layout: { todo: ['a'] } });
    mockLayout();
    const el = $('.card__title', card('a'));
    pointer('pointerdown', el, 150, 125, { pointerType: 'touch' });
    jest.advanceTimersByTime(100);
    pointer('pointermove', document, 150, 160, { pointerType: 'touch' });
    jest.advanceTimersByTime(200);
    expect($('.card--ghost')).toBeNull();
    pointer('pointermove', document, columnX('done'), 200, { pointerType: 'touch' });
    pointer('pointerup', document, columnX('done'), 200, { pointerType: 'touch' });
    expect(cardIds('todo')).toEqual(['a']);
  });

  test('롱프레스 전의 작은 흔들림(10px 이하)은 허용한다', () => {
    start({ layout: { todo: ['a'] } });
    mockLayout();
    const el = $('.card__title', card('a'));
    pointer('pointerdown', el, 150, 125, { pointerType: 'touch' });
    pointer('pointermove', document, 155, 130, { pointerType: 'touch' });
    jest.advanceTimersByTime(200);
    expect($('.card--ghost')).not.toBeNull();
    pointer('pointerup', document, columnX('done'), 200, { pointerType: 'touch' });
    expect(cardIds('done')).toEqual(['a']);
  });

  test('짧게 탭하면 드래그가 아니다', () => {
    start({ layout: { todo: ['a'] } });
    mockLayout();
    const el = $('.card__title', card('a'));
    pointer('pointerdown', el, 150, 125, { pointerType: 'touch' });
    jest.advanceTimersByTime(50);
    pointer('pointerup', document, 150, 125, { pointerType: 'touch' });
    jest.advanceTimersByTime(500);
    expect($('.card--ghost')).toBeNull();
    click(el);
    expect(isOpen(cardDialog())).toBe(true);
  });

  test('드래그 중 touchmove와 contextmenu의 기본 동작을 막는다', () => {
    start({ layout: { todo: ['a'] } });
    mockLayout();
    const el = $('.card__title', card('a'));
    pointer('pointerdown', el, 150, 125, { pointerType: 'touch' });
    const menuEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    el.dispatchEvent(menuEvent);
    expect(menuEvent.defaultPrevented).toBe(true);

    jest.advanceTimersByTime(200);
    const touch = new Event('touchmove', { bubbles: true, cancelable: true });
    el.dispatchEvent(touch);
    expect(touch.defaultPrevented).toBe(true);
    pointer('pointerup', document, 150, 125, { pointerType: 'touch' });

    const after = new Event('touchmove', { bubbles: true, cancelable: true });
    document.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });
});

describe('기타', () => {
  test('스크롤하면 앱 바에 그림자 클래스가 붙는다', () => {
    start();
    Object.defineProperty(window, 'scrollY', { value: 120, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    expect($('[data-app-bar]').classList.contains('app-bar--scrolled')).toBe(true);
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    expect($('[data-app-bar]').classList.contains('app-bar--scrolled')).toBe(false);
  });

  test('destroy 후에는 이벤트에 반응하지 않는다', () => {
    start();
    app.destroy();
    click($('[data-action="add"][data-column="todo"]'));
    expect(isOpen(cardDialog())).toBe(false);
    app = null;
  });
});
