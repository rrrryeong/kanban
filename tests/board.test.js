/**
 * @jest-environment node
 */
const B = require('../board.js');

const NOW = '2026-11-12T00:00:00.000Z';
const LATER = '2026-11-12T01:00:00.000Z';

/** 보드와 그 안의 객체를 깊게 freeze해서 불변성을 검사한다. */
function deepFreeze(obj) {
  Object.values(obj).forEach((v) => { if (v && typeof v === 'object') deepFreeze(v); });
  return Object.freeze(obj);
}

/** { todo: ['a','b'], ... } 형태로 테스트 보드를 만든다. */
function boardWith(layout) {
  let board = B.createBoard();
  Object.entries(layout).forEach(([col, ids]) => {
    ids.forEach((id) => { board = B.addCard(board, col, { title: `title-${id}` }, { id, now: NOW }); });
  });
  return deepFreeze(board);
}

const ids = (board) => ({ ...board.columns });

describe('createBoard', () => {
  test('세 개의 빈 컬럼과 버전을 가진 보드를 만든다', () => {
    expect(B.createBoard()).toEqual({
      version: 1,
      cards: {},
      columns: { todo: [], 'in-progress': [], done: [] },
    });
  });

  test('컬럼 순서와 라벨', () => {
    expect(B.COLUMNS).toEqual(['todo', 'in-progress', 'done']);
    expect(B.COLUMN_LABELS).toEqual({ todo: 'To-Do', 'in-progress': 'In-Progress', done: 'Done' });
  });
});

describe('addCard', () => {
  test('컬럼 맨 아래에 카드를 추가한다', () => {
    const board = boardWith({ todo: ['a'] });
    const next = B.addCard(board, 'todo', { title: '  새 카드 ', description: ' 설명 ' }, { id: 'b', now: NOW });
    expect(next.columns.todo).toEqual(['a', 'b']);
    expect(next.cards.b).toEqual({ id: 'b', title: '새 카드', description: '설명', createdAt: NOW, updatedAt: NOW });
  });

  test('입력 보드를 바꾸지 않는다', () => {
    const board = boardWith({ todo: ['a'] });
    B.addCard(board, 'todo', { title: 'x' }, { id: 'b' });
    expect(board.columns.todo).toEqual(['a']);
    expect(board.cards.b).toBeUndefined();
  });

  test('id를 주지 않으면 고유한 id를 만든다', () => {
    let board = B.createBoard();
    board = B.addCard(board, 'todo', { title: '1' });
    board = B.addCard(board, 'todo', { title: '2' });
    const [first, second] = board.columns.todo;
    expect(typeof first).toBe('string');
    expect(first).not.toBe(second);
  });

  test('crypto.randomUUID가 없어도 id를 만든다', () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      const board = B.addCard(B.createBoard(), 'todo', { title: 'x' });
      expect(board.columns.todo[0]).toMatch(/^card-/);
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true });
    }
  });

  test('생성 시각을 기록한다', () => {
    const board = B.addCard(B.createBoard(), 'done', { title: 'x' }, { id: 'a' });
    expect(new Date(board.cards.a.createdAt).toISOString()).toBe(board.cards.a.createdAt);
    expect(board.cards.a.description).toBe('');
  });

  test.each([
    ['', 'EMPTY_TITLE'],
    ['   ', 'EMPTY_TITLE'],
    [undefined, 'EMPTY_TITLE'],
    ['가'.repeat(101), 'TITLE_TOO_LONG'],
  ])('잘못된 제목 %p 은 %s 에러', (title, code) => {
    expect(() => B.addCard(B.createBoard(), 'todo', { title })).toThrow(expect.objectContaining({ code }));
  });

  test('제목 100자, 설명 1000자까지 허용한다', () => {
    const board = B.addCard(B.createBoard(), 'todo', { title: 'a'.repeat(100), description: 'b'.repeat(1000) }, { id: 'x' });
    expect(board.cards.x.title).toHaveLength(100);
    expect(() => B.addCard(B.createBoard(), 'todo', { title: 'a', description: 'b'.repeat(1001) }))
      .toThrow(expect.objectContaining({ code: 'DESCRIPTION_TOO_LONG' }));
  });

  test('없는 컬럼이나 중복 id는 에러', () => {
    expect(() => B.addCard(B.createBoard(), 'backlog', { title: 'x' })).toThrow(expect.objectContaining({ code: 'COLUMN_NOT_FOUND' }));
    const board = boardWith({ todo: ['a'] });
    expect(() => B.addCard(board, 'done', { title: 'x' }, { id: 'a' })).toThrow(expect.objectContaining({ code: 'DUPLICATE_ID' }));
  });

  test('인자 없이 호출하면 빈 제목 에러', () => {
    expect(() => B.addCard(B.createBoard(), 'todo')).toThrow(expect.objectContaining({ code: 'EMPTY_TITLE' }));
  });
});

describe('updateCard', () => {
  test('제목과 설명을 바꾸고 updatedAt을 갱신한다', () => {
    const board = boardWith({ todo: ['a'] });
    const next = B.updateCard(board, 'a', { title: ' 바뀐 제목 ', description: '새 설명' }, { now: LATER });
    expect(next.cards.a).toEqual({ id: 'a', title: '바뀐 제목', description: '새 설명', createdAt: NOW, updatedAt: LATER });
    expect(board.cards.a.title).toBe('title-a');
    expect(next.columns).toBe(board.columns);
  });

  test('일부 필드만 바꿀 수 있다', () => {
    const board = boardWith({ todo: ['a'] });
    const next = B.updateCard(board, 'a', { description: 'd' }, { now: LATER });
    expect(next.cards.a.title).toBe('title-a');
    expect(next.cards.a.description).toBe('d');
  });

  test('바뀐 내용이 없으면 같은 보드를 돌려준다', () => {
    const board = boardWith({ todo: ['a'] });
    expect(B.updateCard(board, 'a', { title: 'title-a' })).toBe(board);
    expect(B.updateCard(board, 'a')).toBe(board);
  });

  test('잘못된 입력은 에러', () => {
    const board = boardWith({ todo: ['a'] });
    expect(() => B.updateCard(board, 'zzz', { title: 'x' })).toThrow(expect.objectContaining({ code: 'CARD_NOT_FOUND' }));
    expect(() => B.updateCard(board, 'a', { title: ' ' })).toThrow(expect.objectContaining({ code: 'EMPTY_TITLE' }));
  });
});

describe('deleteCard', () => {
  test('카드와 컬럼의 id를 함께 지운다', () => {
    const board = boardWith({ todo: ['a', 'b'], done: ['c'] });
    const next = B.deleteCard(board, 'a');
    expect(next.cards.a).toBeUndefined();
    expect(ids(next)).toEqual({ todo: ['b'], 'in-progress': [], done: ['c'] });
    expect(board.cards.a).toBeDefined();
  });

  test('없는 카드는 에러', () => {
    expect(() => B.deleteCard(B.createBoard(), 'a')).toThrow(expect.objectContaining({ code: 'CARD_NOT_FOUND' }));
  });
});

describe('moveCard', () => {
  const base = () => boardWith({ todo: ['a', 'b', 'c'], 'in-progress': ['d'], done: [] });

  test('다른 컬럼의 지정한 위치로 옮긴다', () => {
    const next = B.moveCard(base(), 'b', 'in-progress', 0);
    expect(ids(next)).toEqual({ todo: ['a', 'c'], 'in-progress': ['b', 'd'], done: [] });
  });

  test('빈 컬럼으로 옮긴다', () => {
    const next = B.moveCard(base(), 'a', 'done', 0);
    expect(ids(next)).toEqual({ todo: ['b', 'c'], 'in-progress': ['d'], done: ['a'] });
  });

  test('같은 컬럼 안에서 순서를 바꾼다 (인덱스는 카드를 뺀 목록 기준)', () => {
    expect(B.moveCard(base(), 'a', 'todo', 2).columns.todo).toEqual(['b', 'c', 'a']);
    expect(B.moveCard(base(), 'c', 'todo', 0).columns.todo).toEqual(['c', 'a', 'b']);
    expect(B.moveCard(base(), 'a', 'todo', 1).columns.todo).toEqual(['b', 'a', 'c']);
  });

  test('범위를 벗어난 인덱스는 보정한다', () => {
    expect(B.moveCard(base(), 'a', 'in-progress', 99).columns['in-progress']).toEqual(['d', 'a']);
    expect(B.moveCard(base(), 'a', 'in-progress', -5).columns['in-progress']).toEqual(['a', 'd']);
    expect(B.moveCard(base(), 'a', 'in-progress', undefined).columns['in-progress']).toEqual(['d', 'a']);
    expect(B.moveCard(base(), 'a', 'in-progress', Infinity).columns['in-progress']).toEqual(['d', 'a']);
  });

  test('위치가 같으면 같은 보드를 돌려준다', () => {
    const board = base();
    expect(B.moveCard(board, 'b', 'todo', 1)).toBe(board);
  });

  test('입력 보드를 바꾸지 않는다', () => {
    const board = base();
    B.moveCard(board, 'a', 'done', 0);
    expect(board.columns.todo).toEqual(['a', 'b', 'c']);
    expect(board.columns.done).toEqual([]);
  });

  test('없는 카드나 컬럼은 에러', () => {
    expect(() => B.moveCard(base(), 'zz', 'done', 0)).toThrow(expect.objectContaining({ code: 'CARD_NOT_FOUND' }));
    expect(() => B.moveCard(base(), 'a', 'nope', 0)).toThrow(expect.objectContaining({ code: 'COLUMN_NOT_FOUND' }));
  });
});

describe('moveCardBy', () => {
  const base = () => boardWith({ todo: ['a'], 'in-progress': ['b'], done: ['c'] });

  test('다음 컬럼의 맨 아래로 옮긴다', () => {
    expect(ids(B.moveCardBy(base(), 'a', 1))).toEqual({ todo: [], 'in-progress': ['b', 'a'], done: ['c'] });
  });

  test('이전 컬럼의 맨 아래로 옮긴다', () => {
    expect(ids(B.moveCardBy(base(), 'c', -1))).toEqual({ todo: ['a'], 'in-progress': ['b', 'c'], done: [] });
  });

  test('첫/마지막 컬럼을 넘으면 그대로 둔다', () => {
    const board = base();
    expect(B.moveCardBy(board, 'a', -1)).toBe(board);
    expect(B.moveCardBy(board, 'c', 1)).toBe(board);
    expect(B.moveCardBy(board, 'b', 0)).toBe(board);
  });

  test('없는 카드는 에러', () => {
    expect(() => B.moveCardBy(base(), 'zz', 1)).toThrow(expect.objectContaining({ code: 'CARD_NOT_FOUND' }));
  });
});

describe('조회 함수', () => {
  test('getColumnCards는 순서대로 카드 객체를 돌려준다', () => {
    const board = boardWith({ todo: ['a', 'b'] });
    expect(B.getColumnCards(board, 'todo').map((c) => c.id)).toEqual(['a', 'b']);
    expect(B.getColumnCards(board, 'done')).toEqual([]);
    expect(() => B.getColumnCards(board, 'x')).toThrow();
  });

  test('findCardColumn', () => {
    const board = boardWith({ todo: ['a'], done: ['b'] });
    expect(B.findCardColumn(board, 'a')).toBe('todo');
    expect(B.findCardColumn(board, 'b')).toBe('done');
    expect(B.findCardColumn(board, 'z')).toBeNull();
  });
});

describe('serialize / deserialize', () => {
  test('왕복하면 같은 보드가 된다', () => {
    const board = B.updateCard(boardWith({ todo: ['a', 'b'], 'in-progress': ['c'], done: ['d'] }), 'a', { description: 'desc' }, { now: LATER });
    expect(B.deserialize(B.serialize(board))).toEqual(board);
  });

  test.each([
    ['빈 값', ''],
    ['null', null],
    ['JSON 아님', '{not json'],
    ['배열', '[]'],
    ['숫자', '42'],
    ['버전 없음', JSON.stringify({ cards: {}, columns: {} })],
    ['미래 버전', JSON.stringify({ version: 2, cards: {}, columns: {} })],
  ])('%s 이면 빈 보드', (_name, text) => {
    expect(B.deserialize(text)).toEqual(B.createBoard());
  });

  test('cards/columns가 없거나 이상해도 빈 보드로 복구', () => {
    expect(B.deserialize(JSON.stringify({ version: 1 }))).toEqual(B.createBoard());
    expect(B.deserialize(JSON.stringify({ version: 1, cards: 'x', columns: { todo: 'x' } }))).toEqual(B.createBoard());
  });

  test('손상된 부분만 버리고 나머지는 살린다', () => {
    const card = (id, extra = {}) => ({ id, title: `t-${id}`, description: '', createdAt: NOW, updatedAt: NOW, ...extra });
    const text = JSON.stringify({
      version: 1,
      cards: {
        a: card('a'),
        b: card('b'),
        c: card('c'),
        orphan: card('orphan'),
        bad: card('bad', { title: '' }),
        wrongId: card('other'),
        noDesc: { id: 'noDesc', title: 'x' },
        badDesc: card('badDesc', { description: 5 }),
      },
      columns: {
        todo: ['a', 'missing', 'a', 7, 'bad', 'wrongId'],
        'in-progress': ['b', 'a', 'noDesc', 'badDesc'],
        // done 누락
        backlog: ['c'],
      },
    });
    const board = B.deserialize(text);
    expect(board.columns).toEqual({ todo: ['a'], 'in-progress': ['b', 'noDesc'], done: [] });
    expect(Object.keys(board.cards).sort()).toEqual(['a', 'b', 'noDesc']);
    expect(board.cards.noDesc).toEqual({ id: 'noDesc', title: 'x', description: '', createdAt: '', updatedAt: '' });
  });
});
