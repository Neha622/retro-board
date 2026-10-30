// react: +1 or −1 on one of a note's reactions. Anyone may react to any note (spec Story 4).
// The count is changed on AWS, so clicks from several people at once all add up.
import { util } from '@aws-appsync/utils';

const TABLE = 'RetroBoard';
const KEEP_SECONDS = 90 * 24 * 60 * 60;
const REACTIONS = ['thumbsUp', 'heart', 'laugh', 'party', 'wow'];

export function request(ctx) {
  const { boardId, noteId, reaction, delta } = ctx.args;
  if (REACTIONS.indexOf(reaction) < 0) util.error('Bad reaction', 'Invalid');
  if (delta !== 1 && delta !== -1) util.error('delta must be 1 or -1', 'Invalid');
  const now = util.time.nowEpochSeconds();

  // A count can never go below 0.
  const condition = delta === 1
    ? { expression: 'attribute_exists(pk)' }
    : {
        expression: 'attribute_exists(pk) AND #reactions.#reaction >= :one',
        expressionNames: { '#reactions': 'reactions', '#reaction': reaction },
        expressionValues: util.dynamodb.toMapValues({ ':one': 1 }),
      };

  return {
    operation: 'TransactWriteItems',
    transactItems: [
      {
        table: TABLE,
        operation: 'UpdateItem',
        key: util.dynamodb.toMapValues({ pk: boardId, sk: 'NOTE#' + noteId }),
        update: {
          expression: 'SET #reactions.#reaction = #reactions.#reaction + :delta',
          expressionNames: { '#reactions': 'reactions', '#reaction': reaction },
          expressionValues: util.dynamodb.toMapValues({ ':delta': delta }),
        },
        condition,
      },
      touchBoard(boardId, now),
    ],
  };
}

export function response(ctx) {
  if (ctx.error) {
    const failed = failedIndex(ctx);
    if (failed === 0) util.error('The note was deleted, or the count is already 0', 'NoteMissing');
    if (failed === 1) util.error('The board is missing', 'BoardChanged');
    util.error(ctx.error.message, ctx.error.type);
  }
  const { noteId, reaction, delta } = ctx.args;
  return {
    boardId: ctx.args.boardId,
    changeId: ctx.args.changeId,
    type: 'reacted',
    // Sent as +1 or −1, not a total, so changes from several people add up (plan §5.16).
    data: { noteId, reaction, delta },
  };
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
