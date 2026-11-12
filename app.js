/* 칸반보드 화면 계층: 렌더링, 이벤트, 포인터 드래그, localStorage 저장.
   상태 변경은 모두 board.js(KanbanBoard)의 순수 함수로 한다. TRD.md 참고. */
(function (global, factory) {
  'use strict';
  const isCommonJs = typeof module === 'object' && module.exports;
  const Board = isCommonJs ? require('./board.js') : global.KanbanBoard;
  const api = factory(Board);
  if (isCommonJs) {
    module.exports = api;
  } else {
    global.KanbanApp = api;
    const start = () => api.initApp();
    if (global.document && global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', start);
    } else if (global.document) {
      start();
    }
  }
})(typeof self !== 'undefined' ? self : this, function (Board) {
  'use strict';

  const STORAGE_KEY = 'kanban.board';
  const MOUSE_DRAG_THRESHOLD = 4; // px
  const TOUCH_LONG_PRESS = 200; // ms
  const TOUCH_MOVE_TOLERANCE = 10; // px
  const AUTO_SCROLL_EDGE = 40; // px
  const AUTO_SCROLL_STEP = 12; // px

  const ERROR_MESSAGES = {
    EMPTY_TITLE: '제목을 입력해 주세요.',
    TITLE_TOO_LONG: `제목은 ${Board.TITLE_MAX}자 이하로 입력해 주세요.`,
    DESCRIPTION_TOO_LONG: `설명은 ${Board.DESCRIPTION_MAX}자 이하로 입력해 주세요.`,
  };

  /**
   * 포인터 y 좌표가 들어갈 위치(인덱스)를 계산한다.
   * 세로 중심이 포인터보다 아래에 있는 첫 카드의 인덱스, 없으면 맨 끝.
   */
  function getDropIndex(cardRects, pointerY) {
    for (let i = 0; i < cardRects.length; i += 1) {
      const rect = cardRects[i];
      if (pointerY < rect.top + rect.height / 2) return i;
    }
    return cardRects.length;
  }

  function defaultStorage() {
    try {
      return typeof window !== 'undefined' ? window.localStorage : null;
    } catch (e) {
      return null;
    }
  }

  function initApp({ root = document, storage = defaultStorage() } = {}) {
    const doc = root.ownerDocument || root;
    const win = doc.defaultView || (typeof window !== 'undefined' ? window : null);

    const els = {
      board: root.querySelector('[data-board]'),
      appBar: root.querySelector('[data-app-bar]'),
      menu: root.querySelector('[data-menu]'),
      cardDialog: root.querySelector('[data-card-dialog]'),
      cardForm: root.querySelector('[data-card-form]'),
      dialogTitle: root.querySelector('[data-dialog-title]'),
      titleInput: root.querySelector('#card-title'),
      descInput: root.querySelector('#card-description'),
      confirmDialog: root.querySelector('[data-confirm-dialog]'),
      confirmMessage: root.querySelector('[data-confirm-message]'),
      live: root.querySelector('[data-live]'),
    };

    const columnEls = {};
    Board.COLUMNS.forEach((col) => {
      const section = els.board.querySelector(`.column[data-column="${col}"]`);
      columnEls[col] = {
        section,
        list: section.querySelector('[data-list]'),
        count: section.querySelector('[data-count]'),
      };
    });

    let state = load();
    let dialogContext = null; // { mode: 'add', column } | { mode: 'edit', cardId }
    let pendingDeleteId = null;
    let menuCardId = null;
    let openDialogEl = null;
    let returnFocusEl = null;
    let pointer = null; // 드래그 진행 상태
    let suppressClick = false;

    /* ---------- 저장 ---------- */
    function load() {
      if (!storage) return Board.createBoard();
      try {
        return Board.deserialize(storage.getItem(STORAGE_KEY));
      } catch (e) {
        return Board.createBoard();
      }
    }

    function save() {
      if (!storage) return;
      try {
        storage.setItem(STORAGE_KEY, Board.serialize(state));
      } catch (e) {
        // 용량 초과·사용 불가: 메모리로만 계속 동작한다.
      }
    }

    function commit(next) {
      if (next === state) return false;
      state = next;
      save();
      render();
      return true;
    }

    function announce(message) {
      if (!els.live) return;
      els.live.textContent = '';
      els.live.textContent = message;
    }

    /* ---------- 렌더링 ---------- */
    function createCardEl(card, column) {
      const li = doc.createElement('li');
      li.className = 'card';
      li.dataset.cardId = card.id;
      li.dataset.column = column;
      li.tabIndex = 0;

      const body = doc.createElement('div');
      body.className = 'card__body';
      const title = doc.createElement('h3');
      title.className = 'card__title';
      title.textContent = card.title;
      const desc = doc.createElement('p');
      desc.className = 'card__desc';
      desc.textContent = card.description;
      body.append(title, desc);

      const menuBtn = doc.createElement('button');
      menuBtn.type = 'button';
      menuBtn.className = 'btn-icon card__menu';
      menuBtn.dataset.action = 'menu';
      menuBtn.setAttribute('aria-label', `카드 메뉴: ${card.title}`);
      menuBtn.setAttribute('aria-haspopup', 'menu');
      menuBtn.setAttribute('aria-expanded', 'false');
      const icon = doc.createElement('span');
      icon.className = 'material-symbols-rounded';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = 'more_vert';
      menuBtn.append(icon);

      li.append(body, menuBtn);
      return li;
    }

    function render() {
      Board.COLUMNS.forEach((col) => {
        const { list, count } = columnEls[col];
        const cards = Board.getColumnCards(state, col);
        list.replaceChildren(...cards.map((card) => createCardEl(card, col)));
        count.textContent = String(cards.length);
        count.setAttribute('aria-label', `카드 ${cards.length}개`);
      });
    }

    function cardEl(cardId) {
      return els.board.querySelector(`.card[data-card-id="${cssEscape(cardId)}"]`);
    }

    function cssEscape(value) {
      if (win && win.CSS && typeof win.CSS.escape === 'function') return win.CSS.escape(value);
      return String(value).replace(/["\\]/g, '\\$&');
    }

    function focusCardMenu(cardId) {
      const el = cardEl(cardId);
      const btn = el && el.querySelector('[data-action="menu"]');
      if (btn) btn.focus();
    }

    /* ---------- 다이얼로그 ---------- */
    function openDialog(dialog, focusTarget) {
      returnFocusEl = doc.activeElement;
      openDialogEl = dialog;
      if (typeof dialog.showModal === 'function') {
        try {
          dialog.showModal();
        } catch (e) {
          dialog.setAttribute('open', '');
        }
      } else {
        dialog.setAttribute('open', '');
      }
      if (focusTarget) focusTarget.focus();
    }

    function closeDialog({ restoreFocus = true } = {}) {
      const dialog = openDialogEl;
      if (!dialog) return;
      openDialogEl = null;
      if (typeof dialog.close === 'function' && dialog.open) {
        dialog.close();
      }
      dialog.removeAttribute('open');
      if (restoreFocus && returnFocusEl && returnFocusEl.isConnected && typeof returnFocusEl.focus === 'function') {
        returnFocusEl.focus();
      }
      returnFocusEl = null;
      dialogContext = null;
      pendingDeleteId = null;
    }

    function setFieldError(field, message) {
      const wrapper = els.cardForm.querySelector(`[data-field="${field}"]`);
      const errorEl = els.cardForm.querySelector(`[data-error="${field}"]`);
      const input = field === 'title' ? els.titleInput : els.descInput;
      wrapper.classList.toggle('text-field--error', Boolean(message));
      errorEl.textContent = message || '';
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }

    function updateCounters() {
      els.cardForm.querySelector('[data-counter="title"]').textContent = `${els.titleInput.value.length}/${Board.TITLE_MAX}`;
      els.cardForm.querySelector('[data-counter="description"]').textContent = `${els.descInput.value.length}/${Board.DESCRIPTION_MAX}`;
    }

    function openCardDialog(context) {
      dialogContext = context;
      const card = context.mode === 'edit' ? state.cards[context.cardId] : null;
      els.dialogTitle.textContent = card ? '카드 편집' : `새 카드 — ${Board.COLUMN_LABELS[context.column]}`;
      els.titleInput.value = card ? card.title : '';
      els.descInput.value = card ? card.description : '';
      setFieldError('title', '');
      setFieldError('description', '');
      updateCounters();
      openDialog(els.cardDialog, els.titleInput);
    }

    function submitCardDialog() {
      const ctx = dialogContext;
      if (!ctx) return;
      const values = { title: els.titleInput.value, description: els.descInput.value };
      setFieldError('title', '');
      setFieldError('description', '');
      let next;
      try {
        next = ctx.mode === 'add'
          ? Board.addCard(state, ctx.column, values)
          : Board.updateCard(state, ctx.cardId, values);
      } catch (error) {
        const field = error.code === 'DESCRIPTION_TOO_LONG' ? 'description' : 'title';
        setFieldError(field, ERROR_MESSAGES[error.code] || error.message);
        (field === 'title' ? els.titleInput : els.descInput).focus();
        return;
      }
      let cardId = ctx.cardId;
      if (ctx.mode === 'add') {
        const list = next.columns[ctx.column];
        cardId = list[list.length - 1];
      }
      closeDialog({ restoreFocus: false });
      commit(next);
      const title = state.cards[cardId].title;
      announce(ctx.mode === 'add'
        ? `'${title}' 카드를 ${Board.COLUMN_LABELS[ctx.column]}에 추가했습니다.`
        : `'${title}' 카드를 수정했습니다.`);
      const el = cardEl(cardId);
      if (el) el.focus();
    }

    function openDeleteConfirm(cardId) {
      const card = state.cards[cardId];
      if (!card) return;
      els.confirmMessage.textContent = `'${card.title}' 카드를 삭제할까요?`;
      openDialog(els.confirmDialog, els.confirmDialog.querySelector('[data-action="cancel"]'));
      pendingDeleteId = cardId;
    }

    function confirmDelete() {
      const cardId = pendingDeleteId;
      if (!cardId || !state.cards[cardId]) {
        closeDialog();
        return;
      }
      const title = state.cards[cardId].title;
      closeDialog({ restoreFocus: false });
      commit(Board.deleteCard(state, cardId));
      announce(`'${title}' 카드를 삭제했습니다.`);
    }

    /* ---------- 카드 메뉴 ---------- */
    function menuItems() {
      return Array.from(els.menu.querySelectorAll('[data-menu-action]'));
    }

    function openMenu(cardId, anchor) {
      menuCardId = cardId;
      const colIndex = Board.COLUMNS.indexOf(Board.findCardColumn(state, cardId));
      els.menu.querySelector('[data-menu-action="prev"]').disabled = colIndex <= 0;
      els.menu.querySelector('[data-menu-action="next"]').disabled = colIndex >= Board.COLUMNS.length - 1;
      els.menu.hidden = false;
      anchor.setAttribute('aria-expanded', 'true');

      const rect = anchor.getBoundingClientRect();
      const width = els.menu.offsetWidth || 200;
      const height = els.menu.offsetHeight || 0;
      const vw = (win && win.innerWidth) || 0;
      const vh = (win && win.innerHeight) || 0;
      let left = rect.right - width;
      let top = rect.bottom + 4;
      if (vw) left = Math.min(Math.max(8, left), vw - width - 8);
      if (vh && height && top + height > vh - 8) top = Math.max(8, rect.top - height - 4);
      els.menu.style.left = `${Math.max(8, left)}px`;
      els.menu.style.top = `${top}px`;

      const first = menuItems().find((item) => !item.disabled);
      if (first) first.focus();
    }

    function closeMenu({ restoreFocus = false } = {}) {
      if (els.menu.hidden) return;
      const cardId = menuCardId;
      els.menu.hidden = true;
      menuCardId = null;
      els.board.querySelectorAll('[data-action="menu"][aria-expanded="true"]')
        .forEach((btn) => btn.setAttribute('aria-expanded', 'false'));
      if (restoreFocus && cardId) focusCardMenu(cardId);
    }

    function handleMenuAction(action) {
      const cardId = menuCardId;
      closeMenu();
      if (!cardId || !state.cards[cardId]) return;
      if (action === 'edit') {
        const anchor = cardEl(cardId);
        if (anchor) anchor.focus();
        openCardDialog({ mode: 'edit', cardId });
      } else if (action === 'prev' || action === 'next') {
        if (commit(Board.moveCardBy(state, cardId, action === 'next' ? 1 : -1))) {
          announceMove(cardId);
        }
        focusCardMenu(cardId);
      } else if (action === 'delete') {
        focusCardMenu(cardId);
        openDeleteConfirm(cardId);
      }
    }

    function announceMove(cardId) {
      const col = Board.findCardColumn(state, cardId);
      announce(`'${state.cards[cardId].title}' 카드를 ${Board.COLUMN_LABELS[col]}(으)로 옮겼습니다.`);
    }

    function moveMenuFocus(step) {
      const items = menuItems().filter((item) => !item.disabled);
      if (!items.length) return;
      const index = items.indexOf(doc.activeElement);
      let next;
      if (step === 'first') next = 0;
      else if (step === 'last') next = items.length - 1;
      else next = (index + step + items.length) % items.length;
      items[next].focus();
    }

    /* ---------- 드래그 (Pointer Events) ---------- */
    function onPointerDown(event) {
      if (pointer || openDialogEl) return;
      if (event.button !== undefined && event.button !== 0) return;
      const target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      if (target.closest('button, a, input, textarea')) return;
      const el = target.closest('.card');
      if (!el || !els.board.contains(el)) return;
      closeMenu();

      const pointerType = event.pointerType || 'mouse';
      pointer = {
        id: event.pointerId,
        type: pointerType,
        el,
        cardId: el.dataset.cardId,
        startX: event.clientX,
        startY: event.clientY,
        x: event.clientX,
        y: event.clientY,
        started: false,
        timer: null,
        ghost: null,
        placeholder: null,
        offsetX: 0,
        offsetY: 0,
        target: null,
        frame: null,
      };
      if (pointerType !== 'mouse') {
        pointer.timer = setTimeout(() => {
          if (pointer && !pointer.started) startDrag();
        }, TOUCH_LONG_PRESS);
      }
    }

    function onPointerMove(event) {
      if (!pointer || (pointer.id !== undefined && event.pointerId !== undefined && event.pointerId !== pointer.id)) return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      const dx = pointer.x - pointer.startX;
      const dy = pointer.y - pointer.startY;
      const distance = Math.hypot(dx, dy);

      if (!pointer.started) {
        if (pointer.type === 'mouse') {
          if (distance >= MOUSE_DRAG_THRESHOLD) startDrag();
        } else if (distance > TOUCH_MOVE_TOLERANCE) {
          // 롱프레스 전에 움직이면 스크롤로 본다.
          resetPointer();
        }
        return;
      }
      if (event.cancelable) event.preventDefault();
      updateDropTarget(pointer.x, pointer.y);
      scheduleGhost();
      autoScroll(pointer.y);
    }

    function onPointerUp(event) {
      if (!pointer || (pointer.id !== undefined && event.pointerId !== undefined && event.pointerId !== pointer.id)) return;
      if (!pointer.started) {
        resetPointer();
        return;
      }
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      updateDropTarget(pointer.x, pointer.y);
      finishDrag();
    }

    function onPointerCancel() {
      if (pointer) cancelDrag();
    }

    function onTouchMove(event) {
      if (pointer && pointer.started && event.cancelable) event.preventDefault();
    }

    function onContextMenu(event) {
      if (pointer) event.preventDefault();
    }

    function startDrag() {
      const p = pointer;
      clearTimeout(p.timer);
      p.started = true;
      suppressClick = true;
      const rect = p.el.getBoundingClientRect();
      p.offsetX = p.startX - rect.left;
      p.offsetY = p.startY - rect.top;

      const ghost = p.el.cloneNode(true);
      ghost.classList.add('card--ghost');
      ghost.removeAttribute('tabindex');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
      doc.body.append(ghost);
      p.ghost = ghost;

      const placeholder = doc.createElement('li');
      placeholder.className = 'card-placeholder';
      placeholder.setAttribute('aria-hidden', 'true');
      placeholder.style.height = `${rect.height}px`;
      p.el.before(placeholder);
      p.placeholder = placeholder;
      p.el.hidden = true;

      const sourceColumn = p.el.closest('.column');
      p.target = { column: sourceColumn.dataset.column, index: Board.getColumnCards(state, sourceColumn.dataset.column).findIndex((c) => c.id === p.cardId) };
      setDropHighlight(sourceColumn);

      els.board.classList.add('is-dragging');
      doc.body.classList.add('is-dragging');
      if (typeof p.el.setPointerCapture === 'function' && p.id !== undefined) {
        try { p.el.setPointerCapture(p.id); } catch (e) { /* 지원하지 않으면 무시 */ }
      }
      updateGhost();
    }

    function scheduleGhost() {
      if (!pointer || pointer.frame) return;
      const raf = win && win.requestAnimationFrame;
      if (typeof raf === 'function') {
        pointer.frame = raf.call(win, () => {
          if (!pointer) return;
          pointer.frame = null;
          updateGhost();
        });
      } else {
        updateGhost();
      }
    }

    function updateGhost() {
      const p = pointer;
      if (!p || !p.ghost) return;
      const x = p.x - p.offsetX;
      const y = p.y - p.offsetY;
      p.ghost.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(2deg) scale(1.02)`;
    }

    function columnAt(x, y) {
      if (typeof doc.elementFromPoint !== 'function') return null;
      const hit = doc.elementFromPoint(x, y);
      const column = hit && typeof hit.closest === 'function' ? hit.closest('.column') : null;
      return column && els.board.contains(column) ? column : null;
    }

    function updateDropTarget(x, y) {
      const p = pointer;
      const column = columnAt(x, y);
      setDropHighlight(column);
      if (!column) {
        p.target = null;
        return;
      }
      const list = column.querySelector('[data-list]');
      const cards = Array.from(list.children).filter((el) => el.classList.contains('card') && el !== p.el);
      const index = getDropIndex(cards.map((el) => el.getBoundingClientRect()), y);
      const before = cards[index] || null;
      if (before) {
        if (p.placeholder.nextSibling !== before || p.placeholder.parentNode !== list) list.insertBefore(p.placeholder, before);
      } else {
        list.append(p.placeholder);
      }
      p.target = { column: column.dataset.column, index };
    }

    function setDropHighlight(column) {
      Board.COLUMNS.forEach((col) => {
        columnEls[col].section.classList.toggle('column--drop-target', columnEls[col].section === column);
      });
    }

    function autoScroll(y) {
      if (!win) return;
      const vh = win.innerHeight || 0;
      let delta = 0;
      if (y < AUTO_SCROLL_EDGE) delta = -AUTO_SCROLL_STEP;
      else if (vh && y > vh - AUTO_SCROLL_EDGE) delta = AUTO_SCROLL_STEP;
      if (!delta) return;
      try {
        win.scrollBy(0, delta);
      } catch (e) {
        // 스크롤을 지원하지 않는 환경
      }
    }

    function finishDrag() {
      const { cardId, target } = pointer;
      cleanupDrag();
      if (target && commit(Board.moveCard(state, cardId, target.column, target.index))) {
        announceMove(cardId);
      } else {
        render();
      }
      releaseClickSuppression();
    }

    function cancelDrag() {
      const wasStarted = pointer.started;
      cleanupDrag();
      if (wasStarted) {
        render();
        releaseClickSuppression();
      }
    }

    function cleanupDrag() {
      const p = pointer;
      clearTimeout(p.timer);
      if (p.frame && win && typeof win.cancelAnimationFrame === 'function') win.cancelAnimationFrame(p.frame);
      if (p.ghost) p.ghost.remove();
      if (p.placeholder) p.placeholder.remove();
      if (p.el) p.el.hidden = false;
      setDropHighlight(null);
      els.board.classList.remove('is-dragging');
      doc.body.classList.remove('is-dragging');
      pointer = null;
    }

    function resetPointer() {
      clearTimeout(pointer.timer);
      pointer = null;
    }

    /** 드래그 직후 따라오는 click은 무시한다. click이 오지 않는 경우를 위해 잠시 뒤 해제한다. */
    function releaseClickSuppression() {
      setTimeout(() => { suppressClick = false; }, 0);
    }

    /* ---------- 이벤트 ---------- */
    function onClick(event) {
      if (suppressClick) {
        suppressClick = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const target = event.target;
      if (!target || typeof target.closest !== 'function') return;

      const menuItem = target.closest('[data-menu-action]');
      if (menuItem && els.menu.contains(menuItem)) {
        if (!menuItem.disabled) handleMenuAction(menuItem.dataset.menuAction);
        return;
      }

      const actionEl = target.closest('[data-action]');
      const action = actionEl && actionEl.dataset.action;

      if (!els.menu.hidden && !els.menu.contains(target)) {
        // 메뉴 밖을 클릭하면 메뉴만 닫는다(같은 ⋮ 버튼이면 토글).
        const toggling = action === 'menu' && actionEl.closest('.card') && actionEl.closest('.card').dataset.cardId === menuCardId;
        closeMenu();
        if (toggling || action !== 'menu') return;
      }

      if (openDialogEl && target === openDialogEl) {
        // 배경(backdrop) 클릭
        closeDialog();
        return;
      }

      if (action === 'add') {
        openCardDialog({ mode: 'add', column: actionEl.dataset.column });
      } else if (action === 'menu') {
        const card = actionEl.closest('.card');
        if (card) openMenu(card.dataset.cardId, actionEl);
      } else if (action === 'cancel') {
        closeDialog();
      } else if (action === 'confirm-delete') {
        confirmDelete();
      } else if (!action) {
        const card = target.closest('.card');
        if (card && els.board.contains(card)) openCardDialog({ mode: 'edit', cardId: card.dataset.cardId });
      }
    }

    function onKeyDown(event) {
      const { key } = event;

      if (pointer && key === 'Escape') {
        event.preventDefault();
        cancelDrag();
        return;
      }

      if (!els.menu.hidden) {
        if (key === 'Escape') {
          event.preventDefault();
          closeMenu({ restoreFocus: true });
        } else if (key === 'ArrowDown') {
          event.preventDefault();
          moveMenuFocus(1);
        } else if (key === 'ArrowUp') {
          event.preventDefault();
          moveMenuFocus(-1);
        } else if (key === 'Home') {
          event.preventDefault();
          moveMenuFocus('first');
        } else if (key === 'End') {
          event.preventDefault();
          moveMenuFocus('last');
        } else if (key === 'Tab') {
          closeMenu({ restoreFocus: true });
        }
        return;
      }

      if (openDialogEl) {
        if (key === 'Escape') {
          event.preventDefault();
          closeDialog();
        }
        return;
      }

      const target = event.target;
      if ((key === 'Enter' || key === ' ') && target && target.classList && target.classList.contains('card')) {
        event.preventDefault();
        openCardDialog({ mode: 'edit', cardId: target.dataset.cardId });
      }
    }

    function onSubmit(event) {
      if (event.target !== els.cardForm) return;
      event.preventDefault();
      submitCardDialog();
    }

    function onInput(event) {
      if (event.target === els.titleInput || event.target === els.descInput) updateCounters();
    }

    function onDialogCancel(event) {
      // 브라우저 기본 Esc 처리 대신 같은 닫기 경로를 쓴다.
      event.preventDefault();
      closeDialog();
    }

    function onScroll() {
      if (!els.appBar || !win) return;
      els.appBar.classList.toggle('app-bar--scrolled', (win.scrollY || 0) > 0);
    }

    const listeners = [
      [root, 'click', onClick],
      [root, 'keydown', onKeyDown],
      [root, 'submit', onSubmit],
      [root, 'input', onInput],
      [root, 'pointerdown', onPointerDown],
      [doc, 'pointermove', onPointerMove, { passive: false }],
      [doc, 'pointerup', onPointerUp],
      [doc, 'pointercancel', onPointerCancel],
      [doc, 'touchmove', onTouchMove, { passive: false }],
      [doc, 'contextmenu', onContextMenu],
      [els.cardDialog, 'cancel', onDialogCancel],
      [els.confirmDialog, 'cancel', onDialogCancel],
    ];
    if (win) listeners.push([win, 'scroll', onScroll, { passive: true }]);
    listeners.forEach(([target, type, fn, opts]) => target.addEventListener(type, fn, opts));

    render();

    return {
      getState: () => state,
      destroy() {
        if (pointer) cleanupDrag();
        listeners.forEach(([target, type, fn, opts]) => target.removeEventListener(type, fn, opts));
      },
    };
  }

  return { initApp, getDropIndex, STORAGE_KEY };
});
