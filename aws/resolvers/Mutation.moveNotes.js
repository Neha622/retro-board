// moveNotes: moves 1–24 notes. Anyone may move any note (spec Story 11.8).
// Used for dragging (1 note) and Sort by votes (sent in chunks of 24).
// Each move is { id, x, y, z } plus `column` for a card or `areaId` for a health note.
import { util } from '@aws-appsync/utils';

const TABLE = 'RetroBoard';
const KEEP_SECONDS = 90 * 24 * 60 * 60;
const MAX_PER_CALL = 24; // + 1 board item = 25, the most AppSync allows in one transaction
const COLUMNS = ['well', 'notWell', 'improve'];

export function request(ctx) {
  const { boardId } = ctx.args;
  const moves = parseMoves(ctx.args.moves);
  const now = util.time.nowEpochSeconds();

  const updates = moves.map((move) => {
    const isCard = typeof move.column === 'string';
    if (isCard && COLUMNS.indexOf(move.column) < 0) util.error('Bad column', 'Invalid');
    if (!isCard && typeof move.areaId !== 'string') util.error('A move needs a column or an area', 'Invalid');
    const placeName = isCard ? 'column' : 'areaId';
    return {
      table: TABLE,
      operation: 'UpdateItem',
      key: util.dynamodb.toMapValues({ pk: boardId, sk: 'NOTE#' + move.id }),
      update: {
        expression: 'SET #x = :x, #y = :y, #z = :z, #place = :place',
        expressionNames: { '#x': 'x', '#y': 'y', '#z': 'z', '#place': placeName },
        expressionValues: util.dynamodb.toMapValues({ ':x': move.x, ':y': move.y, ':z': move.z, ':place': isCard ? move.column : move.areaId }),
      },
      // A card can only move to a column, and a health note only to an area.
      condition: {
        expression: 'attribute_exists(pk) AND #kind = :kind',
        expressionNames: { '#kind': 'kind' },
        expressionValues: util.dynamodb.toMapValues({ ':kind': isCard ? 'card' : 'health' }),
      },
    };
  });

  return { operation: 'TransactWriteItems', transactItems: [touchBoard(boardId, now), ...updates] };
}

export function response(ctx) {
  if (ctx.error) {
    const failed = failedIndex(ctx);
    if (failed === 0) util.error('The board is missing', 'BoardChanged');
    if (failed > 0) util.error('A note was deleted or changed kind', 'NoteMissing');
    util.error(ctx.error.message, ctx.error.type);
  }
  return {
    boardId: ctx.args.boardId,
    changeId: ctx.args.changeId,
    type: 'notesMoved',
    data: { moves: parseMoves(ctx.args.moves) },
  };
}

function parseMoves(value) {
  const moves = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(moves) || moves.length < 1 || moves.length > MAX_PER_CALL) {
    util.error('Send 1 to 24 moves at a time', 'Invalid');
  }
  moves.forEach((move) => {
    if (!move || typeof move.id !== 'string' || typeof move.x !== 'number' || typeof move.y !== 'number' || typeof move.z !== 'number') {
      util.error('Bad move', 'Invalid');
    }
  });
  return moves;
}

// Stamps the board as changed now, so it is kept for another 90 days.
function touchBoard(boardId, now) {
  return {
    table: TABLE,
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({ pk: boardId, sk: 'BOARD' }),
    update: {
      expression: 'SET #updatedAt = :now, #expiresAt = :expires',
      expressionNames: { '#updatedAt': 'updatedAt', '#expiresAt': 'expiresAt' },
      expressionValues: util.dynamodb.toMapValues({ ':now': now, ':expires': now + KEEP_SECONDS }),
    },
    condition: { expression: 'attribute_exists(pk)' },
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
