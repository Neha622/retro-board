// The board's rules. Nothing here touches the page, so it can be tested in Node.
// Works as a classic browser script (sets window.RetroLogic) and as a Node module.
(function (root) {
  'use strict';

  const MAX_CHARS = 200;

  const COLUMNS = [
    { key: 'well', title: 'Going well', emoji: '😊' },
    { key: 'notWell', title: 'Not going well', emoji: '😟' },
    { key: 'improve', title: 'Improvements', emoji: '💡' },
  ];

  const REACTIONS = [
    { key: 'thumbsUp', emoji: '👍' },
    { key: 'heart', emoji: '❤️' },
    { key: 'laugh', emoji: '😂' },
    { key: 'party', emoji: '🎉' },
    { key: 'wow', emoji: '😮' },
  ];

  const PICKER_EMOJIS = ['😊', '😀', '🎉', '👍', '❤️', '🚀', '💡', '🤔', '😟', '😡', '😴', '🐢', '🔥', '✅', '⚠️', '🙏'];

  const HEALTH_VOTES = [
    { key: 'awesome', label: 'Awesome', emoji: '🟢' },
    { key: 'fine', label: 'Fine', emoji: '🟡' },
    { key: 'sad', label: 'Sad', emoji: '🔴' },
  ];

  const AREA_NAME_MAX = 40;

  // Starter areas (spec appendix A).
  const DEFAULT_AREAS = [
    {
      name: 'Delivering value',
      awesome: 'What we ship really helps our users, and our stakeholders are happy with it.',
      crappy: "What we ship doesn't help anyone, and our stakeholders are frustrated with us.",
    },
    {
      name: 'Easy to release',
      awesome: 'Releasing is simple, safe and mostly automatic.',
      crappy: 'Releasing is risky and painful, with lots of manual steps, and it takes ages.',
    },
    {
      name: 'Fun',
      awesome: 'We love coming to work and have a great time working together.',
      crappy: 'Work feels like a chore, and we dread it.',
    },
    {
      name: 'Health of codebase',
      awesome: 'Our code is clean, easy to read and well tested.',
      crappy: 'Our code is a mess, and technical debt is getting out of hand.',
    },
    {
      name: 'Learning',
      awesome: 'We learn something new all the time.',
      crappy: 'We never get time to learn anything.',
    },
    {
      name: 'Mission',
      awesome: "We know exactly why we're here, and we're excited about it.",
      crappy: "We don't know why we're here, and the goal is unclear and uninspiring.",
    },
    {
      name: 'Pawns or players',
      awesome: 'We decide what to build and how to build it.',
      crappy: "We're just told what to do, with no say in it.",
    },
    {
      name: 'Speed',
      awesome: 'We get things done quickly, with no waiting and no delays.',
      crappy: 'We never seem to finish anything; we keep getting stuck or interrupted.',
    },
    {
      name: 'Suitable process',
      awesome: 'Our way of working fits us perfectly.',
      crappy: 'Our way of working gets in the way.',
    },
    {
      name: 'Support',
      awesome: 'We always get great help when we ask for it.',
      crappy: 'We keep getting stuck because nobody helps us.',
    },
    {
      name: 'Teamwork',
      awesome: "We're a close team that helps each other out.",
      crappy: "We're a group of individuals who don't really work together.",
    },
  ];

  // Whiteboard sizes, in whiteboard units (pixels at 100% zoom).
  const NOTE_WIDTH = 200;
  const NOTE_GAP = 16;
  const NOTES_PER_ROW = 2;
  const ZONE_WIDTH = NOTES_PER_ROW * NOTE_WIDTH + (NOTES_PER_ROW + 1) * NOTE_GAP;
  const NOTE_HEIGHT_GUESS = 120;
  const PLACE_STEP = 8;

  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 2;
  const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

  // --- Characters ---------------------------------------------------------

  const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

  // Splits text into what a reader sees as single characters, so every emoji is one item.
  function splitChars(text) {
    if (!segmenter) return Array.from(text);
    return Array.from(segmenter.segment(text), (s) => s.segment);
  }

  function countChars(text) {
    return splitChars(text).length;
  }

  function truncate(text, max = MAX_CHARS) {
    const chars = splitChars(text);
    if (chars.length <= max) return { text, cut: false };
    return { text: chars.slice(0, max).join(''), cut: true };
  }

  // Applies the limit to a change in a text box. Finds what the change inserted,
  // keeps only as much of it as fits, and returns where the cursor should go.
  function fitEdit(oldText, newText, max = MAX_CHARS) {
    const oldChars = splitChars(oldText);
    const newChars = splitChars(newText);

    let prefix = 0;
    const shorter = Math.min(oldChars.length, newChars.length);
    while (prefix < shorter && oldChars[prefix] === newChars[prefix]) prefix++;

    let suffix = 0;
    while (
      suffix < shorter - prefix &&
      oldChars[oldChars.length - 1 - suffix] === newChars[newChars.length - 1 - suffix]
    ) suffix++;

    const inserted = newChars.slice(prefix, newChars.length - suffix);
    const room = Math.max(0, max - prefix - suffix);
    const kept = inserted.slice(0, room);
    const before = newChars.slice(0, prefix).join('') + kept.join('');
    const text = before + newChars.slice(newChars.length - suffix).join('');

    return { text, cursor: before.length, cut: kept.length < inserted.length };
  }

  // Inserts text in place of the selection [start, end). Returns null if the result would be too long.
  function insertAt(text, start, end, insert, max = MAX_CHARS) {
    const result = text.slice(0, start) + insert + text.slice(end);
    if (countChars(result) > max) return null;
    return { text: result, cursor: start + insert.length };
  }

  function isBlank(text) {
    return text.trim() === '';
  }

  // --- Board --------------------------------------------------------------
  // A "note" is either a card (in a retro column) or a health note (in an area's Notes cell).
  // Ids are unique across both, so note functions find the note wherever it is.

  function emptyCounts(list) {
    const counts = {};
    for (const item of list) counts[item.key] = 0;
    return counts;
  }

  function slug(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function createArea({ id, name, awesome, crappy }) {
    return { id, name, awesome, crappy, votes: emptyCounts(HEALTH_VOTES) };
  }

  function emptyBoard() {
    return {
      version: 2,
      cards: [],
      health: {
        areas: DEFAULT_AREAS.map((a) => createArea({ id: `area-${slug(a.name)}`, ...a })),
        notes: [],
      },
      view: null,
    };
  }

  function createCard({ id, column, text, createdAt }) {
    return { id, column, text, createdAt, reactions: emptyCounts(REACTIONS), x: null, y: null, z: 0 };
  }

  function createHealthNote({ id, areaId, text, createdAt }) {
    return { id, areaId, text, createdAt, reactions: emptyCounts(REACTIONS), x: null, y: null, z: 0 };
  }

  function withHealth(board, change) {
    return { ...board, health: { ...board.health, ...change(board.health) } };
  }

  function updateNote(board, id, change) {
    const update = (n) => (n.id === id ? change(n) : n);
    return withHealth({ ...board, cards: board.cards.map(update) }, (h) => ({ notes: h.notes.map(update) }));
  }

  function findNote(board, id) {
    return board.cards.find((c) => c.id === id) || board.health.notes.find((n) => n.id === id);
  }

  function isCard(board, id) {
    return board.cards.some((c) => c.id === id);
  }

  function addCard(board, card) {
    return { ...board, cards: [...board.cards, card] };
  }

  function addHealthNote(board, note) {
    return withHealth(board, (h) => ({ notes: [...h.notes, note] }));
  }

  function editNote(board, id, text) {
    return updateNote(board, id, (n) => ({ ...n, text }));
  }

  function deleteNote(board, id) {
    return withHealth(
      { ...board, cards: board.cards.filter((c) => c.id !== id) },
      (h) => ({ notes: h.notes.filter((n) => n.id !== id) }),
    );
  }

  function react(board, id, reactionKey, delta) {
    return updateNote(board, id, (n) => ({
      ...n,
      reactions: { ...n.reactions, [reactionKey]: Math.max(0, n.reactions[reactionKey] + delta) },
    }));
  }

  // Removes every note and vote. Areas, their texts and the view are kept.
  function clearBoard(board) {
    return withHealth({ ...board, cards: [] }, (h) => ({
      notes: [],
      areas: h.areas.map((a) => ({ ...a, votes: emptyCounts(HEALTH_VOTES) })),
    }));
  }

  function isBoardEmpty(board) {
    return (
      board.cards.length === 0 &&
      board.health.notes.length === 0 &&
      board.health.areas.every((a) => HEALTH_VOTES.every((v) => a.votes[v.key] === 0))
    );
  }

  function cardsInColumn(board, columnKey) {
    return board.cards.filter((c) => c.column === columnKey);
  }

  function healthNotesInArea(board, areaId) {
    return board.health.notes.filter((n) => n.areaId === areaId);
  }

  // --- Health check areas -------------------------------------------------

  function updateArea(board, id, change) {
    return withHealth(board, (h) => ({ areas: h.areas.map((a) => (a.id === id ? change(a) : a)) }));
  }

  function vote(board, areaId, voteKey, delta) {
    return updateArea(board, areaId, (a) => ({
      ...a,
      votes: { ...a.votes, [voteKey]: Math.max(0, a.votes[voteKey] + delta) },
    }));
  }

  function addArea(board, area) {
    return withHealth(board, (h) => ({ areas: [...h.areas, area] }));
  }

  function editArea(board, id, { name, awesome, crappy }) {
    return updateArea(board, id, (a) => ({ ...a, name, awesome, crappy }));
  }

  function deleteArea(board, id) {
    return withHealth(board, (h) => ({
      areas: h.areas.filter((a) => a.id !== id),
      notes: h.notes.filter((n) => n.areaId !== id),
    }));
  }

  function isValidAreaName(name) {
    return !isBlank(name) && countChars(name) <= AREA_NAME_MAX;
  }

  // --- Placing and moving notes (plan §5.12) --------------------------------

  function slotXs(zoneWidth) {
    const xs = [];
    for (let x = NOTE_GAP; x + NOTE_WIDTH + NOTE_GAP <= zoneWidth; x += NOTE_WIDTH + NOTE_GAP) xs.push(x);
    return xs;
  }

  // True if the rectangles are closer than one gap to each other.
  function tooClose(a, b) {
    return (
      a.x < b.x + b.width + NOTE_GAP && a.x + a.width + NOTE_GAP > b.x &&
      a.y < b.y + b.height + NOTE_GAP && a.y + a.height + NOTE_GAP > b.y
    );
  }

  // First free place, scanning top to bottom, then left to right across the slots of a row.
  function findFreeSpot(rects, { width, height }, zoneWidth = ZONE_WIDTH) {
    const lowest = rects.reduce((max, r) => Math.max(max, r.y + r.height), 0);
    for (let y = NOTE_GAP; ; y += PLACE_STEP) {
      for (const x of slotXs(zoneWidth)) {
        const candidate = { x, y, width, height };
        // Below every note there is always room, so the scan always ends.
        if (y >= lowest + NOTE_GAP || !rects.some((r) => tooClose(candidate, r))) return { x, y };
      }
    }
  }

  // Lines notes up in rows of two, in the given order. Each row is as tall as its tallest note.
  function tidyLayout(ids, heights, zoneWidth = ZONE_WIDTH) {
    const xs = slotXs(zoneWidth);
    const positions = [];
    let y = NOTE_GAP;
    for (let start = 0; start < ids.length; start += xs.length) {
      const row = ids.slice(start, start + xs.length);
      row.forEach((id, i) => positions.push({ id, x: xs[i], y }));
      y += Math.max(...row.map((id) => heights[id] || NOTE_HEIGHT_GUESS)) + NOTE_GAP;
    }
    return positions;
  }

  // Top to bottom, then left to right. Notes not placed yet come last, in list order.
  function readingOrder(notes) {
    const placed = notes.filter((n) => n.x !== null).sort((a, b) => a.y - b.y || a.x - b.x);
    return [...placed, ...notes.filter((n) => n.x === null)];
  }

  // Tall enough for every note, plus a free strip below the lowest one.
  function zoneHeight(rects, minHeight) {
    if (rects.length === 0) return minHeight;
    const lowest = Math.max(...rects.map((r) => r.y + r.height));
    return Math.max(minHeight, lowest + NOTE_GAP + NOTE_HEIGHT_GUESS + NOTE_GAP);
  }

  function setPositions(board, positions) {
    const byId = new Map(positions.map((p) => [p.id, p]));
    const place = (n) => (byId.has(n.id) ? { ...n, x: byId.get(n.id).x, y: byId.get(n.id).y } : n);
    return withHealth({ ...board, cards: board.cards.map(place) }, (h) => ({ notes: h.notes.map(place) }));
  }

  // Moves a note to (x, y) inside a zone: a column key for a card, an area id for a health note.
  function moveNote(board, id, zoneKey, x, y, zoneWidth = ZONE_WIDTH) {
    const zoneField = isCard(board, id) ? 'column' : 'areaId';
    return updateNote(board, id, (n) => ({
      ...n,
      [zoneField]: zoneKey,
      x: Math.min(Math.max(0, x), zoneWidth - NOTE_WIDTH),
      y: Math.max(0, y),
    }));
  }

  function bringToFront(board, id) {
    const top = Math.max(0, ...board.cards.map((c) => c.z), ...board.health.notes.map((n) => n.z));
    return updateNote(board, id, (n) => ({ ...n, z: top + 1 }));
  }

  // Most 👍 first, then oldest first, lined up in rows in each column. `heights` maps
  // card ids to measured heights. Health notes are not touched.
  function sortByVotes(board, heights = {}) {
    const cards = [...board.cards].sort(
      (a, b) => b.reactions.thumbsUp - a.reactions.thumbsUp || a.createdAt - b.createdAt,
    );
    const positions = COLUMNS.flatMap((col) => tidyLayout(
      cards.filter((c) => c.column === col.key).map((c) => c.id),
      heights,
    ));
    return setPositions({ ...board, cards }, positions);
  }

  // --- Zoom maths (plan §5.10) ----------------------------------------------
  // A view is { zoom, x, y }: the world is scaled by `zoom`, then moved by (x, y) screen pixels.

  function clampZoom(zoom) {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
  }

  // Changes the zoom while keeping the world point under screen point (px, py) still.
  function zoomAt(view, zoom, px, py) {
    const next = clampZoom(zoom);
    const worldX = (px - view.x) / view.zoom;
    const worldY = (py - view.y) / view.zoom;
    return { zoom: next, x: px - worldX * next, y: py - worldY * next };
  }

  function nextZoomStep(zoom, direction) {
    if (direction > 0) return ZOOM_STEPS.find((s) => s > zoom + 1e-9) ?? ZOOM_MAX;
    return [...ZOOM_STEPS].reverse().find((s) => s < zoom - 1e-9) ?? ZOOM_MIN;
  }

  // The view that shows `bounds` (world units) whole and centred in `viewport` (screen pixels).
  function fitView(bounds, viewport, margin) {
    const zoom = clampZoom(Math.min(
      (viewport.width - 2 * margin) / bounds.width,
      (viewport.height - 2 * margin) / bounds.height,
    ));
    return {
      zoom,
      x: (viewport.width - bounds.width * zoom) / 2 - bounds.x * zoom,
      y: (viewport.height - bounds.height * zoom) / 2 - bounds.y * zoom,
    };
  }

  const RetroLogic = {
    MAX_CHARS,
    COLUMNS,
    REACTIONS,
    PICKER_EMOJIS,
    HEALTH_VOTES,
    AREA_NAME_MAX,
    DEFAULT_AREAS,
    NOTE_WIDTH,
    NOTE_GAP,
    ZONE_WIDTH,
    NOTE_HEIGHT_GUESS,
    ZOOM_MIN,
    ZOOM_MAX,
    ZOOM_STEPS,
    splitChars,
    countChars,
    truncate,
    fitEdit,
    insertAt,
    isBlank,
    emptyBoard,
    createCard,
    createHealthNote,
    createArea,
    findNote,
    addCard,
    addHealthNote,
    editNote,
    deleteNote,
    react,
    clearBoard,
    isBoardEmpty,
    cardsInColumn,
    healthNotesInArea,
    vote,
    addArea,
    editArea,
    deleteArea,
    isValidAreaName,
    findFreeSpot,
    tidyLayout,
    readingOrder,
    zoneHeight,
    setPositions,
    moveNote,
    bringToFront,
    sortByVotes,
    clampZoom,
    zoomAt,
    nextZoomStep,
    fitView,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = RetroLogic;
  else root.RetroLogic = RetroLogic;
})(typeof globalThis !== 'undefined' ? globalThis : this);
