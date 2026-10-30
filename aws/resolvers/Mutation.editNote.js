// editNote: changes a note's text. Only the note's owner may (plan §5.17, spec Story 6).
import { util } from '@aws-appsync/utils';

const TABLE = 'RetroBoard';
const KEEP_SECONDS = 90 * 24 * 60 * 60;
const MAX_TEXT_UNITS = 3000; // generous: 200 characters, however many units each emoji takes

export function request(ctx) {
  const { boardId, secret, noteId, text } = ctx.args;
  if (text.length < 1 || text.length > MAX_TEXT_UNITS) util.error('Bad note text', 'Invalid');
  const now = util.time.nowEpochSeconds();
  return {
    operation: 'TransactWriteItems',
    transactItems: [
      {
        table: TABLE,
        operation: 'UpdateItem',
        key: util.dynamodb.toMapValues({ pk: boardId, sk: 'NOTE#' + noteId }),
        update: {
          expression: 'SET #text = :text',
          expressionNames: { '#text': 'text' },
          expressionValues: util.dynamodb.toMapValues({ ':text': text }),
        },
        condition: {
          expression: 'attribute_exists(pk) AND #ownerSecret = :secret',
          expressionNames: { '#ownerSecret': 'ownerSecret' },
          expressionValues: util.dynamodb.toMapValues({ ':secret': secret }),
        },
      },
      touchBoard(boardId, now),
    ],
  };
}

export function response(ctx) {
  if (ctx.error) {
    const failed = failedIndex(ctx);
    if (failed === 0) util.error('You can only change your own notes', 'NotYours');
    if (failed === 1) util.error('The board is missing', 'BoardChanged');
    util.error(ctx.error.message, ctx.error.type);
  }
  return {
    boardId: ctx.args.boardId,
    changeId: ctx.args.changeId,
    type: 'noteEdited',
    data: { noteId: ctx.args.noteId, text: ctx.args.text },
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
