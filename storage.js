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

  // --- v3: this browser's own settings (plan §4) ----------------------------
  // The board itself now lives on AWS. This browser keeps only its secret, its last board,
  // whether its old board has been moved, and its zoom and position for each board.

  const SETTINGS_KEY = 'retro-browser';
  const VIEW_KEY_PREFIX = 'retro-view-';

  function readJson(store, key) {
    if (!store) return null;
    try {
      const raw = store.getItem(key);
      return raw === null ? null : JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function writeJson(store, key, value) {
    if (!store) return false;
    try {
      store.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function isValidSettings(data) {
    return (
      isObject(data) &&
      typeof data.secret === 'string' && data.secret !== '' &&
      (data.lastBoardId === null || typeof data.lastBoardId === 'string') &&
      typeof data.moved === 'boolean'
    );
  }

  // Returns { secret, lastBoardId, moved }. A new secret is made, with `makeId`, only when there
  // are no valid settings yet. When saving is blocked, every visit gets a new identity (spec Story 18).
  function loadSettings(store, makeId) {
    const data = readJson(store, SETTINGS_KEY);
    if (isValidSettings(data)) return { secret: data.secret, lastBoardId: data.lastBoardId, moved: data.moved };
    const settings = { secret: makeId(), lastBoardId: null, moved: false };
    writeJson(store, SETTINGS_KEY, settings);
    return settings;
  }

  function saveSettings(store, settings) {
    return writeJson(store, SETTINGS_KEY, settings);
  }

  function loadView(store, boardId) {
    const view = readJson(store, VIEW_KEY_PREFIX + boardId);
    return view !== null && isValidView(view) ? view : null;
  }

  function saveView(store, boardId, view) {
    return writeJson(store, VIEW_KEY_PREFIX + boardId, view);
  }

  // The v1 or v2 board saved in this browser, upgraded if needed, if it hasn't been moved to a
  // shared board yet (spec Story 20). The saved copy itself is never changed.
  function boardToMove(store, settings) {
    if (settings.moved || readJson(store, KEY) === null) return null;
    const { board, damaged } = load(store);
    return damaged ? null : board;
  }

  const RetroStorage = {
    KEY,
    BACKUP_KEY,
    SETTINGS_KEY,
    VIEW_KEY_PREFIX,
    canSave,
    isValidBoard,
    load,
    save,
    loadSettings,
    saveSettings,
    loadView,
    saveView,
    boardToMove,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = RetroStorage;
  else root.RetroStorage = RetroStorage;
})(typeof globalThis !== 'undefined' ? globalThis : this);
