// Tests for storage.js. Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../logic.js');
const S = require('../storage.js');

// A stand-in for the browser's localStorage.
function fakeStore(initial = {}) {
  const items = { ...initial };
  return {
    items,
    getItem: (k) => (k in items ? items[k] : null),
    setItem: (k, v) => { items[k] = String(v); },
    removeItem: (k) => { delete items[k]; },
  };
}

// Behaves like a browser that refuses to save.
function brokenStore() {
  return {
    getItem: () => null,
    setItem: () => { throw new Error('QuotaExceededError'); },
    removeItem: () => {},
  };
}

function sampleBoard() {
  let board = L.emptyBoard();
  const c = { ...L.createCard({ id: 'a', column: 'well', text: 'Nice 🎉\nsprint', createdAt: 1 }), x: 16, y: 16, z: 2 };
  c.reactions.thumbsUp = 2;
  board = L.addCard(board, c);
  const areaId = board.health.areas[0].id;
  board = L.addHealthNote(board, L.createHealthNote({ id: 'n', areaId, text: 'Agreed 👍', createdAt: 2 }));
  board = L.vote(board, areaId, 'fine', +1);
  return { ...board, view: { zoom: 0.75, x: -120, y: 40 } };
}

function saved(data) {
  return fakeStore({ [S.KEY]: JSON.stringify(data) });
}

test('canSave: true for a working store, false for a broken or missing one', () => {
  assert.equal(S.canSave(fakeStore()), true);
  assert.equal(S.canSave(brokenStore()), false);
  assert.equal(S.canSave(null), false);
});

test('canSave: leaves nothing behind', () => {
  const store = fakeStore();
  S.canSave(store);
  assert.deepEqual(store.items, {});
});

test('load: nothing saved yet gives a new board', () => {
  assert.deepEqual(S.load(fakeStore()), { board: L.emptyBoard(), damaged: false });
  assert.deepEqual(S.load(null), { board: L.emptyBoard(), damaged: false });
});

test('save then load gives back the same board: cards, health check and view', () => {
  const store = fakeStore();
  assert.equal(S.save(store, sampleBoard()), true);
  assert.deepEqual(S.load(store), { board: sampleBoard(), damaged: false });
});

test('save: returns false when the store refuses', () => {
  assert.equal(S.save(brokenStore(), sampleBoard()), false);
  assert.equal(S.save(null, sampleBoard()), false);
});

test('load: data that is not JSON is backed up and the board starts new', () => {
  const store = fakeStore({ [S.KEY]: '{not json' });
  assert.deepEqual(S.load(store), { board: L.emptyBoard(), damaged: true });
  assert.equal(store.items[S.BACKUP_KEY], '{not json');
});

// T031 — upgrading v1 boards (Story 7.3)
test('load: a v1 board is upgraded, keeping every card unplaced, with the starter areas', () => {
  const v1Card = {
    id: 'a', column: 'notWell', text: 'Old card 🐢', createdAt: 5,
    reactions: { thumbsUp: 3, heart: 1, laugh: 0, party: 0, wow: 0 },
  };
  const { board, damaged } = S.load(saved({ version: 1, cards: [v1Card, { ...v1Card, id: 'b' }] }));
  assert.equal(damaged, false);
  assert.equal(board.version, 2);
  assert.deepEqual(board.cards, [
    { ...v1Card, x: null, y: null, z: 0 },
    { ...v1Card, id: 'b', x: null, y: null, z: 0 },
  ]);
  assert.deepEqual(board.health, L.emptyBoard().health);
  assert.equal(board.view, null);
});

test('load: a damaged v1 board is still treated as damaged', () => {
  const store = saved({ version: 1, cards: [{ id: 'a' }] });
  assert.equal(S.load(store).damaged, true);
});

test('load: JSON with the wrong shape is treated as damaged and backed up', () => {
  const good = sampleBoard();
  const area0 = good.health.areas[0];
  const card0 = good.cards[0];
  const note0 = good.health.notes[0];
  const withHealth = (health) => ({ ...good, health: { ...good.health, ...health } });
  const bad = {
    'unknown version': { ...good, version: 3 },
    'no cards': { ...good, cards: undefined },
    'card in an unknown column': { ...good, cards: [{ ...card0, column: 'other' }] },
    'negative reaction': { ...good, cards: [{ ...card0, reactions: { ...card0.reactions, thumbsUp: -1 } }] },
    'card position not a number': { ...good, cards: [{ ...card0, x: '16' }] },
    'card without z': { ...good, cards: [{ ...card0, z: undefined }] },
    'no health': { ...good, health: undefined },
    'areas not a list': withHealth({ areas: {} }),
    'area without a name': withHealth({ areas: [{ ...area0, name: undefined }] }),
    'area with a bad vote': withHealth({ areas: [{ ...area0, votes: { ...area0.votes, sad: 1.5 } }] }),
    'two areas with the same id': withHealth({ areas: [area0, area0] }),
    'health note in a missing area': withHealth({ notes: [{ ...note0, areaId: 'nowhere' }] }),
    'health note without reactions': withHealth({ notes: [{ ...note0, reactions: undefined }] }),
    'view zoom not a number': { ...good, view: { zoom: 'big', x: 0, y: 0 } },
    'view zoom zero': { ...good, view: { zoom: 0, x: 0, y: 0 } },
  };
  for (const [name, data] of Object.entries(bad)) {
    const raw = JSON.stringify(data);
    const store = fakeStore({ [S.KEY]: raw });
    assert.equal(S.load(store).damaged, true, name);
    assert.equal(store.items[S.BACKUP_KEY], raw, name);
  }
});

test('load: notes not placed yet and an empty area list are fine', () => {
  const good = sampleBoard();
  const data = {
    ...good,
    cards: [{ ...good.cards[0], x: null, y: null }],
    health: { areas: [], notes: [] },
    view: null,
  };
  assert.equal(S.load(saved(data)).damaged, false);
});

// --- v3: this browser's own settings (plan §4) ------------------------------

function idMaker() {
  let n = 0;
  return () => { n += 1; return 'secret-number-' + n; };
}

// T069 — the browser secret, last board, zoom per board, and moving the old board once
test('loadSettings: the secret is created once, then kept', () => {
  const store = fakeStore();
  const makeId = idMaker();
  const first = S.loadSettings(store, makeId);
  assert.deepEqual(first, { secret: 'secret-number-1', lastBoardId: null, moved: false });
  assert.deepEqual(S.loadSettings(store, makeId), first);
});

test('saveSettings: the last board and the move are remembered', () => {
  const store = fakeStore();
  const settings = S.loadSettings(store, idMaker());
  assert.equal(S.saveSettings(store, { ...settings, lastBoardId: 'board-7', moved: true }), true);
  assert.deepEqual(S.loadSettings(store, idMaker()), { secret: 'secret-number-1', lastBoardId: 'board-7', moved: true });
});

test('loadSettings: damaged settings are replaced with new ones', () => {
  for (const raw of ['{not json', '{"secret":5}', '{"secret":"s","lastBoardId":3,"moved":false}']) {
    const store = fakeStore({ [S.SETTINGS_KEY]: raw });
    assert.equal(S.loadSettings(store, idMaker()).secret, 'secret-number-1', raw);
  }
});

test('loadSettings: with saving blocked, it still works, with a new identity each time', () => {
  const makeId = idMaker();
  assert.equal(S.loadSettings(null, makeId).secret, 'secret-number-1');
  assert.equal(S.loadSettings(brokenStore(), makeId).secret, 'secret-number-2');
  assert.equal(S.saveSettings(null, { secret: 'x', lastBoardId: null, moved: false }), false);
});

test('views: zoom and position are kept per board', () => {
  const store = fakeStore();
  assert.equal(S.loadView(store, 'board-1'), null);
  assert.equal(S.saveView(store, 'board-1', { zoom: 0.5, x: 10, y: -20 }), true);
  S.saveView(store, 'board-2', { zoom: 1.5, x: 0, y: 0 });
  assert.deepEqual(S.loadView(store, 'board-1'), { zoom: 0.5, x: 10, y: -20 });
  assert.deepEqual(S.loadView(store, 'board-2'), { zoom: 1.5, x: 0, y: 0 });
});

test('views: a damaged or missing view gives null, and blocked saving is reported', () => {
  assert.equal(S.loadView(fakeStore({ [S.VIEW_KEY_PREFIX + 'b']: '{"zoom":0}' }), 'b'), null);
  assert.equal(S.loadView(null, 'b'), null);
  assert.equal(S.saveView(brokenStore(), 'b', { zoom: 1, x: 0, y: 0 }), false);
});

test('boardToMove: a saved v2 board is offered until it has been moved, and is never changed', () => {
  const raw = JSON.stringify(sampleBoard());
  const store = fakeStore({ [S.KEY]: raw });
  const settings = S.loadSettings(store, idMaker());
  const { view, ...expected } = sampleBoard();
  assert.deepEqual({ ...S.boardToMove(store, settings), view: undefined }, { ...expected, view: undefined });
  assert.equal(S.boardToMove(store, { ...settings, moved: true }), null);
  assert.equal(store.items[S.KEY], raw);
});

test('boardToMove: a saved v1 board is upgraded first', () => {
  const v1Card = { id: 'a', column: 'well', text: 'Old', createdAt: 1, reactions: { thumbsUp: 1, heart: 0, laugh: 0, party: 0, wow: 0 } };
  const store = saved({ version: 1, cards: [v1Card] });
  const board = S.boardToMove(store, S.loadSettings(store, idMaker()));
  assert.equal(board.version, 2);
  assert.deepEqual(board.cards.map((c) => c.id), ['a']);
});

test('boardToMove: nothing to move when nothing is saved, or the saved board is damaged', () => {
  assert.equal(S.boardToMove(fakeStore(), S.loadSettings(fakeStore(), idMaker())), null);
  const damaged = fakeStore({ [S.KEY]: '{not json' });
  assert.equal(S.boardToMove(damaged, S.loadSettings(damaged, idMaker())), null);
  assert.equal(S.boardToMove(null, { secret: 's', lastBoardId: null, moved: false }), null);
});
