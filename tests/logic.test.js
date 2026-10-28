// Tests for logic.js. Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../logic.js');

const THUMB_SKIN = '👍🏽';
const FLAG = '🇳🇱';
const FAMILY = '👨‍👩‍👧';

function card(id, column, createdAt, thumbsUp = 0, text = 'text ' + id) {
  const c = L.createCard({ id, column, text, createdAt });
  c.reactions.thumbsUp = thumbsUp;
  return c;
}

function boardOf(...cards) {
  return { ...L.emptyBoard(), cards };
}

function ids(board) {
  return board.cards.map((c) => c.id);
}

// T003 — character counting (Story 2.6)
test('countChars: plain text counts each letter', () => {
  assert.equal(L.countChars(''), 0);
  assert.equal(L.countChars('Hello'), 5);
});

test('countChars: each emoji counts as 1, whatever it is made of', () => {
  assert.equal(L.countChars('👍'), 1);
  assert.equal(L.countChars('❤️'), 1);
  assert.equal(L.countChars(THUMB_SKIN), 1);
  assert.equal(L.countChars(FLAG), 1);
  assert.equal(L.countChars(FAMILY), 1);
  assert.equal(L.countChars('Hi 👍🏽' + FLAG + FAMILY), 6);
});

test('countChars: a line break counts as 1', () => {
  assert.equal(L.countChars('a\nb'), 3);
});

// T004 — cutting text to 200 characters (Story 2.5)
test('truncate: text within the limit is unchanged', () => {
  assert.deepEqual(L.truncate('abc', 5), { text: 'abc', cut: false });
  assert.deepEqual(L.truncate('abcde', 5), { text: 'abcde', cut: false });
});

test('truncate: long text is cut to the limit', () => {
  assert.deepEqual(L.truncate('abcdef', 5), { text: 'abcde', cut: true });
});

test('truncate: defaults to 200 characters', () => {
  const result = L.truncate('x'.repeat(250));
  assert.equal(result.text.length, 200);
  assert.equal(result.cut, true);
});

test('truncate: never breaks an emoji in half', () => {
  const result = L.truncate('ab' + FAMILY + FLAG, 3);
  assert.equal(result.text, 'ab' + FAMILY);
  assert.equal(L.countChars(result.text), 3);
});

test('fitEdit: a change within the limit is kept as it is', () => {
  assert.deepEqual(L.fitEdit('abc', 'abXc', 5), { text: 'abXc', cursor: 3, cut: false });
});

test('fitEdit: typing at the limit is refused, even in the middle', () => {
  assert.deepEqual(L.fitEdit('abcde', 'abXcde', 5), { text: 'abcde', cursor: 2, cut: true });
});

test('fitEdit: pasting keeps only what fits, at the cursor', () => {
  assert.deepEqual(L.fitEdit('ab', 'aXYZb', 4), { text: 'aXYb', cursor: 3, cut: true });
});

test('fitEdit: replacing a selection counts the removed text as free space', () => {
  assert.deepEqual(L.fitEdit('abcde', 'aXYZe', 5), { text: 'aXYZe', cursor: 4, cut: false });
});

test('fitEdit: pasted emojis are kept whole', () => {
  const result = L.fitEdit('abc', 'abc' + FAMILY + FLAG, 4);
  assert.deepEqual(result, { text: 'abc' + FAMILY, cursor: ('abc' + FAMILY).length, cut: true });
});

// T005 — inserting an emoji at the cursor (Story 3.2, 3.7)
test('insertAt: inserts at the start, middle and end', () => {
  assert.deepEqual(L.insertAt('ab', 0, 0, '🎉'), { text: '🎉ab', cursor: 2 });
  assert.deepEqual(L.insertAt('ab', 1, 1, '🎉'), { text: 'a🎉b', cursor: 3 });
  assert.deepEqual(L.insertAt('ab', 2, 2, '🎉'), { text: 'ab🎉', cursor: 4 });
});

test('insertAt: replaces selected text', () => {
  assert.deepEqual(L.insertAt('abcd', 1, 3, '🎉'), { text: 'a🎉d', cursor: 3 });
});

test('insertAt: refuses when the result would go over the limit', () => {
  assert.equal(L.insertAt('abc', 3, 3, '🎉', 3), null);
  assert.deepEqual(L.insertAt('ab', 2, 2, '🎉', 3), { text: 'ab🎉', cursor: 4 });
});

// T006 — empty-text check (Story 2.3, 6.4)
test('isBlank: empty, spaces and new lines are blank', () => {
  assert.equal(L.isBlank(''), true);
  assert.equal(L.isBlank('   '), true);
  assert.equal(L.isBlank('\n\n '), true);
  assert.equal(L.isBlank('\t'), true);
});

test('isBlank: any visible text is not blank', () => {
  assert.equal(L.isBlank(' a '), false);
  assert.equal(L.isBlank('👍'), false);
});

// T007 — sorting (Story 5.2–5.3; v2 lines cards up in rows)
const inVoteOrder = (board, column) => L.readingOrder(L.cardsInColumn(board, column)).map((c) => c.id);

test('sortByVotes: highest 👍 first within each column', () => {
  const board = boardOf(card('a', 'well', 1, 1), card('b', 'well', 2, 5), card('c', 'well', 3, 3));
  assert.deepEqual(inVoteOrder(L.sortByVotes(board), 'well'), ['b', 'c', 'a']);
});

test('sortByVotes: ties go to the older card', () => {
  const board = boardOf(card('new', 'well', 20, 2), card('old', 'well', 10, 2));
  assert.deepEqual(inVoteOrder(L.sortByVotes(board), 'well'), ['old', 'new']);
});

test('sortByVotes: each column is sorted separately', () => {
  const board = boardOf(
    card('w1', 'well', 1, 0),
    card('n1', 'notWell', 2, 9),
    card('w2', 'well', 3, 4),
    card('i1', 'improve', 4, 1),
  );
  const sorted = L.sortByVotes(board);
  assert.deepEqual(inVoteOrder(sorted, 'well'), ['w2', 'w1']);
  assert.deepEqual(inVoteOrder(sorted, 'notWell'), ['n1']);
  assert.deepEqual(inVoteOrder(sorted, 'improve'), ['i1']);
});

test('sortByVotes: other reactions are ignored', () => {
  const a = card('a', 'well', 1, 1);
  const b = card('b', 'well', 2, 0);
  b.reactions.heart = 10;
  assert.deepEqual(inVoteOrder(L.sortByVotes(boardOf(a, b)), 'well'), ['a', 'b']);
});

test('sortByVotes: lines each column up in rows of two, using measured heights', () => {
  const board = boardOf(card('a', 'well', 1, 3), card('b', 'well', 2, 2), card('c', 'well', 3, 1));
  const sorted = L.sortByVotes(board, { a: 100, b: 150, c: 80 });
  const pos = Object.fromEntries(sorted.cards.map((c) => [c.id, [c.x, c.y]]));
  const { NOTE_GAP: g, NOTE_WIDTH: w } = L;
  assert.deepEqual(pos, { a: [g, g], b: [g + w + g, g], c: [g, g + 150 + g] });
});

test('sortByVotes: also keeps the list itself in vote order', () => {
  const board = boardOf(card('a', 'well', 1, 0), card('b', 'well', 2, 5));
  assert.deepEqual(ids(L.sortByVotes(board)), ['b', 'a']);
});

test('sortByVotes: does not touch health notes or change the original board', () => {
  const note = { ...L.createHealthNote({ id: 'n', areaId: 'area-fun', text: 'x', createdAt: 1 }), x: 300, y: 300 };
  const board = { ...boardOf(card('a', 'well', 1, 0), card('b', 'well', 2, 5)) };
  board.health = { ...board.health, notes: [note] };
  const sorted = L.sortByVotes(board);
  assert.deepEqual(sorted.health.notes, [note]);
  assert.deepEqual(ids(board), ['a', 'b']);
});

// T008 — card changes (Stories 2, 4, 6, 8)
test('createCard: starts with every reaction at 0, not yet placed', () => {
  const c = L.createCard({ id: 'x', column: 'improve', text: 'Hi', createdAt: 5 });
  assert.deepEqual(c, {
    id: 'x',
    column: 'improve',
    text: 'Hi',
    createdAt: 5,
    reactions: { thumbsUp: 0, heart: 0, laugh: 0, party: 0, wow: 0 },
    x: null,
    y: null,
    z: 0,
  });
});

test('addCard: puts the new card at the end', () => {
  const board = L.addCard(boardOf(card('a', 'well', 1)), card('b', 'well', 2));
  assert.deepEqual(ids(board), ['a', 'b']);
});

test('editNote: changes a card\'s text but keeps age, column, reactions and place', () => {
  const before = { ...card('a', 'notWell', 7, 3, 'old'), x: 40, y: 90 };
  const after = L.editNote(boardOf(before), 'a', 'new 🎉').cards[0];
  assert.equal(after.text, 'new 🎉');
  assert.equal(after.createdAt, 7);
  assert.equal(after.column, 'notWell');
  assert.equal(after.reactions.thumbsUp, 3);
  assert.deepEqual([after.x, after.y], [40, 90]);
  assert.equal(before.text, 'old');
});

test('deleteNote: removes only that card', () => {
  const board = boardOf(card('a', 'well', 1), card('b', 'well', 2), card('c', 'well', 3));
  assert.deepEqual(ids(L.deleteNote(board, 'b')), ['a', 'c']);
});

test('react: adds 1 each time, even for the same reaction', () => {
  let board = boardOf(card('a', 'well', 1));
  board = L.react(board, 'a', 'heart', +1);
  board = L.react(board, 'a', 'heart', +1);
  assert.equal(board.cards[0].reactions.heart, 2);
});

test('react: removes 1, but never goes below 0', () => {
  let board = boardOf(card('a', 'well', 1, 1));
  board = L.react(board, 'a', 'thumbsUp', -1);
  assert.equal(board.cards[0].reactions.thumbsUp, 0);
  board = L.react(board, 'a', 'thumbsUp', -1);
  assert.equal(board.cards[0].reactions.thumbsUp, 0);
});

test('react: does not move the card', () => {
  let board = boardOf(card('a', 'well', 1), card('b', 'well', 2));
  board = L.react(board, 'b', 'thumbsUp', +1);
  assert.deepEqual(ids(board), ['a', 'b']);
});

// ===========================================================================
// v2 — whiteboard and Squad Health Check
// ===========================================================================

const area = (board, id) => board.health.areas.find((a) => a.id === id);
const areaIds = (board) => board.health.areas.map((a) => a.id);
const noteIds = (board) => board.health.notes.map((n) => n.id);

function healthNote(id, areaId, extra = {}) {
  return { ...L.createHealthNote({ id, areaId, text: 'note ' + id, createdAt: 1 }), ...extra };
}

function boardWithNotes(...notes) {
  const board = L.emptyBoard();
  return { ...board, health: { ...board.health, notes } };
}

// T024 — health areas and votes (Stories 12, 13, 15)
test('DEFAULT_AREAS: the 11 starter areas, in order, each with both examples', () => {
  assert.deepEqual(L.DEFAULT_AREAS.map((a) => a.name), [
    'Delivering value', 'Easy to release', 'Fun', 'Health of codebase', 'Learning', 'Mission',
    'Pawns or players', 'Speed', 'Suitable process', 'Support', 'Teamwork',
  ]);
  for (const a of L.DEFAULT_AREAS) {
    assert.ok(a.awesome.length > 0 && a.crappy.length > 0, a.name);
  }
});

test('emptyBoard: version 2, no cards, the starter areas with no votes or notes, no saved view', () => {
  const board = L.emptyBoard();
  assert.equal(board.version, 2);
  assert.deepEqual(board.cards, []);
  assert.equal(board.health.areas.length, 11);
  assert.deepEqual(board.health.notes, []);
  assert.equal(board.view, null);
  for (const a of board.health.areas) assert.deepEqual(a.votes, { awesome: 0, fine: 0, sad: 0 });
  assert.equal(new Set(areaIds(board)).size, 11, 'area ids are unique');
});

test('HEALTH_VOTES: Awesome, Fine, Sad with green, amber and red', () => {
  assert.deepEqual(L.HEALTH_VOTES.map((v) => `${v.emoji} ${v.label}`), ['🟢 Awesome', '🟡 Fine', '🔴 Sad']);
});

test('vote: adds 1 each time and removes 1, never below 0, only on that area', () => {
  let board = L.emptyBoard();
  const [first, second] = areaIds(board);
  board = L.vote(board, first, 'awesome', +1);
  board = L.vote(board, first, 'awesome', +1);
  board = L.vote(board, first, 'sad', -1);
  assert.deepEqual(area(board, first).votes, { awesome: 2, fine: 0, sad: 0 });
  assert.deepEqual(area(board, second).votes, { awesome: 0, fine: 0, sad: 0 });
  board = L.vote(board, first, 'awesome', -1);
  assert.equal(area(board, first).votes.awesome, 1);
});

test('addArea: puts the new area at the bottom with no votes', () => {
  const board = L.addArea(L.emptyBoard(), L.createArea({ id: 'new', name: 'New area', awesome: '', crappy: '' }));
  assert.equal(areaIds(board).at(-1), 'new');
  assert.deepEqual(area(board, 'new'), { id: 'new', name: 'New area', awesome: '', crappy: '', votes: { awesome: 0, fine: 0, sad: 0 } });
});

test('editArea: changes name and examples, keeps votes and place', () => {
  let board = L.emptyBoard();
  const id = areaIds(board)[2];
  board = L.vote(board, id, 'fine', +1);
  board = L.editArea(board, id, { name: 'Joy 🎉', awesome: 'A', crappy: 'C' });
  assert.equal(areaIds(board)[2], id);
  assert.deepEqual(area(board, id), { id, name: 'Joy 🎉', awesome: 'A', crappy: 'C', votes: { awesome: 0, fine: 1, sad: 0 } });
});

test('deleteArea: removes the area and its health notes only', () => {
  const [a1, a2] = areaIds(L.emptyBoard());
  const board = L.deleteArea(boardWithNotes(healthNote('n1', a1), healthNote('n2', a2), healthNote('n3', a1)), a1);
  assert.equal(area(board, a1), undefined);
  assert.equal(board.health.areas.length, 10);
  assert.deepEqual(noteIds(board), ['n2']);
});

test('isValidAreaName: 1–40 characters, not blank, emojis count as 1', () => {
  assert.equal(L.AREA_NAME_MAX, 40);
  assert.equal(L.isValidAreaName('Fun'), true);
  assert.equal(L.isValidAreaName('x'.repeat(40)), true);
  assert.equal(L.isValidAreaName('🎉'.repeat(40)), true);
  assert.equal(L.isValidAreaName('x'.repeat(41)), false);
  assert.equal(L.isValidAreaName(''), false);
  assert.equal(L.isValidAreaName('  \n'), false);
});

// T025 — health notes (Story 14)
test('createHealthNote: belongs to an area, reactions at 0, not yet placed', () => {
  assert.deepEqual(L.createHealthNote({ id: 'n', areaId: 'a', text: 'Hi', createdAt: 3 }), {
    id: 'n', areaId: 'a', text: 'Hi', createdAt: 3,
    reactions: { thumbsUp: 0, heart: 0, laugh: 0, party: 0, wow: 0 },
    x: null, y: null, z: 0,
  });
});

test('addHealthNote: puts the note at the end of the health notes', () => {
  let board = L.addHealthNote(L.emptyBoard(), healthNote('n1', 'a'));
  board = L.addHealthNote(board, healthNote('n2', 'a'));
  assert.deepEqual(noteIds(board), ['n1', 'n2']);
  assert.deepEqual(board.cards, []);
});

test('editNote / deleteNote / react work on health notes too', () => {
  let board = boardWithNotes(healthNote('n1', 'a', { x: 10, y: 20, createdAt: 9 }), healthNote('n2', 'a'));
  board = L.editNote(board, 'n1', 'changed 💡');
  board = L.react(board, 'n1', 'party', +1);
  const n1 = board.health.notes[0];
  assert.equal(n1.text, 'changed 💡');
  assert.equal(n1.createdAt, 9);
  assert.deepEqual([n1.x, n1.y, n1.areaId], [10, 20, 'a']);
  assert.equal(n1.reactions.party, 1);
  assert.deepEqual(noteIds(L.deleteNote(board, 'n2')), ['n1']);
});

test('healthNotesInArea: only that area\'s notes', () => {
  const board = boardWithNotes(healthNote('n1', 'a'), healthNote('n2', 'b'), healthNote('n3', 'a'));
  assert.deepEqual(L.healthNotesInArea(board, 'a').map((n) => n.id), ['n1', 'n3']);
});

// T026 — clearing (Story 8)
test('clearBoard: removes cards, health notes and votes; keeps areas, their texts and the view', () => {
  let board = boardWithNotes(healthNote('n1', 'a'));
  board = L.addCard(board, card('c', 'well', 1));
  const id = areaIds(board)[0];
  board = L.editArea(board, id, { name: 'Renamed', awesome: 'A', crappy: 'C' });
  board = L.vote(board, id, 'sad', +1);
  board = { ...board, view: { zoom: 0.5, x: 10, y: 20 } };
  const cleared = L.clearBoard(board);
  assert.deepEqual(cleared.cards, []);
  assert.deepEqual(cleared.health.notes, []);
  assert.deepEqual(areaIds(cleared), areaIds(board));
  assert.deepEqual(area(cleared, id), { id, name: 'Renamed', awesome: 'A', crappy: 'C', votes: { awesome: 0, fine: 0, sad: 0 } });
  assert.deepEqual(cleared.view, { zoom: 0.5, x: 10, y: 20 });
});

test('isBoardEmpty: true only with no notes and every vote at 0', () => {
  const empty = L.emptyBoard();
  assert.equal(L.isBoardEmpty(empty), true);
  assert.equal(L.isBoardEmpty(L.addCard(empty, card('c', 'well', 1))), false);
  assert.equal(L.isBoardEmpty(L.addHealthNote(empty, healthNote('n', 'a'))), false);
  assert.equal(L.isBoardEmpty(L.vote(empty, areaIds(empty)[0], 'fine', +1)), false);
});

// T027 — placing (plan §5.12)
const W = L.NOTE_WIDTH;
const G = L.NOTE_GAP;
const ZW = L.ZONE_WIDTH;
const rect = (x, y, height = 100) => ({ x, y, width: W, height });

test('zone width fits two notes side by side with gaps', () => {
  assert.equal(ZW, 2 * W + 3 * G);
});

test('findFreeSpot: an empty zone starts at the top left', () => {
  assert.deepEqual(L.findFreeSpot([], { width: W, height: 100 }), { x: G, y: G });
});

test('findFreeSpot: fills the second slot in a row, then the next row', () => {
  assert.deepEqual(L.findFreeSpot([rect(G, G)], { width: W, height: 100 }), { x: 2 * G + W, y: G });
  const full = [rect(G, G, 100), rect(2 * G + W, G, 140)];
  const spot = L.findFreeSpot(full, { width: W, height: 100 });
  assert.equal(spot.x, G);
  assert.ok(spot.y >= G + 100 + G, `below the first note, got ${spot.y}`);
});

test('findFreeSpot: never overlaps a note placed anywhere', () => {
  const rects = [rect(G, G, 100), rect(2 * G + W, G, 100), rect(100, 130, 120)];
  const spot = L.findFreeSpot(rects, { width: W, height: 100 });
  const a = { ...spot, width: W, height: 100 };
  for (const b of rects) {
    const overlaps = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    assert.equal(overlaps, false, JSON.stringify({ spot, b }));
  }
});

test('findFreeSpot: uses a gap that opens up between notes', () => {
  const rects = [rect(G, G, 100), rect(G, 400, 100), rect(2 * G + W, G, 600)];
  const spot = L.findFreeSpot(rects, { width: W, height: 100 });
  assert.equal(spot.x, G);
  assert.ok(spot.y > G + 100 && spot.y + 100 < 400, `between the two left notes, got ${spot.y}`);
});

test('tidyLayout: rows of two, each row as tall as its tallest note', () => {
  assert.deepEqual(L.tidyLayout(['a', 'b', 'c', 'd', 'e'], { a: 100, b: 150, c: 80, d: 90, e: 50 }), [
    { id: 'a', x: G, y: G },
    { id: 'b', x: 2 * G + W, y: G },
    { id: 'c', x: G, y: G + 150 + G },
    { id: 'd', x: 2 * G + W, y: G + 150 + G },
    { id: 'e', x: G, y: G + 150 + G + 90 + G },
  ]);
});

test('tidyLayout: guesses a height for notes it has no measurement for', () => {
  const [, second] = L.tidyLayout(['a', 'b', 'c'], {});
  assert.equal(second.y, G);
  assert.equal(L.tidyLayout(['a', 'b', 'c'], {})[2].y, G + L.NOTE_HEIGHT_GUESS + G);
});

test('readingOrder: top to bottom, then left to right; unplaced notes last, in list order', () => {
  const notes = [
    { id: 'low', x: 16, y: 300 },
    { id: 'unplaced1', x: null, y: null },
    { id: 'topRight', x: 232, y: 16 },
    { id: 'topLeft', x: 16, y: 16 },
    { id: 'unplaced2', x: null, y: null },
  ];
  assert.deepEqual(L.readingOrder(notes).map((n) => n.id), ['topLeft', 'topRight', 'low', 'unplaced1', 'unplaced2']);
});

test('zoneHeight: at least the minimum, and always a free strip below the lowest note', () => {
  assert.equal(L.zoneHeight([], 480), 480);
  assert.equal(L.zoneHeight([rect(G, G, 100)], 480), 480);
  const low = rect(G, 600, 120);
  assert.equal(L.zoneHeight([low], 480), 600 + 120 + L.NOTE_HEIGHT_GUESS + 2 * G);
});

// T028 — moving (Story 11)
test('moveNote: moves a card within its column', () => {
  const board = L.moveNote(boardOf(card('a', 'well', 1)), 'a', 'well', 50, 70);
  assert.deepEqual(pick(board.cards[0], 'column', 'x', 'y'), { column: 'well', x: 50, y: 70 });
});

test('moveNote: dropping a card in another column changes its column', () => {
  const board = L.moveNote(boardOf(card('a', 'well', 1)), 'a', 'improve', 20, 30);
  assert.deepEqual(pick(board.cards[0], 'column', 'x', 'y'), { column: 'improve', x: 20, y: 30 });
});

test('moveNote: moves a health note to another area', () => {
  const board = L.moveNote(boardWithNotes(healthNote('n', 'a')), 'n', 'b', 40, 10);
  assert.deepEqual(pick(board.health.notes[0], 'areaId', 'x', 'y'), { areaId: 'b', x: 40, y: 10 });
});

test('moveNote: keeps the note inside the zone width and never above the top', () => {
  const board = boardOf(card('a', 'well', 1));
  assert.deepEqual(pick(L.moveNote(board, 'a', 'well', -30, -5).cards[0], 'x', 'y'), { x: 0, y: 0 });
  assert.deepEqual(pick(L.moveNote(board, 'a', 'well', 9999, 50).cards[0], 'x', 'y'), { x: ZW - W, y: 50 });
});

test('setPositions: places notes without changing their zone', () => {
  const board = L.setPositions(boardOf(card('a', 'well', 1), card('b', 'well', 2)), [{ id: 'b', x: 5, y: 6 }]);
  assert.deepEqual(pick(board.cards[1], 'column', 'x', 'y'), { column: 'well', x: 5, y: 6 });
  assert.equal(board.cards[0].x, null);
});

test('bringToFront: gives the note a higher z than every other note of either kind', () => {
  let board = boardWithNotes(healthNote('n', 'a', { z: 9 }));
  board = L.addCard(board, { ...card('a', 'well', 1), z: 3 });
  board = L.bringToFront(board, 'a');
  assert.equal(board.cards[0].z, 10);
  board = L.bringToFront(board, 'n');
  assert.equal(board.health.notes[0].z, 11);
});

// T029 — zoom maths (Story 10)
test('clampZoom: kept between 25% and 200%', () => {
  assert.equal(L.clampZoom(0.1), 0.25);
  assert.equal(L.clampZoom(3), 2);
  assert.equal(L.clampZoom(0.8), 0.8);
});

test('zoomAt: the point under the pointer stays still', () => {
  const view = { zoom: 1, x: 100, y: 50 };
  const next = L.zoomAt(view, 2, 300, 250);
  const before = { wx: (300 - view.x) / view.zoom, wy: (250 - view.y) / view.zoom };
  const after = { wx: (300 - next.x) / next.zoom, wy: (250 - next.y) / next.zoom };
  assert.equal(next.zoom, 2);
  assert.deepEqual(after, before);
});

test('zoomAt: clamps the zoom and still keeps the point still', () => {
  const next = L.zoomAt({ zoom: 1.5, x: 0, y: 0 }, 5, 100, 100);
  assert.equal(next.zoom, 2);
  assert.equal((100 - next.x) / next.zoom, 100 / 1.5);
});

test('nextZoomStep: steps through 25, 50, 75, 100, 125, 150 and 200%', () => {
  assert.deepEqual(L.ZOOM_STEPS, [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]);
  assert.equal(L.nextZoomStep(1, +1), 1.25);
  assert.equal(L.nextZoomStep(1, -1), 0.75);
  assert.equal(L.nextZoomStep(0.8, +1), 1);
  assert.equal(L.nextZoomStep(0.8, -1), 0.75);
  assert.equal(L.nextZoomStep(2, +1), 2);
  assert.equal(L.nextZoomStep(0.25, -1), 0.25);
});

test('fitView: shows the whole area, centred, with a margin', () => {
  const view = L.fitView({ x: 0, y: 0, width: 2000, height: 1000 }, { width: 1040, height: 800 }, 20);
  assert.equal(view.zoom, 0.5);
  assert.deepEqual([view.x, view.y], [20, 150]);
});

test('fitView: never zooms past the limits', () => {
  assert.equal(L.fitView({ x: 0, y: 0, width: 100, height: 100 }, { width: 2000, height: 2000 }, 0).zoom, 2);
  assert.equal(L.fitView({ x: 0, y: 0, width: 99999, height: 100 }, { width: 1000, height: 800 }, 0).zoom, 0.25);
});

function pick(obj, ...keys) {
  return Object.fromEntries(keys.map((k) => [k, obj[k]]));
}

test('findFreeSpot: keeps a full gap below the lowest note, even off the scan grid', () => {
  // A note ending at y=121 is off the 8px scan grid; the spot below must still be a gap away.
  const rects = [{ x: G, y: G, width: W, height: 105 }, { x: 2 * G + W, y: G, width: W, height: 105 }];
  const spot = L.findFreeSpot(rects, { width: W, height: 100 });
  assert.ok(spot.y >= G + 105 + G, `got ${spot.y}`);
});
