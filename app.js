// Draws the board and handles clicks and keys. The rules live in logic.js, saving in storage.js,
// and pan, zoom and dragging in canvas.js.
(function () {
  'use strict';

  const L = window.RetroLogic;
  const S = window.RetroStorage;

  const MESSAGE_MS = 4000;
  const PICKER_COLUMNS = 4;
  const VIEW_SAVE_MS = 500;
  const MIN_COLUMN_HEIGHT = 420;
  // Small, so 11 empty areas still fit on screen; a cell grows as soon as notes are added.
  const MIN_NOTES_CELL_HEIGHT = 72;

  const NOTICE_CANT_SAVE = "This board can't be saved in this browser — cards will be lost on refresh";
  const NOTICE_DAMAGED = "The saved board couldn't be read, so the board has started empty. A backup copy of the old data was kept in this browser.";

  // Wording that differs between the two kinds of note (spec Story 6).
  const KIND_TEXT = {
    card: { name: 'card', empty: "A card can't be empty", confirmDelete: 'Delete this card?' },
    health: { name: 'note', empty: "A note can't be empty", confirmDelete: 'Delete this note?' },
  };

  const boardEl = document.getElementById('board');
  const noticeEl = document.getElementById('save-notice');
  const pickerEl = document.getElementById('emoji-picker');
  const sortBtn = document.getElementById('sort-btn');
  const clearBtn = document.getElementById('clear-btn');
  const topbarEl = document.querySelector('.topbar');
  const viewportEl = document.getElementById('viewport');
  const worldEl = document.getElementById('world');
  const retroBodyEl = document.getElementById('retro-body');
  const healthRowsEl = document.getElementById('health-rows');
  const addAreaBtn = document.getElementById('add-area');
  const zoomLabelEl = document.getElementById('zoom-label');

  // Whiteboard on wide screens, simple stacked page on phones (plan §5.14).
  const wideQuery = window.matchMedia('(min-width: 768px)');
  let canvasMode = wideQuery.matches;

  // --- State ----------------------------------------------------------------

  const store = (() => {
    try {
      return window.localStorage;
    } catch (e) {
      return null;
    }
  })();

  let canPersist = S.canSave(store);
  const loaded = S.load(canPersist ? store : null);
  let board = loaded.board;

  const columnEls = {}; // column key -> { list, hint }
  const boxes = new Map(); // textarea -> { last, max, counter, message, timer }
  // The one thing being edited: a card, a health note or an area (plan §5.6).
  // { id, textareas, focusKey, canSave(), apply(board), complain(), afterOpen(), ...its elements }
  let editing = null;
  let addingNote = null; // { areaId, form, textarea } while a Notes cell's add box is open
  let viewSaveTimer = null;

  // --- Small helpers --------------------------------------------------------

  function h(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) {
      if (value === false || value == null) continue;
      if (name === 'class') node.className = value;
      else if (name === 'text') node.textContent = value;
      else node.setAttribute(name, value === true ? '' : value);
    }
    node.append(...children.filter((c) => c != null));
    return node;
  }

  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function findByFocusKey(key) {
    return document.querySelector(`[data-focus-key="${CSS.escape(key)}"]`);
  }

  function showNotice(text) {
    noticeEl.textContent = text;
    noticeEl.hidden = false;
  }

  function noteKind(note) {
    return 'column' in note ? 'card' : 'health';
  }

  function findArea(id) {
    return board.health.areas.find((a) => a.id === id);
  }

  // --- Text boxes: character limit, counter and messages (plan §5.2, §5.9) ---

  function registerBox(textarea, counter, message, max) {
    boxes.set(textarea, { last: textarea.value, max, counter, message, timer: null });
    textarea.addEventListener('input', (e) => {
      if (!e.isComposing) enforceLimit(textarea, e.inputType);
    });
    textarea.addEventListener('compositionend', () => enforceLimit(textarea, 'insertCompositionText'));
    updateCounter(textarea);
  }

  function enforceLimit(textarea, inputType) {
    const box = boxes.get(textarea);
    const result = L.fitEdit(box.last, textarea.value, box.max);
    if (result.text !== textarea.value) {
      textarea.value = result.text;
      textarea.setSelectionRange(result.cursor, result.cursor);
    }
    box.last = textarea.value;
    updateCounter(textarea);

    const pasted = inputType === 'insertFromPaste' || inputType === 'insertFromDrop';
    if (result.cut && pasted) showMessage(textarea, `Shortened to ${box.max} characters`);
    else clearMessage(textarea);
  }

  function setBoxText(textarea, text, cursor) {
    textarea.value = text;
    boxes.get(textarea).last = text;
    updateCounter(textarea);
    if (cursor != null) textarea.setSelectionRange(cursor, cursor);
  }

  function updateCounter(textarea) {
    const box = boxes.get(textarea);
    box.counter.textContent = `${box.max - L.countChars(textarea.value)} left`;
  }

  function showMessage(textarea, text) {
    const box = boxes.get(textarea);
    clearTimeout(box.timer);
    // Emptying first makes screen readers announce the message again if it repeats.
    box.message.textContent = '';
    requestAnimationFrame(() => {
      box.message.textContent = text;
    });
    box.timer = setTimeout(() => clearMessage(textarea), MESSAGE_MS);
  }

  function clearMessage(textarea) {
    const box = boxes.get(textarea);
    clearTimeout(box.timer);
    box.message.textContent = '';
  }

  function forgetBox(textarea) {
    clearMessage(textarea);
    boxes.delete(textarea);
  }

  // A labelled text box with its counter, message line and (optionally) emoji button.
  function buildTextBox({ id, counterId = `${id}-counter`, label, placeholder, rows = 3, max = L.MAX_CHARS, focusKey, emojiFocusKey, value = '', emoji = true, extraClass = '' }) {
    const textarea = h('textarea', {
      id,
      class: `card-input ${extraClass}`.trim(),
      rows: String(rows),
      placeholder,
      'aria-describedby': counterId,
      'data-focus-key': focusKey,
    });
    textarea.value = value;
    const counter = h('span', { id: counterId, class: 'counter' });
    const message = h('p', { class: 'form-message', role: 'status', 'aria-live': 'polite' });
    const emojiBtn = emoji
      ? h('button', {
        type: 'button',
        class: 'emoji-btn',
        'aria-label': 'Insert emoji',
        'aria-haspopup': 'dialog',
        'aria-expanded': 'false',
        'data-focus-key': emojiFocusKey,
        text: '😊',
      })
      : null;
    if (emojiBtn) emojiBtn.addEventListener('click', () => togglePicker(emojiBtn, textarea));
    registerBox(textarea, counter, message, max);
    return { textarea, counter, message, emojiBtn, label: h('label', { class: 'visually-hidden', for: id, text: label }) };
  }

  // Enter does `enter`, Shift+Enter starts a new line (unless allowNewline is false), Escape does `escape`.
  function onEnterEscape(textarea, { enter, escape, allowNewline = true }) {
    textarea.addEventListener('keydown', (e) => {
      if (e.isComposing) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        enter();
      } else if (e.key === 'Enter' && !allowNewline) {
        e.preventDefault();
      } else if (e.key === 'Escape' && escape) {
        e.preventDefault();
        escape();
      }
    });
  }

  // --- Building the retro columns (plan §5.1; built once, never redrawn) ------

  function buildColumn(col) {
    const box = buildTextBox({
      id: `add-${col.key}`,
      counterId: `counter-${col.key}`,
      label: `New card for ${col.title}`,
      placeholder: 'Add a card…',
    });
    const form = h('form', { class: 'add-form', novalidate: true },
      box.label,
      box.textarea,
      h('div', { class: 'form-row' },
        box.emojiBtn,
        box.counter,
        h('button', { type: 'submit', class: 'btn btn-primary', text: 'Add' }),
      ),
      box.message,
    );
    const hint = h('p', { class: 'empty-hint', text: 'No cards yet — add one!' });
    const list = h('ul', {
      class: 'cards drop-zone',
      'data-zone-kind': 'card',
      'data-zone-key': col.key,
      'data-zone-group': 'retro',
      'data-min-height': String(MIN_COLUMN_HEIGHT),
      'aria-label': `${col.title} cards`,
    });

    const section = h('section', { class: `column column-${col.key}`, 'aria-labelledby': `heading-${col.key}` },
      h('h3', { id: `heading-${col.key}` }, h('span', { 'aria-hidden': 'true', text: col.emoji }), ` ${col.title}`),
      form,
      h('div', { class: 'zone-wrap' }, hint, list),
    );

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      addCardFrom(col.key, box.textarea);
    });
    onEnterEscape(box.textarea, { enter: () => addCardFrom(col.key, box.textarea) });

    columnEls[col.key] = { list, hint };
    return section;
  }

  // --- Drawing notes (plan §5.1) ---------------------------------------------

  function renderReaction(note, reaction) {
    const count = note.reactions[reaction.key];
    const wrap = h('span', { class: count === 0 ? 'reaction is-zero' : 'reaction' },
      h('button', {
        type: 'button',
        class: 'react-btn',
        'data-action': 'react',
        'data-target-id': note.id,
        'data-reaction': reaction.key,
        'data-focus-key': `${note.id}:react:${reaction.key}`,
        'aria-label': `${reaction.emoji} ${count}, add one`,
      },
        h('span', { class: 'react-emoji', 'aria-hidden': 'true', text: reaction.emoji }),
        h('span', { class: 'react-count', 'aria-hidden': 'true', text: String(count) }),
      ),
    );
    if (count > 0) {
      wrap.append(h('button', {
        type: 'button',
        class: 'unreact-btn',
        'data-action': 'unreact',
        'data-target-id': note.id,
        'data-reaction': reaction.key,
        'data-focus-key': `${note.id}:unreact:${reaction.key}`,
        'aria-label': `Remove one ${reaction.emoji}`,
        text: '−',
      }));
    }
    return wrap;
  }

  function renderNote(note) {
    const kind = noteKind(note);
    const isEditing = editing !== null && editing.id === note.id;
    const textId = `text-${note.id}`;
    const li = h('li', {
      class: kind === 'card' ? `note card note-${note.column}` : 'note health-note note-health',
      'data-note-id': note.id,
      'data-note-kind': kind,
    },
      isEditing ? editing.form : h('p', { id: textId, class: 'card-text', text: note.text }),
      h('div', { class: 'reactions', role: 'group', 'aria-label': 'Reactions' },
        ...L.REACTIONS.map((r) => renderReaction(note, r)),
      ),
      isEditing ? null : h('div', { class: 'card-actions' },
        h('button', {
          type: 'button',
          class: 'btn btn-small',
          'data-action': 'edit',
          'data-target-id': note.id,
          'data-focus-key': `${note.id}:edit`,
          'aria-describedby': textId,
          text: 'Edit',
        }),
        h('button', {
          type: 'button',
          class: 'btn btn-small btn-danger',
          'data-action': 'delete',
          'data-target-id': note.id,
          'data-focus-key': `${note.id}:delete`,
          'aria-describedby': textId,
          text: 'Delete',
        }),
      ),
    );
    if (canvasMode) {
      if (note.x === null) {
        li.style.visibility = 'hidden'; // placed by layoutZones() straight after drawing
      } else {
        li.style.left = `${note.x}px`;
        li.style.top = `${note.y}px`;
      }
      li.style.zIndex = String(note.z);
    }
    return li;
  }

  // Notes are drawn in reading order, so the Tab order matches what you see (plan §5.1).
  function drawRetro() {
    for (const col of L.COLUMNS) {
      const { list, hint } = columnEls[col.key];
      const cards = L.readingOrder(L.cardsInColumn(board, col.key));
      list.replaceChildren(...cards.map(renderNote));
      hint.hidden = cards.length > 0;
    }
  }

  // --- Drawing the health check (plan §5.13) ----------------------------------

  function renderVote(area, vote) {
    const count = area.votes[vote.key];
    const votes = `${count} vote${count === 1 ? '' : 's'}`;
    return h('td', {
      class: `vote-cell vote-${vote.key}${count === 0 ? ' is-zero' : ''}`,
      'data-label': `${vote.emoji} ${vote.label}`,
    },
      h('span', { class: 'vote-count', 'aria-hidden': 'true', text: String(count) }),
      h('div', { class: 'vote-buttons' },
        h('button', {
          type: 'button',
          class: 'vote-btn',
          'data-action': 'vote',
          'data-target-id': area.id,
          'data-vote': vote.key,
          'data-focus-key': `${area.id}:vote:${vote.key}`,
          'aria-label': `${area.name}, ${vote.label}: ${votes}. Add one`,
          text: '+1',
        }),
        count > 0
          ? h('button', {
            type: 'button',
            class: 'vote-btn unvote-btn',
            'data-action': 'unvote',
            'data-target-id': area.id,
            'data-vote': vote.key,
            'data-focus-key': `${area.id}:unvote:${vote.key}`,
            'aria-label': `Remove one ${vote.label} vote from ${area.name}`,
            text: '−',
          })
          : null,
      ),
    );
  }

  function renderArea(area) {
    const isEditing = editing !== null && editing.id === area.id;
    const parts = isEditing ? editing.parts : null;
    const nameId = `area-name-${area.id}`;

    const nameCell = h('th', { scope: 'row', class: 'area-cell', 'data-label': 'Area' },
      isEditing ? parts.name : h('span', { id: nameId, class: 'area-name', text: area.name }),
      isEditing ? parts.actions : h('div', { class: 'area-actions' },
        h('button', {
          type: 'button',
          class: 'btn btn-small',
          'data-action': 'edit',
          'data-target-id': area.id,
          'data-focus-key': `${area.id}:edit`,
          'aria-label': `Edit area ${area.name}`,
          text: 'Edit',
        }),
        h('button', {
          type: 'button',
          class: 'btn btn-small btn-danger',
          'data-action': 'delete-area',
          'data-target-id': area.id,
          'data-focus-key': `${area.id}:delete`,
          'aria-label': `Delete area ${area.name}`,
          text: 'Delete',
        }),
      ),
    );

    const example = (key, label) => h('td', { class: `example-cell example-${key}`, 'data-label': label },
      isEditing ? parts[key] : h('p', { class: 'example-text', text: area[key] }),
    );

    const adding = addingNote !== null && addingNote.areaId === area.id;
    const notes = L.readingOrder(L.healthNotesInArea(board, area.id));
    const notesCell = h('td', { class: 'notes-cell', 'data-label': 'Notes & Comments' },
      adding ? addingNote.form : h('button', {
        type: 'button',
        class: 'btn btn-small add-note-btn',
        'data-action': 'add-note',
        'data-target-id': area.id,
        'data-focus-key': `${area.id}:add-note`,
        'aria-label': `Add note to ${area.name}`,
        text: '+ Add note',
      }),
      h('ul', {
        class: 'notes drop-zone',
        'data-zone-kind': 'health',
        'data-zone-key': area.id,
        'data-zone-group': `area-${area.id}`,
        'data-min-height': String(MIN_NOTES_CELL_HEIGHT),
        'aria-label': `${area.name} notes`,
      }, ...notes.map(renderNote)),
    );

    return h('tr', { 'data-area-id': area.id },
      nameCell,
      example('awesome', 'Example of Awesome'),
      ...L.HEALTH_VOTES.map((v) => renderVote(area, v)),
      example('crappy', 'Example of Crappy'),
      notesCell,
    );
  }

  function drawHealth() {
    healthRowsEl.replaceChildren(...board.health.areas.map(renderArea));
  }

  // --- Layout on the whiteboard (plan §5.12) ----------------------------------

  // Places notes that have no position yet in the next free space, and makes each zone tall
  // enough for its notes. Zones in the same group (the three retro columns) grow together, so
  // the frame stays even. Returns the new positions.
  function layoutZones() {
    const placed = [];
    const groupHeights = new Map();
    const zones = [...boardEl.querySelectorAll('.drop-zone')];
    for (const zone of zones) {
      if (!canvasMode) {
        zone.style.height = '';
        continue;
      }
      const rects = [];
      for (const el of zone.children) {
        const note = L.findNote(board, el.dataset.noteId);
        const height = el.offsetHeight;
        if (note.x === null) {
          const spot = L.findFreeSpot(rects, { width: L.NOTE_WIDTH, height });
          placed.push({ id: note.id, ...spot });
          rects.push({ ...spot, width: L.NOTE_WIDTH, height });
        } else {
          rects.push({ x: note.x, y: note.y, width: L.NOTE_WIDTH, height });
        }
      }
      const height = L.zoneHeight(rects, Number(zone.dataset.minHeight));
      const group = zone.dataset.zoneGroup;
      groupHeights.set(group, Math.max(groupHeights.get(group) || 0, height));
    }
    if (canvasMode) {
      for (const zone of zones) zone.style.height = `${groupHeights.get(zone.dataset.zoneGroup)}px`;
    }
    return placed;
  }

  function measureHeights() {
    const heights = {};
    if (!canvasMode) return heights; // phone widths would give the wrong heights; use the guess
    for (const el of boardEl.querySelectorAll('[data-note-id]')) heights[el.dataset.noteId] = el.offsetHeight;
    return heights;
  }

  // --- Render -----------------------------------------------------------------

  function drawAll() {
    drawRetro();
    drawHealth();
  }

  // Redraws all notes and the health table. If the user was typing in a box that survives the
  // redraw (an edit or add-note box), focus and cursor go back to it. Otherwise focus goes back
  // to the element with the same focus key, or to fallbackKey if that element is gone.
  function render(focusKey, fallbackKey) {
    const active = document.activeElement;
    const key = focusKey || (active && active.dataset && active.dataset.focusKey);
    const typing = !focusKey && active && active.tagName === 'TEXTAREA'
      ? { el: active, start: active.selectionStart, end: active.selectionEnd }
      : null;

    drawAll();
    const placed = layoutZones();
    if (placed.length > 0) {
      board = L.setPositions(board, placed);
      persist();
      drawAll();
      layoutZones();
    }
    clearBtn.disabled = L.isBoardEmpty(board);

    if (typing && typing.el.isConnected) {
      if (document.activeElement !== typing.el) typing.el.focus();
      typing.el.setSelectionRange(typing.start, typing.end);
    } else if (key) {
      const target = findByFocusKey(key) || (fallbackKey && findByFocusKey(fallbackKey));
      if (target) target.focus();
    }
  }

  // --- Saving (plan §5.7) ----------------------------------------------------

  function persist() {
    if (!canPersist) return;
    if (!S.save(store, board)) {
      canPersist = false;
      showNotice(NOTICE_CANT_SAVE);
    }
  }

  function commit(focusKey, fallbackKey) {
    persist();
    render(focusKey, fallbackKey);
  }

  // --- Actions ---------------------------------------------------------------

  function addCardFrom(columnKey, textarea) {
    const text = textarea.value;
    if (L.isBlank(text)) {
      showMessage(textarea, 'Type something first 🙂');
      textarea.focus();
      return;
    }
    board = L.addCard(board, L.createCard({ id: newId(), column: columnKey, text, createdAt: Date.now() }));
    setBoxText(textarea, '');
    clearMessage(textarea);
    commit();
    textarea.focus();
  }

  boardEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { action, targetId: id } = btn.dataset;

    if (action === 'react' || action === 'unreact') {
      const reaction = btn.dataset.reaction;
      board = L.react(board, id, reaction, action === 'react' ? 1 : -1);
      // When − disappears at 0, focus moves to its reaction button.
      commit(btn.dataset.focusKey, `${id}:react:${reaction}`);
    } else if (action === 'vote' || action === 'unvote') {
      const vote = btn.dataset.vote;
      board = L.vote(board, id, vote, action === 'vote' ? 1 : -1);
      commit(btn.dataset.focusKey, `${id}:vote:${vote}`);
    } else if (action === 'edit') {
      startEdit(id);
    } else if (action === 'delete') {
      deleteNoteWithConfirm(id);
    } else if (action === 'delete-area') {
      deleteAreaWithConfirm(id);
    } else if (action === 'add-note') {
      openAddNote(id);
    }
  });

  sortBtn.addEventListener('click', () => {
    board = L.sortByVotes(board, measureHeights());
    commit();
  });

  clearBtn.addEventListener('click', () => {
    if (!window.confirm("Delete all notes and votes? This can't be undone.")) return;
    if (isPickerOpen()) closePicker(false);
    if (editing) endEdit();
    if (addingNote) dropAddNote();
    board = L.clearBoard(board);
    commit();
    // The Clear button is now disabled, so focus moves to the first add box.
    document.getElementById(`add-${L.COLUMNS[0].key}`).focus();
  });

  function deleteNoteWithConfirm(id) {
    const note = L.findNote(board, id);
    const kind = noteKind(note);
    if (!window.confirm(KIND_TEXT[kind].confirmDelete)) return;
    if (editing && editing.id === id) endEdit();
    board = L.deleteNote(board, id);
    commit();
    if (kind === 'card') document.getElementById(`add-${note.column}`).focus();
    else (findByFocusKey(`${note.areaId}:add-note`) || addingNote.textarea).focus();
  }

  // --- Health check: areas and add-note boxes (plan §5.13) --------------------

  addAreaBtn.addEventListener('click', () => {
    const id = newId();
    board = L.addArea(board, L.createArea({ id, name: 'New area', awesome: '', crappy: '' }));
    startEdit(id);
  });

  function deleteAreaWithConfirm(id) {
    if (!window.confirm('Delete this area, its votes and notes?')) return;
    const editingInArea = editing && (editing.id === id || L.healthNotesInArea(board, id).some((n) => n.id === editing.id));
    if (editingInArea) endEdit();
    if (addingNote && addingNote.areaId === id) dropAddNote();
    board = L.deleteArea(board, id);
    commit();
    addAreaBtn.focus();
  }

  function buildAddNoteForm(areaId) {
    const area = findArea(areaId);
    const box = buildTextBox({
      id: `add-note-${areaId}`,
      label: `New note for ${area.name}`,
      placeholder: 'Add a note…',
      focusKey: `${areaId}:add-note-text`,
    });
    const cancelBtn = h('button', { type: 'button', class: 'btn', text: 'Cancel' });
    const addBtn = h('button', { type: 'button', class: 'btn btn-primary', text: 'Add' });
    const form = h('div', { class: 'add-note-form' },
      box.label,
      box.textarea,
      h('div', { class: 'form-row' }, box.emojiBtn, box.counter, cancelBtn, addBtn),
      box.message,
    );
    onEnterEscape(box.textarea, { enter: submitAddNote, escape: cancelAddNote });
    addBtn.addEventListener('click', submitAddNote);
    cancelBtn.addEventListener('click', cancelAddNote);
    return { areaId, form, textarea: box.textarea };
  }

  // Only one add box is open at a time. Opening another adds what was typed in the first.
  function openAddNote(areaId) {
    if (addingNote) {
      const { areaId: openId, textarea } = addingNote;
      if (!L.isBlank(textarea.value)) board = addHealthNote(openId, textarea.value);
      dropAddNote();
    }
    addingNote = buildAddNoteForm(areaId);
    commit(`${areaId}:add-note-text`);
  }

  function addHealthNote(areaId, text) {
    return L.addHealthNote(board, L.createHealthNote({ id: newId(), areaId, text, createdAt: Date.now() }));
  }

  function submitAddNote() {
    const { areaId, textarea } = addingNote;
    if (L.isBlank(textarea.value)) {
      showMessage(textarea, 'Type something first 🙂');
      textarea.focus();
      return;
    }
    board = addHealthNote(areaId, textarea.value);
    setBoxText(textarea, '');
    clearMessage(textarea);
    commit();
    textarea.focus();
  }

  function cancelAddNote() {
    const { areaId } = addingNote;
    dropAddNote();
    render(`${areaId}:add-note`);
  }

  function dropAddNote() {
    forgetBox(addingNote.textarea);
    addingNote = null;
  }

  // --- Editing: one slot for cards, health notes and areas (plan §5.6) -------

  function editButtons() {
    const saveBtn = h('button', { type: 'button', class: 'btn btn-primary', text: 'Save' });
    const cancelBtn = h('button', { type: 'button', class: 'btn', text: 'Cancel' });
    saveBtn.addEventListener('click', saveEdit);
    cancelBtn.addEventListener('click', cancelEdit);
    return { saveBtn, cancelBtn };
  }

  function buildNoteEdit(note) {
    const words = KIND_TEXT[noteKind(note)];
    const box = buildTextBox({
      id: `edit-${note.id}`,
      counterId: `edit-counter-${note.id}`,
      label: `Edit ${words.name}`,
      focusKey: `${note.id}:edit-text`,
      emojiFocusKey: `${note.id}:edit-emoji`,
      value: note.text,
    });
    const { saveBtn, cancelBtn } = editButtons();
    const form = h('div', { class: 'edit-form' },
      box.label,
      box.textarea,
      h('div', { class: 'form-row' }, box.emojiBtn, box.counter, cancelBtn, saveBtn),
      box.message,
    );
    onEnterEscape(box.textarea, { enter: saveEdit, escape: cancelEdit });

    return {
      id: note.id,
      form,
      textareas: [box.textarea],
      focusKey: `${note.id}:edit-text`,
      canSave: () => !L.isBlank(box.textarea.value),
      apply: (b) => L.editNote(b, note.id, box.textarea.value),
      complain() {
        showMessage(box.textarea, words.empty);
        box.textarea.focus();
      },
      afterOpen() {
        const end = box.textarea.value.length;
        box.textarea.setSelectionRange(end, end);
      },
    };
  }

  function buildAreaEdit(area) {
    const field = (key, label, value, max, rows) => buildTextBox({
      id: `area-${key}-${area.id}`,
      label,
      rows,
      max,
      value,
      emoji: false,
      focusKey: `${area.id}:edit-${key}`,
      extraClass: `area-input area-input-${key}`,
    });
    const name = field('name', 'Area name', area.name, L.AREA_NAME_MAX, 1);
    const awesome = field('awesome', 'Example of Awesome', area.awesome, L.MAX_CHARS, 4);
    const crappy = field('crappy', 'Example of Crappy', area.crappy, L.MAX_CHARS, 4);
    const { saveBtn, cancelBtn } = editButtons();

    onEnterEscape(name.textarea, { enter: saveEdit, escape: cancelEdit, allowNewline: false });
    onEnterEscape(awesome.textarea, { enter: saveEdit, escape: cancelEdit });
    onEnterEscape(crappy.textarea, { enter: saveEdit, escape: cancelEdit });

    const fieldBlock = (f) => h('div', { class: 'area-field' }, f.label, f.textarea, h('div', { class: 'form-row' }, f.counter), f.message);

    return {
      id: area.id,
      parts: {
        name: fieldBlock(name),
        actions: h('div', { class: 'form-row area-edit-actions' }, cancelBtn, saveBtn),
        awesome: fieldBlock(awesome),
        crappy: fieldBlock(crappy),
      },
      textareas: [name.textarea, awesome.textarea, crappy.textarea],
      focusKey: `${area.id}:edit-name`,
      canSave: () => L.isValidAreaName(name.textarea.value),
      apply: (b) => L.editArea(b, area.id, {
        name: name.textarea.value,
        awesome: awesome.textarea.value,
        crappy: crappy.textarea.value,
      }),
      complain() {
        showMessage(name.textarea, 'An area needs a name');
        name.textarea.focus();
      },
      afterOpen() {
        name.textarea.select();
      },
    };
  }

  function startEdit(id) {
    if (editing) {
      if (editing.id === id) return;
      // Switching saves the current edit, or puts it back if it can't be saved.
      if (editing.canSave()) board = editing.apply(board);
      endEdit();
    }
    const area = findArea(id);
    if (area) {
      editing = buildAreaEdit(area);
    } else {
      editing = buildNoteEdit(L.findNote(board, id));
      board = L.bringToFront(board, id);
    }
    commit(editing.focusKey);
    editing.afterOpen();
  }

  function saveEdit() {
    if (!editing.canSave()) {
      editing.complain();
      return;
    }
    const { id } = editing;
    board = editing.apply(board);
    endEdit();
    commit(`${id}:edit`);
  }

  function cancelEdit() {
    const { id } = editing;
    endEdit();
    render(`${id}:edit`);
  }

  function endEdit() {
    editing.textareas.forEach(forgetBox);
    editing = null;
  }

  // --- Emoji picker (plan §5.3) ----------------------------------------------

  const picker = { buttons: [], index: 0, opener: null, textarea: null, start: 0, end: 0 };

  function buildPicker() {
    picker.buttons = L.PICKER_EMOJIS.map((emoji, i) => h('button', {
      type: 'button',
      class: 'picker-emoji',
      tabindex: i === 0 ? '0' : '-1',
      'aria-label': emoji,
      text: emoji,
    }));
    pickerEl.append(h('div', { class: 'picker-grid' }, ...picker.buttons));

    pickerEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.picker-emoji');
      if (btn) pickEmoji(btn.textContent);
    });
    pickerEl.addEventListener('keydown', onPickerKey);
    document.addEventListener('pointerdown', onPointerOutside, true);
    window.addEventListener('resize', () => {
      if (picker.opener) positionPicker(picker.opener);
    });
  }

  function isPickerOpen() {
    return picker.textarea !== null;
  }

  function togglePicker(opener, textarea) {
    if (isPickerOpen()) {
      const same = picker.opener === opener;
      closePicker(true);
      if (same) return;
    }
    picker.opener = opener;
    picker.textarea = textarea;
    picker.start = textarea.selectionStart;
    picker.end = textarea.selectionEnd;
    opener.setAttribute('aria-expanded', 'true');
    pickerEl.hidden = false;
    positionPicker(opener);
    focusPickerEmoji(0);
  }

  function closePicker(returnFocus) {
    const { opener, textarea, start, end } = picker;
    pickerEl.hidden = true;
    opener.setAttribute('aria-expanded', 'false');
    picker.opener = null;
    picker.textarea = null;
    if (returnFocus) restoreCursor(textarea, start, end);
  }

  function restoreCursor(textarea, start, end) {
    if (!textarea.isConnected) return;
    textarea.focus();
    textarea.setSelectionRange(start, end);
  }

  function positionPicker(opener) {
    const rect = opener.getBoundingClientRect();
    const maxLeft = document.documentElement.clientWidth - pickerEl.offsetWidth - 8;
    const left = Math.max(8, Math.min(rect.left, maxLeft));
    pickerEl.style.left = `${left + window.scrollX}px`;
    pickerEl.style.top = `${rect.bottom + 6 + window.scrollY}px`;
  }

  function focusPickerEmoji(index) {
    const last = picker.buttons.length - 1;
    picker.index = Math.max(0, Math.min(index, last));
    picker.buttons.forEach((btn, i) => btn.setAttribute('tabindex', i === picker.index ? '0' : '-1'));
    picker.buttons[picker.index].focus();
  }

  function onPickerKey(e) {
    const moves = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: PICKER_COLUMNS, ArrowUp: -PICKER_COLUMNS };
    if (e.key in moves) {
      e.preventDefault();
      focusPickerEmoji(picker.index + moves[e.key]);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusPickerEmoji(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusPickerEmoji(picker.buttons.length - 1);
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      closePicker(true);
    }
  }

  function onPointerOutside(e) {
    if (!isPickerOpen()) return;
    if (pickerEl.contains(e.target) || picker.opener.contains(e.target)) return;
    const { textarea, start, end } = picker;
    closePicker(false);
    // Don't pull focus away from another control the user is clicking. Otherwise wait until
    // the click has finished, because clicking empty page would take focus away again.
    if (!e.target.closest('button, textarea, input, select, a')) {
      setTimeout(() => restoreCursor(textarea, start, end), 0);
    }
  }

  function pickEmoji(emoji) {
    const { textarea, start, end } = picker;
    closePicker(true);
    const { max } = boxes.get(textarea);
    const result = L.insertAt(textarea.value, start, end, emoji, max);
    if (!result) {
      showMessage(textarea, `No room for that emoji — ${max} characters max`);
      return;
    }
    setBoxText(textarea, result.text, result.cursor);
    clearMessage(textarea);
  }

  // --- Whiteboard (plan §5.10, §5.11) ----------------------------------------

  const canvas = window.RetroCanvas.createCanvas({
    viewport: viewportEl,
    world: worldEl,
    topInset: () => topbarEl.getBoundingClientRect().bottom,
    onViewChange(view, byUser) {
      zoomLabelEl.textContent = `${Math.round(view.zoom * 100)}%`;
      // The picker would float away from its text box, so it closes when the user moves the board.
      if (byUser && isPickerOpen()) closePicker(false);
      board = { ...board, view };
      clearTimeout(viewSaveTimer);
      viewSaveTimer = setTimeout(persist, VIEW_SAVE_MS);
    },
    canDrop: (noteEl, zoneEl) => noteEl.dataset.noteKind === zoneEl.dataset.zoneKind,
    onDrop(noteEl, zoneEl, x, y) {
      const id = noteEl.dataset.noteId;
      board = L.bringToFront(L.moveNote(board, id, zoneEl.dataset.zoneKey, x, y), id);
      commit();
    },
  });

  document.getElementById('zoom-in').addEventListener('click', () => canvas.zoomStep(+1));
  document.getElementById('zoom-out').addEventListener('click', () => canvas.zoomStep(-1));
  document.getElementById('zoom-fit').addEventListener('click', () => canvas.fit(true));

  function applyMode() {
    document.body.classList.toggle('is-canvas', canvasMode);
    canvas.setEnabled(canvasMode);
    if (isPickerOpen()) closePicker(false);
    render();
    if (!canvasMode) return;
    if (board.view) canvas.setView(board.view);
    else canvas.fit();
  }

  wideQuery.addEventListener('change', (e) => {
    canvasMode = e.matches;
    applyMode();
  });

  // --- Start -----------------------------------------------------------------

  retroBodyEl.append(...L.COLUMNS.map(buildColumn));
  buildPicker();
  applyMode();

  if (!canPersist) showNotice(NOTICE_CANT_SAVE);
  else if (loaded.damaged) showNotice(NOTICE_DAMAGED);
})();
