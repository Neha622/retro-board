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
