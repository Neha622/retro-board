// Tests for cloud.js against the fake AWS (plan §7, task T073). Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../logic.js');
const C = require('../cloud.js');
const { startFakeAws } = require('./fake-aws.js');

const ALICE = 'alice-secret-1234567890';
const BOB = 'bob-secret-12345678901';

let fake;
let alice;
let bob;

test.before(async () => {
  fake = await startFakeAws({ kaMs: 50, connectionTimeoutMs: 300 });
  const options = { ...fake.config, retryDelays: [50] };
  alice = C.createClient(options);
  bob = C.createClient(options);
});

test.after(() => fake.close());

// Waits until `check()` is true, or fails after `ms`.
async function until(check, ms = 2000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('Timed out waiting');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function newBoard(secret = ALICE) {
  const boardId = C.makeId();
  const { areas, votes } = L.areasToServer(L.emptyBoard());
  await alice.mutate('createBoard', { boardId, secret, areas, votes });
  return boardId;
}

function noteFor(id, extra = {}) {
  return { ...L.noteToServer({ ...L.createCard({ id, column: 'well', text: 'Card ' + id + ' 🎉', createdAt: 1 }), x: 16, y: 16 }), ...extra };
}

function watchAll(client, boardId) {
  const seen = { changes: [], states: [] };
  seen.watcher = client.watch(boardId, {
    onChange: (c) => seen.changes.push(c),
    onState: (s) => seen.states.push(s),
  });
  return seen;
}

test('makeId: random UUIDs', () => {
  assert.match(C.makeId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(C.makeId(), C.makeId());
});

test('createBoard and getBoard: the creator is the facilitator, others are not', async () => {
  const boardId = await newBoard();
  const forAlice = await alice.getBoard(boardId, ALICE);
  const forBob = await bob.getBoard(boardId, BOB);
  assert.equal(forAlice.isFacilitator, true);
  assert.equal(forBob.isFacilitator, false);
  assert.equal(Object.keys(forBob.areas).length, 11);
  assert.equal(forBob.generation, 0);
});

test('getBoard: a missing board gives null', async () => {
  assert.equal(await bob.getBoard('no-such-board', BOB), null);
});

test('mutate: returns the confirmed change with its data as an object', async () => {
  const boardId = await newBoard();
  const change = await alice.mutate('addNotes', { boardId, secret: ALICE, generation: 0, notes: [noteFor('n1')] });
  assert.equal(change.type, 'notesAdded');
  assert.match(change.changeId, /^[0-9a-f-]{36}$/);
  assert.deepEqual(change.data.notes.map((n) => n.text), ['Card n1 🎉']);
});

test('listAllNotes: every note, over several pages, each marked mine or not', async () => {
  const boardId = await newBoard();
  const ids = Array.from({ length: 130 }, (_, i) => 'n' + i);
  for (const piece of L.chunk(ids)) {
    await alice.mutate('addNotes', { boardId, secret: ALICE, generation: 0, notes: piece.map((id) => noteFor(id)) });
  }
  const forBob = await bob.listAllNotes(boardId, BOB, 0);
  assert.equal(forBob.length, 130);
  assert.ok(forBob.every((n) => n.mine === false));
  assert.ok((await alice.listAllNotes(boardId, ALICE, 0)).every((n) => n.mine === true));
});

test('refusals come back as CloudErrors with AWS\'s error type', async () => {
  const boardId = await newBoard();
  await alice.mutate('addNotes', { boardId, secret: ALICE, generation: 0, notes: [noteFor('n1')] });
  const refused = (type) => (e) => e instanceof C.CloudError && e.type === type;
  await assert.rejects(bob.mutate('editNote', { boardId, secret: BOB, noteId: 'n1', text: 'Hacked' }), refused('NotYours'));
  await assert.rejects(bob.mutate('deleteNote', { boardId, secret: BOB, generation: 0, noteId: 'n1' }), refused('NotYours'));
  await assert.rejects(bob.mutate('clearBoard', { boardId, secret: BOB, areaIds: [] }), refused('NotFacilitator'));
  await assert.rejects(bob.mutate('addNotes', { boardId, secret: BOB, generation: 7, notes: [noteFor('n2')] }), refused('BoardChanged'));
  await assert.rejects(alice.mutate('createBoard', { boardId, secret: ALICE, areas: {}, votes: {} }), refused('BoardExists'));
});

test('a wrong API key is refused', async () => {
  const stranger = C.createClient({ ...fake.config, apiKey: 'wrong' });
  await assert.rejects(stranger.getBoard('anything', BOB), (e) => e instanceof C.CloudError && e.type === 'UnauthorizedException');
});

test('watch: Bob sees Alice\'s new card live, and both see Bob\'s reaction', async () => {
  const boardId = await newBoard();
  const aliceSees = watchAll(alice, boardId);
  const bobSees = watchAll(bob, boardId);
  await until(() => aliceSees.states.includes('live') && bobSees.states.includes('live'));

  await alice.mutate('addNotes', { boardId, secret: ALICE, generation: 0, notes: [noteFor('n1')] });
  await until(() => bobSees.changes.some((c) => c.type === 'notesAdded'));
  assert.equal(bobSees.changes[0].data.notes[0].text, 'Card n1 🎉');

  const reaction = await bob.mutate('react', { boardId, noteId: 'n1', reaction: 'thumbsUp', delta: 1 });
  await until(() => aliceSees.changes.some((c) => c.changeId === reaction.changeId));
  assert.deepEqual(aliceSees.changes.at(-1).data, { noteId: 'n1', reaction: 'thumbsUp', delta: 1 });

  aliceSees.watcher.stop();
  bobSees.watcher.stop();
});

test('watch: only changes to the watched board arrive', async () => {
  const watched = await newBoard();
  const other = await newBoard();
  const seen = watchAll(bob, watched);
  await until(() => seen.states.includes('live'));
  await alice.mutate('addNotes', { boardId: other, secret: ALICE, generation: 0, notes: [noteFor('elsewhere')] });
  await alice.mutate('addNotes', { boardId: watched, secret: ALICE, generation: 0, notes: [noteFor('here')] });
  await until(() => seen.changes.length > 0);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.deepEqual(seen.changes.map((c) => c.data.notes[0].id), ['here']);
  seen.watcher.stop();
});

test('watch: a dropped connection is reported lost, then comes back live on its own', async () => {
  const boardId = await newBoard();
  const seen = watchAll(bob, boardId);
  await until(() => seen.states.includes('live'));
  fake.drop();
  await until(() => seen.states.includes('lost'));
  await until(() => seen.states.lastIndexOf('live') > seen.states.indexOf('lost'));
  await alice.mutate('addNotes', { boardId, secret: ALICE, generation: 0, notes: [noteFor('after')] });
  await until(() => seen.changes.some((c) => c.type === 'notesAdded'));
  seen.watcher.stop();
});

test('watch: keeps retrying while offline, and reconnects once back', async () => {
  const boardId = await newBoard();
  const seen = watchAll(bob, boardId);
  await until(() => seen.states.includes('live'));
  fake.setBlocked(true);
  await until(() => seen.states.filter((s) => s === 'lost').length >= 2);
  await assert.rejects(bob.getBoard(boardId, BOB), (e) => e.type === 'Network');
  fake.setBlocked(false);
  await until(() => seen.states.at(-1) === 'live');
  seen.watcher.stop();
});

test('watch: a connection that stops sending keep-alives counts as lost', async () => {
  const boardId = await newBoard();
  const seen = watchAll(bob, boardId);
  await until(() => seen.states.includes('live'));
  fake.pauseKeepAlive(true);
  await until(() => seen.states.includes('lost'));
  fake.pauseKeepAlive(false);
  await until(() => seen.states.at(-1) === 'live');
  seen.watcher.stop();
});
