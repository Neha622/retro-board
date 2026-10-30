// addNotes: adds 1–24 notes, owned by the caller (plan §5.15, §5.17).
// One transaction: the board's note count goes up, and each note is created.
// Refused if the board is missing, has been cleared since (generation changed), or would go over 300 notes.
import { util } from '@aws-appsync/utils';

const TABLE = 'RetroBoard';
const KEEP_SECONDS = 90 * 24 * 60 * 60;
const MAX_NOTES = 300;
const MAX_PER_CALL = 24; // + 1 board item = 25, the most AppSync allows in one transaction
const MAX_TEXT_UNITS = 3000; // generous: 200 characters, however many units each emoji takes
const COLUMNS = ['well', 'notWell', 'improve'];
const REACTIONS = ['thumbsUp', 'heart', 'laugh', 'party', 'wow'];

export function request(ctx) {
  const { boardId, secret, generation } = ctx.args;
  checkSecret(secret);
  const notes = typeof ctx.args.notes === 'string' ? JSON.parse(ctx.args.notes) : ctx.args.notes;
  if (!Array.isArray(notes) || notes.length < 1 || notes.length > MAX_PER_CALL) {
    util.error('Send 1 to 24 notes at a time', 'Invalid');
  }
  const now = util.time.nowEpochSeconds();

  const board = {
    table: TABLE,
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({ pk: boardId, sk: 'BOARD' }),
    update: {
      expression: 'SET #noteCount = #noteCount + :added, #updatedAt = :now, #expiresAt = :expires',
      expressionNames: { '#noteCount': 'noteCount', '#updatedAt': 'updatedAt', '#expiresAt': 'expiresAt' },
      expressionValues: util.dynamodb.toMapValues({ ':added': notes.length, ':now': now, ':expires': now + KEEP_SECONDS }),
    },
    condition: {
      expression: 'attribute_exists(pk) AND #generation = :generation AND #noteCount <= :room',
      expressionNames: { '#generation': 'generation', '#noteCount': 'noteCount' },
      expressionValues: util.dynamodb.toMapValues({ ':generation': generation, ':room': MAX_NOTES - notes.length }),
    },
  };

  const puts = notes.map((note) => {
    const clean = cleanNote(note, now);
    return {
      table: TABLE,
      operation: 'PutItem',
      key: util.dynamodb.toMapValues({ pk: boardId, sk: 'NOTE#' + clean.id }),
      attributeValues: util.dynamodb.toMapValues({
        id: clean.id,
        kind: clean.kind,
        column: clean.column,
        areaId: clean.areaId,
        text: clean.text,
        createdAt: clean.createdAt,
        x: clean.x,
        y: clean.y,
        z: clean.z,
        reactions: clean.reactions,
        ownerSecret: secret,
        generation,
      }),
      condition: { expression: 'attribute_not_exists(pk)' },
    };
  });

  // The board comes first, so a refusal at index 0 means "the board said no".
  return { operation: 'TransactWriteItems', transactItems: [board, ...puts] };
}

export function response(ctx) {
  if (ctx.error) {
    const failed = failedIndex(ctx);
    if (failed === 0) util.error('The board is missing, full, or was just cleared', 'BoardChanged');
    if (failed > 0) util.error('A note with that id already exists', 'Invalid');
    util.error(ctx.error.message, ctx.error.type);
  }
  const notes = typeof ctx.args.notes === 'string' ? JSON.parse(ctx.args.notes) : ctx.args.notes;
  const now = util.time.nowEpochSeconds();
  // Sent to everyone, so no secrets. The app marks the notes as mine for the person who added them.
  const shared = notes.map((note) => cleanNote(note, now));
  return {
    boardId: ctx.args.boardId,
    changeId: ctx.args.changeId,
    type: 'notesAdded',
    data: { generation: ctx.args.generation, notes: shared },
  };
}

function cleanNote(note, now) {
  if (!note || typeof note.id !== 'string' || note.id.length < 1 || note.id.length > 64) {
    util.error('Bad note id', 'Invalid');
  }
  if (typeof note.text !== 'string' || note.text.length < 1 || note.text.length > MAX_TEXT_UNITS) {
    util.error('Bad note text', 'Invalid');
  }
  const isCard = note.kind === 'card';
  if (isCard && COLUMNS.indexOf(note.column) < 0) util.error('Bad column', 'Invalid');
  if (!isCard && (note.kind !== 'health' || typeof note.areaId !== 'string')) util.error('Bad note kind', 'Invalid');

  // Reactions are only non-zero when an old board is being moved (spec Story 20).
  const reactions = {};
  REACTIONS.forEach((name) => {
    const n = note.reactions ? note.reactions[name] : 0;
    reactions[name] = typeof n === 'number' && n >= 0 && n <= 100000 ? Math.floor(n) : 0;
  });

  return {
    id: note.id,
    kind: note.kind,
    column: isCard ? note.column : null,
    areaId: isCard ? null : note.areaId,
    text: note.text,
    createdAt: typeof note.createdAt === 'number' ? note.createdAt : now * 1000,
    x: typeof note.x === 'number' ? note.x : null,
    y: typeof note.y === 'number' ? note.y : null,
    z: typeof note.z === 'number' ? note.z : 0,
    reactions,
  };
}

// Which item in the transaction failed its condition, or -1.
function failedIndex(ctx) {
  const reasons = (ctx.result && ctx.result.cancellationReasons) || [];
  let found = -1;
  reasons.forEach((reason, i) => {
    if (found < 0 && reason && reason.type === 'ConditionalCheckFailed') found = i;
  });
  return found;
}

function checkSecret(secret) {
  if (typeof secret !== 'string' || secret.length < 20 || secret.length > 100) util.error('Bad secret', 'Invalid');
}
