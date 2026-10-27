// Loads and saves the board. `store` is the browser's localStorage (or a stand-in in tests),
// or null when the browser won't give us one.
// Works as a classic browser script (sets window.RetroStorage) and as a Node module.
(function (root) {
  'use strict';

  const L = typeof module !== 'undefined' && module.exports ? require('./logic.js') : root.RetroLogic;

  const KEY = 'retro-board';
  const BACKUP_KEY = 'retro-board-backup';
  const TEST_KEY = 'retro-board-test';

  function canSave(store) {
    if (!store) return false;
    try {
      store.setItem(TEST_KEY, '1');
      store.removeItem(TEST_KEY);
      return true;
    } catch (e) {
      return false;
    }
  }

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function isCount(n) {
    return Number.isInteger(n) && n >= 0;
  }

  function hasCounts(obj, list) {
    return isObject(obj) && list.every((item) => isCount(obj[item.key]));
  }

  function isPosition(n) {
    return n === null || Number.isFinite(n);
  }

  // The fields every note has, in v1 and v2.
  function isValidNoteBase(n) {
    return (
      isObject(n) &&
      typeof n.id === 'string' &&
      typeof n.text === 'string' &&
      Number.isFinite(n.createdAt) &&
      hasCounts(n.reactions, L.REACTIONS)
    );
  }

  function isPlaced(n) {
    return isPosition(n.x) && isPosition(n.y) && Number.isFinite(n.z);
  }

  function isValidV1Card(c) {
    return isValidNoteBase(c) && L.COLUMNS.some((col) => col.key === c.column);
  }

  function isValidArea(a) {
    return (
      isObject(a) &&
      typeof a.id === 'string' &&
      typeof a.name === 'string' &&
      typeof a.awesome === 'string' &&
      typeof a.crappy === 'string' &&
      hasCounts(a.votes, L.HEALTH_VOTES)
    );
  }

  function isValidHealth(health) {
    if (!isObject(health) || !Array.isArray(health.areas) || !Array.isArray(health.notes)) return false;
    if (!health.areas.every(isValidArea)) return false;
    const areaIds = new Set(health.areas.map((a) => a.id));
    if (areaIds.size !== health.areas.length) return false;
    return health.notes.every((n) => isValidNoteBase(n) && isPlaced(n) && areaIds.has(n.areaId));
  }

  function isValidView(view) {
    return view === null || (
      isObject(view) && Number.isFinite(view.zoom) && view.zoom > 0 &&
      Number.isFinite(view.x) && Number.isFinite(view.y)
    );
  }

  function isValidV1Board(data) {
    return isObject(data) && data.version === 1 && Array.isArray(data.cards) && data.cards.every(isValidV1Card);
  }

  function isValidBoard(data) {
    return (
      isObject(data) &&
      data.version === 2 &&
      Array.isArray(data.cards) &&
      data.cards.every((c) => isValidV1Card(c) && isPlaced(c)) &&
      isValidHealth(data.health) &&
      isValidView(data.view)
    );
  }

  // v1 had cards only. They are kept, left unplaced so the app lays them out in rows when it
  // first draws them, and the health check starts with the starter areas (plan §4).
  function upgradeV1(data) {
    const board = L.emptyBoard();
    return { ...board, cards: data.cards.map((c) => ({ ...c, x: null, y: null, z: 0 })) };
  }

  // Returns { board, damaged }. Damaged data is copied to BACKUP_KEY, never silently destroyed.
  function load(store) {
    if (!store) return { board: L.emptyBoard(), damaged: false };

    let raw;
    try {
      raw = store.getItem(KEY);
    } catch (e) {
      return { board: L.emptyBoard(), damaged: false };
    }
    if (raw === null) return { board: L.emptyBoard(), damaged: false };

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      data = null;
    }
    if (isValidBoard(data)) return { board: data, damaged: false };
    if (isValidV1Board(data)) return { board: upgradeV1(data), damaged: false };

    try {
      store.setItem(BACKUP_KEY, raw);
    } catch (e) {
      // Nothing more we can do; the board still starts empty.
    }
    return { board: L.emptyBoard(), damaged: true };
  }

  // Returns true if the board was saved.
  function save(store, board) {
    if (!store) return false;
    try {
      store.setItem(KEY, JSON.stringify(board));
      return true;
    } catch (e) {
      return false;
    }
  }

  const RetroStorage = { KEY, BACKUP_KEY, canSave, isValidBoard, load, save };

  if (typeof module !== 'undefined' && module.exports) module.exports = RetroStorage;
  else root.RetroStorage = RetroStorage;
})(typeof globalThis !== 'undefined' ? globalThis : this);
