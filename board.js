/* 칸반보드 상태 로직. DOM에 의존하지 않는 순수 함수만 둔다.
   모든 함수는 입력 보드를 바꾸지 않고 새 보드를 돌려준다(불변).
   스키마: DATABASE_DESIGN.md 참고. */
(function (global, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    global.KanbanBoard = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSION = 1;
  const COLUMNS = Object.freeze(['todo', 'in-progress', 'done']);
  const COLUMN_LABELS = Object.freeze({ todo: 'To-Do', 'in-progress': 'In-Progress', done: 'Done' });
  const TITLE_MAX = 100;
  const DESCRIPTION_MAX = 1000;

  /** code 속성을 가진 에러. 화면에서 code로 메시지를 고른다. */
  function boardError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function createBoard() {
    const columns = {};
    COLUMNS.forEach((col) => { columns[col] = []; });
    return { version: VERSION, cards: {}, columns };
  }

  function assertColumn(columnId) {
    if (!COLUMNS.includes(columnId)) {
      throw boardError('COLUMN_NOT_FOUND', `알 수 없는 컬럼입니다: ${columnId}`);
    }
  }

  function assertCard(board, cardId) {
    if (!Object.prototype.hasOwnProperty.call(board.cards, cardId)) {
      throw boardError('CARD_NOT_FOUND', `카드를 찾을 수 없습니다: ${cardId}`);
    }
  }

  function normalizeTitle(title) {
    const value = typeof title === 'string' ? title.trim() : '';
    if (!value) throw boardError('EMPTY_TITLE', '제목은 비어 있을 수 없습니다.');
    if (value.length > TITLE_MAX) throw boardError('TITLE_TOO_LONG', `제목은 ${TITLE_MAX}자 이하여야 합니다.`);
    return value;
  }

  function normalizeDescription(description) {
    const value = typeof description === 'string' ? description.trim() : '';
    if (value.length > DESCRIPTION_MAX) {
      throw boardError('DESCRIPTION_TOO_LONG', `설명은 ${DESCRIPTION_MAX}자 이하여야 합니다.`);
    }
    return value;
  }

  function generateId() {
    const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    return `card-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function nowIso(now) {
    return now || new Date().toISOString();
  }

  function cloneColumns(columns) {
    const copy = {};
    COLUMNS.forEach((col) => { copy[col] = columns[col].slice(); });
    return copy;
  }

  function findCardColumn(board, cardId) {
    return COLUMNS.find((col) => board.columns[col].includes(cardId)) || null;
  }

  function getColumnCards(board, columnId) {
    assertColumn(columnId);
    return board.columns[columnId].map((id) => board.cards[id]);
  }

  function addCard(board, columnId, { title, description = '' } = {}, { id, now } = {}) {
    assertColumn(columnId);
    const card = {
      id: id || generateId(),
      title: normalizeTitle(title),
      description: normalizeDescription(description),
      createdAt: nowIso(now),
      updatedAt: nowIso(now),
    };
    if (Object.prototype.hasOwnProperty.call(board.cards, card.id)) {
      throw boardError('DUPLICATE_ID', `이미 있는 카드 id입니다: ${card.id}`);
    }
    const columns = cloneColumns(board.columns);
    columns[columnId].push(card.id);
    return { ...board, cards: { ...board.cards, [card.id]: card }, columns };
  }

  function updateCard(board, cardId, changes = {}, { now } = {}) {
    assertCard(board, cardId);
    const prev = board.cards[cardId];
    const next = { ...prev };
    if (changes.title !== undefined) next.title = normalizeTitle(changes.title);
    if (changes.description !== undefined) next.description = normalizeDescription(changes.description);
    if (next.title === prev.title && next.description === prev.description) return board;
    next.updatedAt = nowIso(now);
    return { ...board, cards: { ...board.cards, [cardId]: next } };
  }

  function deleteCard(board, cardId) {
    assertCard(board, cardId);
    const cards = { ...board.cards };
    delete cards[cardId];
    const columns = cloneColumns(board.columns);
    COLUMNS.forEach((col) => { columns[col] = columns[col].filter((id) => id !== cardId); });
    return { ...board, cards, columns };
  }

  /**
   * 카드를 toColumnId의 toIndex 위치로 옮긴다.
   * toIndex는 "옮길 카드를 뺀 뒤의 대상 목록" 기준이며 범위를 벗어나면 보정한다.
   * 위치가 바뀌지 않으면 입력 보드를 그대로 돌려준다.
   */
  function moveCard(board, cardId, toColumnId, toIndex) {
    assertCard(board, cardId);
    assertColumn(toColumnId);
    const fromColumnId = findCardColumn(board, cardId);
    const fromIndex = board.columns[fromColumnId].indexOf(cardId);

    const columns = cloneColumns(board.columns);
    columns[fromColumnId].splice(fromIndex, 1);
    const target = columns[toColumnId];
    let index = Number.isFinite(toIndex) ? Math.trunc(toIndex) : target.length;
    index = Math.max(0, Math.min(index, target.length));

    if (fromColumnId === toColumnId && index === fromIndex) return board;
    target.splice(index, 0, cardId);
    return { ...board, columns };
  }

  /** 카드를 이전(-1) 또는 다음(+1) 컬럼의 맨 아래로 옮긴다. 범위를 벗어나면 그대로 둔다. */
  function moveCardBy(board, cardId, delta) {
    assertCard(board, cardId);
    const from = COLUMNS.indexOf(findCardColumn(board, cardId));
    const to = from + delta;
    if (to < 0 || to >= COLUMNS.length || to === from) return board;
    return moveCard(board, cardId, COLUMNS[to], Infinity);
  }

  function serialize(board) {
    return JSON.stringify(board);
  }

  function isValidCard(card, id) {
    return Boolean(card)
      && typeof card === 'object'
      && card.id === id
      && typeof card.title === 'string'
      && card.title.trim().length > 0
      && card.title.length <= TITLE_MAX
      && (card.description === undefined || typeof card.description === 'string')
      && (card.description || '').length <= DESCRIPTION_MAX;
  }

  /** 저장된 문자열을 보드로 복원한다. 손상된 부분은 버리고, 복원할 수 없으면 빈 보드를 돌려준다. */
  function deserialize(text) {
    if (typeof text !== 'string' || !text) return createBoard();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return createBoard();
    }
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.version !== VERSION) {
      return createBoard();
    }
    const rawCards = data.cards && typeof data.cards === 'object' ? data.cards : {};
    const rawColumns = data.columns && typeof data.columns === 'object' ? data.columns : {};

    const board = createBoard();
    const seen = new Set();
    COLUMNS.forEach((col) => {
      const ids = Array.isArray(rawColumns[col]) ? rawColumns[col] : [];
      ids.forEach((id) => {
        if (typeof id !== 'string' || seen.has(id)) return;
        if (!Object.prototype.hasOwnProperty.call(rawCards, id)) return;
        const card = rawCards[id];
        if (!isValidCard(card, id)) return;
        seen.add(id);
        board.columns[col].push(id);
        board.cards[id] = {
          id,
          title: card.title,
          description: card.description || '',
          createdAt: typeof card.createdAt === 'string' ? card.createdAt : '',
          updatedAt: typeof card.updatedAt === 'string' ? card.updatedAt : '',
        };
      });
    });
    return board;
  }

  return {
    VERSION,
    COLUMNS,
    COLUMN_LABELS,
    TITLE_MAX,
    DESCRIPTION_MAX,
    createBoard,
    addCard,
    updateCard,
    deleteCard,
    moveCard,
    moveCardBy,
    getColumnCards,
    findCardColumn,
    serialize,
    deserialize,
  };
});
