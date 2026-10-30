// Draws the board and handles clicks and keys. The rules live in logic.js, this browser's settings
// in storage.js, talking to AWS in cloud.js, and pan, zoom and dragging in canvas.js.
// [v3] The board is shared: every action is sent to AWS, and is shown once AWS confirms it.
// Changes from teammates arrive live and go through the same L.applyChange (plan §5.16).
(function () {
  'use strict';

  const L = window.RetroLogic;
  const S = window.RetroStorage;
  const C = window.RetroCloud;

  const MESSAGE_MS = 4000;
  const PICKER_COLUMNS = 4;
  const VIEW_SAVE_MS = 500;
  const RELOAD_RETRY_MS = 3000;
  const MIN_COLUMN_HEIGHT = 420;
  // Small, so 11 empty areas still fit on screen; a cell grows as soon as notes are added.
  const MIN_NOTES_CELL_HEIGHT = 72;

  const NOTICE_CANT_SAVE = "This browser can't remember you, so after a refresh you won't be able to edit or delete the notes you added.";
  const TEXT_OPENING = 'Opening the board…';
  const TEXT_CREATING = 'Starting a new board…';
  const TEXT_MISSING = "This board doesn't exist or has been deleted.";
  const TEXT_UNREACHABLE = "Can't reach the shared board. Check your connection and try again.";
  const TEXT_LOST = 'Connection lost. Reconnecting…';
  const TEXT_OFFLINE = "You're offline. Your text is kept; add it when the connection is back.";
  const TEXT_FULL = `This board is full (${L.MAX_NOTES} notes)`;
  const TEXT_NOT_SENT = "Couldn't reach the shared board, so that change wasn't saved.";

  // What to say when AWS refuses a change (plan §5.17). The board is then reloaded.
  const REFUSALS = {
    NotYours: 'You can only change your own notes.',
    NotFacilitator: 'Only the facilitator can do that.',
    BoardChanged: 'The board changed meanwhile, so it has been reloaded.',
    NoteMissing: 'That note changed meanwhile, so the board has been reloaded.',
  };

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
  const copyLinkBtn = document.getElementById('copy-link-btn');
  const newBoardBtn = document.getElementById('new-board-btn');
  const bannerEl = document.getElementById('connection-banner');
  const appMessageEl = document.getElementById('app-message');
  const linkBoxEl = document.getElementById('link-box');
  const linkInputEl = document.getElementById('link-input');
  const statusScreenEl = document.getElementById('status-screen');
  const statusTextEl = document.getElementById('status-text');
  const statusBtn = document.getElementById('status-btn');

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

  const canRemember = S.canSave(store);
  // This browser's secret, last board and whether its old board has been moved (plan §4).
  let settings = S.loadSettings(canRemember ? store : null, C.makeId);
  const client = C.createClient(window.RetroConfig);

  let board = null; // the shared board, once loaded: a v2 board plus `sync` and `mine` (logic.js)
  let boardId = null;
  let connection = 'connecting'; // 'connecting', 'live' or 'lost' (plan §5.18)
  let watcher = null;
  let reloading = false;
  let reloadTimer = null;
  let buffered = []; // { change, mine } for changes that arrive while the board is reloading
  let renderPending = false; // a redraw waiting for a drag to finish
  let currentView = null;
  let appMessageTimer = null;

  const columnEls = {}; // column key -> { list, hint }
  const boxes = new Map(); // textarea -> { last, max, counter, message, timer }
  const sendingFrom = new Set(); // add boxes whose note is on its way to AWS
  // Notes placed here whose place hasn't been sent yet. A note of mine can be drawn before
  // AWS's answer says it's mine; its place is sent once it is (plan §5.20).
  const placedHere = new Set();
  // The one thing being edited: a card, a health note or an area (plan §5.6).
  // { id, textareas, focusKey, canSave(), save(), complain(), afterOpen(), ...its elements }
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

  function findByFocusKey(key) {
    return document.querySelector(`[data-focus-key="${CSS.escape(key)}"]`);
  }

  function showNotice(text) {
    noticeEl.textContent = text;
    noticeEl.hidden = false;
  }

  // A short message for the whole page, such as "Link copied" or a refusal from AWS.
  function flash(text) {
    clearTimeout(appMessageTimer);
    appMessageEl.textContent = '';
    appMessageEl.hidden = false;
    requestAnimationFrame(() => {
      appMessageEl.textContent = text;
    });
    appMessageTimer = setTimeout(() => {
      appMessageEl.hidden = true;
    }, MESSAGE_MS);
  }

  function noteKind(note) {
    return 'column' in note ? 'card' : 'health';
  }

  function findArea(id) {
    return board.health.areas.find((a) => a.id === id);
  }

  function isLive() {
    return connection === 'live';
  }

  // A note's place, as moveNotes expects it.
  function moveOf(note) {
    const place = noteKind(note) === 'card' ? { column: note.column } : { areaId: note.areaId };
    return { id: note.id, x: note.x, y: note.y, z: note.z, ...place };
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
      // Edit and Delete only on my own notes (spec Stories 6, 18).
      isEditing || !L.canChangeNote(note) ? null : h('div', { class: 'card-actions' },
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

    // Only the facilitator changes areas (spec Story 15).
    const nameCell = h('th', { scope: 'row', class: 'area-cell', 'data-label': 'Area' },
      isEditing ? parts.name : h('span', { id: nameId, class: 'area-name', text: area.name }),
      isEditing ? parts.actions : !L.canManageBoard(board) ? null : h('div', { class: 'area-actions' },
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
    if (!board) return;
    // A note being pressed or dragged mustn't be redrawn; draw once it's dropped (plan §5.16).
    if (canvas.activeNoteId()) {
      renderPending = true;
      return;
    }
    renderPending = false;
    const active = document.activeElement;
    const key = focusKey || (active && active.dataset && active.dataset.focusKey);
    const typing = !focusKey && active && active.tagName === 'TEXTAREA'
      ? { el: active, start: active.selectionStart, end: active.selectionEnd }
      : null;

    drawAll();
    const placed = layoutZones();
    if (placed.length > 0) {
      board = L.setPositions(board, placed);
      drawAll();
      layoutZones();
      placed.forEach((p) => placedHere.add(p.id));
    }
    sendMyPlacements();
    applyAvailability();

    if (typing && typing.el.isConnected) {
      if (document.activeElement !== typing.el) typing.el.focus();
      typing.el.setSelectionRange(typing.start, typing.end);
    } else if (key) {
      const target = findByFocusKey(key) || (fallbackKey && findByFocusKey(fallbackKey));
      if (target) target.focus();
    }
  }

  // Each person places their own new notes, and tells everyone where (plan §5.20).
  // Others' notes placed here wait for their owner's move; notes that have gone are forgotten.
  function sendMyPlacements() {
    if (!isLive()) return;
    const mine = [];
    for (const id of placedHere) {
      const note = L.findNote(board, id);
      if (!note) placedHere.delete(id);
      else if (L.canChangeNote(note)) {
        placedHere.delete(id);
        mine.push(moveOf(note));
      }
    }
    if (mine.length > 0) sendMoves(mine);
  }

  // While the connection is lost, everything that changes the board is paused (spec Story 19.1),
  // and the facilitator's buttons are shown to the facilitator only (spec Stories 8.5, 15.0).
  const CHANGING_BUTTONS = [
    'button[data-action]',
    '.add-form button[type="submit"]',
    '.add-note-form .btn-primary',
    '.edit-form .btn-primary',
    '.area-edit-actions .btn-primary',
  ].join(', ');

  function applyAvailability() {
    const live = isLive();
    const manager = board !== null && L.canManageBoard(board);
    for (const btn of boardEl.querySelectorAll(CHANGING_BUTTONS)) btn.disabled = !live;
    sortBtn.disabled = !live;
    clearBtn.hidden = !manager;
    clearBtn.disabled = !live || board === null || L.isBoardEmpty(board);
    addAreaBtn.hidden = !manager;
    addAreaBtn.disabled = !live;
    bannerEl.hidden = connection !== 'lost';
    if (!bannerEl.hidden && bannerEl.textContent !== TEXT_LOST) bannerEl.textContent = TEXT_LOST;
  }

  // --- Talking to AWS (plan §5.15–5.18) --------------------------------------

  // Applies one confirmed change to the board and redraws. My own changes come back twice
  // (as the answer, then live); applyChange uses each one once.
  function receive(change, { mine = false, focusKey, fallbackKey } = {}) {
    if (!board || change.boardId !== board.sync.boardId) return;
    if (reloading) {
      buffered.push({ change, mine });
      return;
    }
    board = L.applyChange(board, change, { mine, draggingId: canvas.activeNoteId() });
    dropStaleUi();
    render(focusKey, fallbackKey);
  }

  // Sends one change to AWS. Returns the confirmed change, or null if it was refused or couldn't be sent.
  async function send(name, args, focus = {}) {
    try {
      const change = await client.mutate(name, { boardId, ...args });
      receive(change, { mine: true, ...focus });
      return change;
    } catch (e) {
      refused(e);
      return null;
    }
  }

  function refused(e) {
    if (!(e instanceof C.CloudError)) throw e;
    if (e.type === 'Network') {
      flash(TEXT_NOT_SENT);
      return;
    }
    flash(REFUSALS[e.type] || 'Something went wrong, so the board has been reloaded.');
    reload();
  }

  async function sendMoves(moves) {
    for (const piece of L.chunk(moves)) {
      if (!(await send('moveNotes', { moves: piece }))) return;
    }
  }

  // Deletes notes that are already hidden, after a Clear or a deleted area. Facilitator only;
  // if it fails, the leftovers stay hidden (plan §4).
  async function removeHidden(ids) {
    for (const noteIds of L.chunk(ids)) {
      try {
        await client.mutate('removeNotes', { boardId, secret: settings.secret, noteIds });
      } catch (e) {
        return;
      }
    }
  }

  // Loads the whole board from AWS again: after every (re)connect, and after a refusal,
  // rather than trusting that every live change arrived (plan §5.16).
  async function reload() {
    const id = boardId;
    if (reloading || !id) return;
    reloading = true;
    buffered = [];
    clearTimeout(reloadTimer);
    let next = null;
    try {
      const info = await client.getBoard(id, settings.secret);
      if (info) next = L.boardFromServer(info, await client.listAllNotes(id, settings.secret, info.generation));
    } catch (e) {
      if (!(e instanceof C.CloudError)) throw e;
      reloading = false;
      if (id === boardId) reloadTimer = setTimeout(reload, RELOAD_RETRY_MS);
      return;
    }
    reloading = false;
    if (id !== boardId) return;
    if (!next) {
      showStatus(TEXT_MISSING, 'Start a new board', createBoard);
      return;
    }
    // A new area still being drafted here isn't on AWS yet, so it's kept.
    const draft = editing && editing.isNew ? findArea(editing.id) : null;
    if (draft) next = L.addArea(next, draft);
    for (const { change, mine } of buffered) next = L.applyChange(next, change, { mine, draggingId: canvas.activeNoteId() });
    buffered = [];
    board = next;
    dropStaleUi();
    render();
  }

  // An edit or add box whose note or area has gone (deleted, or cleared by the facilitator) closes.
  function dropStaleUi() {
    if (editing && !editing.isNew && !findArea(editing.id) && !L.findNote(board, editing.id)) endEdit();
    if (addingNote && !findArea(addingNote.areaId)) dropAddNote();
  }

  function setConnection(state) {
    connection = state;
    if (state === 'live') reload();
    if (board) applyAvailability();
  }

  // --- Actions ---------------------------------------------------------------

  // Sends a new note. If the board was cleared meanwhile, reloads and tries once more, so the
  // typed text isn't lost (spec Story 8.6). Returns true once AWS has it.
  async function sendNewNote(note, retried = false) {
    try {
      const change = await client.mutate('addNotes', {
        boardId, secret: settings.secret, generation: board.sync.generation, notes: [L.noteToServer(note)],
      });
      receive(change, { mine: true });
      return true;
    } catch (e) {
      if (!(e instanceof C.CloudError) || e.type !== 'BoardChanged' || retried) {
        refused(e);
        return false;
      }
      await reload();
      if (!board || L.isBoardFull(board)) {
        flash(TEXT_FULL);
        return false;
      }
      return sendNewNote(note, true);
    }
  }

  // Checks shared by every add box. Returns true if the note can be sent.
  function canSendFrom(textarea) {
    if (L.isBlank(textarea.value)) {
      showMessage(textarea, 'Type something first 🙂');
      textarea.focus();
      return false;
    }
    if (!isLive()) {
      showMessage(textarea, TEXT_OFFLINE);
      return false;
    }
    if (L.isBoardFull(board)) {
      showMessage(textarea, TEXT_FULL);
      return false;
    }
    return !sendingFrom.has(textarea);
  }

  // The box is emptied only once AWS has the note, and only if nobody typed more meanwhile.
  async function sendFromBox(textarea, note) {
    sendingFrom.add(textarea);
    const sent = await sendNewNote(note);
    sendingFrom.delete(textarea);
    if (sent && textarea.isConnected && textarea.value === note.text) {
      setBoxText(textarea, '');
      clearMessage(textarea);
    }
  }

  function addCardFrom(columnKey, textarea) {
    if (!canSendFrom(textarea)) return;
    sendFromBox(textarea, L.createCard({ id: C.makeId(), column: columnKey, text: textarea.value, createdAt: Date.now() }));
    textarea.focus();
  }

  boardEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn || !isLive()) return;
    const { action, targetId: id } = btn.dataset;

    if (action === 'react' || action === 'unreact') {
      const reaction = btn.dataset.reaction;
      // When − disappears at 0, focus moves to its reaction button.
      send('react', { noteId: id, reaction, delta: action === 'react' ? 1 : -1 },
        { focusKey: btn.dataset.focusKey, fallbackKey: `${id}:react:${reaction}` });
    } else if (action === 'vote' || action === 'unvote') {
      const vote = btn.dataset.vote;
      send('vote', { areaId: id, kind: vote, delta: action === 'vote' ? 1 : -1 },
        { focusKey: btn.dataset.focusKey, fallbackKey: `${id}:vote:${vote}` });
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

  // Sorts here straight away, then tells everyone the new places (spec Story 5.6).
  sortBtn.addEventListener('click', () => {
    board = L.sortByVotes(board, measureHeights());
    render();
    sendMoves(L.cardMoves(board));
  });

  clearBtn.addEventListener('click', async () => {
    if (!window.confirm("Delete all notes and votes? This can't be undone.")) return;
    if (isPickerOpen()) closePicker(false);
    if (editing) endEdit();
    const hidden = [...board.cards, ...board.health.notes].map((n) => n.id);
    const change = await send('clearBoard', { secret: settings.secret, areaIds: board.health.areas.map((a) => a.id) });
    if (!change) return;
    // The Clear button is now disabled, so focus moves to the first add box.
    document.getElementById(`add-${L.COLUMNS[0].key}`).focus();
    removeHidden(hidden);
  });

  async function deleteNoteWithConfirm(id) {
    const note = L.findNote(board, id);
    const kind = noteKind(note);
    if (!window.confirm(KIND_TEXT[kind].confirmDelete)) return;
    if (editing && editing.id === id) endEdit();
    const change = await send('deleteNote', { secret: settings.secret, generation: board.sync.generation, noteId: id });
    if (!change) return;
    if (kind === 'card') document.getElementById(`add-${note.column}`).focus();
    else {
      const target = findByFocusKey(`${note.areaId}:add-note`) || (addingNote && addingNote.textarea);
      if (target) target.focus();
    }
  }

  // --- Health check: areas and add-note boxes (plan §5.13) --------------------

  // A new area is a draft here until it's saved; only then does AWS get it.
  addAreaBtn.addEventListener('click', () => {
    if (!isLive()) return;
    const id = C.makeId();
    const area = { ...L.createArea({ id, name: 'New area', awesome: '', crappy: '' }), order: L.nextAreaOrder(board) };
    board = L.addArea(board, area);
    startEdit(id, { isNew: true });
  });

  async function deleteAreaWithConfirm(id) {
    if (!window.confirm('Delete this area, its votes and notes?')) return;
    const notes = L.healthNotesInArea(board, id);
    const editingInArea = editing && (editing.id === id || notes.some((n) => n.id === editing.id));
    if (editingInArea) endEdit();
    if (addingNote && addingNote.areaId === id) dropAddNote();
    const change = await send('deleteArea', { secret: settings.secret, areaId: id, removedNotes: notes.length });
    if (!change) return;
    addAreaBtn.focus();
    removeHidden(notes.map((n) => n.id));
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

  function newHealthNote(areaId, text) {
    return L.createHealthNote({ id: C.makeId(), areaId, text, createdAt: Date.now() });
  }

  // Only one add box is open at a time. Opening another adds what was typed in the first.
  function openAddNote(areaId) {
    if (addingNote) {
      const { areaId: openId, textarea } = addingNote;
      if (!L.isBlank(textarea.value) && !L.isBoardFull(board)) sendNewNote(newHealthNote(openId, textarea.value));
      dropAddNote();
    }
    addingNote = buildAddNoteForm(areaId);
    render(`${areaId}:add-note-text`);
  }

  function submitAddNote() {
    const { areaId, textarea } = addingNote;
    if (!canSendFrom(textarea)) return;
    sendFromBox(textarea, newHealthNote(areaId, textarea.value));
    textarea.focus();
  }

  function cancelAddNote() {
    const { areaId } = addingNote;
    dropAddNote();
    render(`${areaId}:add-note`);
  }

  function dropAddNote() {
    forgetBox(addingNote.textarea);
    sendingFrom.delete(addingNote.textarea);
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
      // Shows the new text straight away; if AWS refuses, the old text comes back (plan §5.20).
      save() {
        const text = box.textarea.value;
        const before = L.findNote(board, note.id);
        if (!before || before.text === text) return;
        board = L.editNote(board, note.id, text);
        send('editNote', { secret: settings.secret, noteId: note.id, text }).then((change) => {
          if (change || !L.findNote(board, note.id)) return;
          board = L.editNote(board, note.id, before.text);
          render();
        });
      },
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

  function buildAreaEdit(area, isNew) {
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
      isNew,
      parts: {
        name: fieldBlock(name),
        actions: h('div', { class: 'form-row area-edit-actions' }, cancelBtn, saveBtn),
        awesome: fieldBlock(awesome),
        crappy: fieldBlock(crappy),
      },
      textareas: [name.textarea, awesome.textarea, crappy.textarea],
      focusKey: `${area.id}:edit-name`,
      canSave: () => L.isValidAreaName(name.textarea.value),
      save() {
        const fields = { name: name.textarea.value, awesome: awesome.textarea.value, crappy: crappy.textarea.value };
        const current = findArea(area.id);
        if (!current) return;
        board = L.editArea(board, area.id, fields);
        const sent = { id: area.id, ...fields, order: current.order };
        send('saveArea', { secret: settings.secret, area: sent, isNew }).then((change) => {
          // A new area that AWS didn't take is removed again; an edit is put right by the reload.
          if (!change && isNew && findArea(area.id)) {
            board = L.deleteArea(board, area.id);
            render();
          }
        });
      },
      // A new area that's cancelled, or can't be saved, was never on AWS, so it simply goes.
      discard() {
        if (isNew) board = L.deleteArea(board, area.id);
      },
      complain() {
        showMessage(name.textarea, 'An area needs a name');
        name.textarea.focus();
      },
      afterOpen() {
        name.textarea.select();
      },
    };
  }

  function startEdit(id, { isNew = false } = {}) {
    if (editing) {
      if (editing.id === id) return;
      // Switching saves the current edit, or puts it back if it can't be saved.
      const previous = editing;
      endEdit();
      if (previous.canSave()) previous.save();
      else if (previous.discard) previous.discard();
    }
    const area = findArea(id);
    if (area) {
      editing = buildAreaEdit(area, isNew);
    } else {
      editing = buildNoteEdit(L.findNote(board, id));
      board = L.bringToFront(board, id);
    }
    render(editing.focusKey);
    editing.afterOpen();
  }

  function saveEdit() {
    if (!isLive()) return;
    if (!editing.canSave()) {
      editing.complain();
      return;
    }
    const current = editing;
    endEdit();
    current.save();
    render(`${current.id}:edit`);
  }

  function cancelEdit() {
    const current = editing;
    endEdit();
    if (current.discard) current.discard();
    render(current.isNew ? null : `${current.id}:edit`);
    if (current.isNew) addAreaBtn.focus();
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
      currentView = view;
      // Zoom and position are mine alone, kept in this browser per board (spec Story 7.2).
      const id = boardId;
      clearTimeout(viewSaveTimer);
      viewSaveTimer = setTimeout(() => {
        if (id && canRemember) S.saveView(store, id, view);
      }, VIEW_SAVE_MS);
    },
    // While offline, a dropped note slides back (spec Story 19.1).
    canDrop: (noteEl, zoneEl) => isLive() && noteEl.dataset.noteKind === zoneEl.dataset.zoneKind,
    // Anyone may move any note (spec Story 11.8). It moves here at once, then everyone is told.
    onDrop(noteEl, zoneEl, x, y) {
      const id = noteEl.dataset.noteId;
      board = L.bringToFront(L.moveNote(board, id, zoneEl.dataset.zoneKey, x, y), id);
      const move = moveOf(L.findNote(board, id));
      send('moveNotes', { moves: [move] });
    },
    onSettle() {
      render();
    },
  });

  document.getElementById('zoom-in').addEventListener('click', () => canvas.zoomStep(+1));
  document.getElementById('zoom-out').addEventListener('click', () => canvas.zoomStep(-1));
  document.getElementById('zoom-fit').addEventListener('click', () => canvas.fit(true));

  function applyMode() {
    document.body.classList.toggle('is-canvas', canvasMode);
    canvas.setEnabled(canvasMode && board !== null);
    if (isPickerOpen()) closePicker(false);
    if (!board) return;
    render();
    if (!canvasMode) return;
    const view = currentView || (canRemember ? S.loadView(store, boardId) : null);
    if (view) canvas.setView(view);
    else canvas.fit();
  }

  wideQuery.addEventListener('change', (e) => {
    canvasMode = e.matches;
    applyMode();
  });

  // --- Opening, creating and sharing boards (plan §5.19) ----------------------

  function boardIdFromAddress() {
    const match = /^#board=([\w-]{1,64})$/.exec(window.location.hash);
    return match ? match[1] : null;
  }

  function linkTo(id) {
    return `${window.location.href.split('#')[0]}#board=${id}`;
  }

  // Shows a message in place of the board, with an optional button.
  function showStatus(text, buttonText, onClick) {
    stopWatching();
    board = null;
    boardEl.hidden = true;
    canvas.setEnabled(false);
    statusScreenEl.hidden = false;
    statusTextEl.textContent = text;
    statusBtn.hidden = !buttonText;
    statusBtn.textContent = buttonText || '';
    statusBtn.onclick = onClick || null;
    for (const btn of [copyLinkBtn, sortBtn, clearBtn]) btn.hidden = true;
    bannerEl.hidden = true;
    if (buttonText) statusBtn.focus();
  }

  function stopWatching() {
    if (watcher) watcher.stop();
    watcher = null;
    clearTimeout(reloadTimer);
  }

  function resetUi() {
    if (isPickerOpen()) closePicker(false);
    if (editing) endEdit();
    if (addingNote) dropAddNote();
    linkBoxEl.hidden = true;
    currentView = null;
  }

  async function openBoard(id) {
    stopWatching();
    resetUi();
    boardId = id;
    connection = 'connecting';
    showStatus(TEXT_OPENING);
    let info;
    let notes;
    try {
      info = await client.getBoard(id, settings.secret);
      if (info) notes = await client.listAllNotes(id, settings.secret, info.generation);
    } catch (e) {
      if (!(e instanceof C.CloudError)) throw e;
      if (id === boardId) showStatus(TEXT_UNREACHABLE, 'Try again', () => openBoard(id));
      return;
    }
    if (id !== boardId) return;
    if (!info) {
      showStatus(TEXT_MISSING, 'Start a new board', createBoard);
      return;
    }

    board = L.boardFromServer(info, notes);
    settings = { ...settings, lastBoardId: id };
    if (canRemember) S.saveSettings(store, settings);
    if (window.location.hash !== `#board=${id}`) window.history.replaceState(null, '', linkTo(id));

    statusScreenEl.hidden = true;
    boardEl.hidden = false;
    for (const btn of [copyLinkBtn, sortBtn]) btn.hidden = false;
    applyMode();
    watcher = client.watch(id, { onChange: (change) => receive(change), onState: setConnection });
  }

  // Creates a board with this browser as its facilitator. The first board created in a browser
  // starts with the board saved there by v1 or v2, if any (spec Story 20).
  async function createBoard() {
    stopWatching();
    resetUi();
    const id = C.makeId();
    boardId = id;
    showStatus(TEXT_CREATING);
    const old = S.boardToMove(canRemember ? store : null, settings);
    try {
      await client.mutate('createBoard', { boardId: id, secret: settings.secret, ...L.areasToServer(old || L.emptyBoard()) });
      if (old) {
        const notes = [...old.cards, ...old.health.notes].slice(0, L.MAX_NOTES).map(L.noteToServer);
        for (const piece of L.chunk(notes)) {
          await client.mutate('addNotes', { boardId: id, secret: settings.secret, generation: 0, notes: piece });
        }
      }
    } catch (e) {
      if (!(e instanceof C.CloudError)) throw e;
      if (id === boardId) showStatus(TEXT_UNREACHABLE, 'Try again', createBoard);
      return;
    }
    settings = { ...settings, moved: true };
    if (canRemember) S.saveSettings(store, settings);
    window.history.replaceState(null, '', linkTo(id));
    openBoard(id);
  }

  copyLinkBtn.addEventListener('click', async () => {
    const link = linkTo(boardId);
    try {
      await navigator.clipboard.writeText(link);
      linkBoxEl.hidden = true;
      flash('Link copied');
    } catch (e) {
      // The clipboard can be blocked; show the link to copy by hand instead.
      linkInputEl.value = link;
      linkBoxEl.hidden = false;
      linkInputEl.focus();
      linkInputEl.select();
    }
  });

  newBoardBtn.addEventListener('click', () => {
    if (!window.confirm('Start a new, empty board? This board stays available at its link.')) return;
    createBoard();
  });

  // A board link pasted into this tab's address bar opens that board.
  window.addEventListener('hashchange', () => {
    const id = boardIdFromAddress();
    if (id && id !== boardId) openBoard(id);
  });

  // --- Start -----------------------------------------------------------------

  retroBodyEl.append(...L.COLUMNS.map(buildColumn));
  buildPicker();
  applyMode();
  if (!canRemember) showNotice(NOTICE_CANT_SAVE);

  const startId = boardIdFromAddress() || settings.lastBoardId;
  if (startId) openBoard(startId);
  else createBoard();
})();
