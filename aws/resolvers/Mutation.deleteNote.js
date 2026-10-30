// deleteNote: deletes a note. Only the note's owner may (plan §5.17, spec Story 6).
// One transaction: the note is deleted and the board's note count goes down.
import { util } from '@aws-appsync/utils';

const TABLE = 'RetroBoard';
const KEEP_SECONDS = 90 * 24 * 60 * 60;

export function request(ctx) {
  const { boardId, secret, noteId, generation } = ctx.args;
  const now = util.time.nowEpochSeconds();
  return {
    operation: 'TransactWriteItems',
    transactItems: [
      {
        table: TABLE,
        operation: 'DeleteItem',
        key: util.dynamodb.toMapValues({ pk: boardId, sk: 'NOTE#' + noteId }),
        // A note from before the last Clear no longer counts, so it must not lower the count.
        condition: {
          expression: 'attribute_exists(pk) AND #ownerSecret = :secret AND #generation = :generation',
          expressionNames: { '#ownerSecret': 'ownerSecret', '#generation': 'generation' },
          expressionValues: util.dynamodb.toMapValues({ ':secret': secret, ':generation': generation }),
        },
      },
      {
        table: TABLE,
        operation: 'UpdateItem',
        key: util.dynamodb.toMapValues({ pk: boardId, sk: 'BOARD' }),
        update: {
          expression: 'SET #noteCount = #noteCount - :one, #updatedAt = :now, #expiresAt = :expires',
          expressionNames: { '#noteCount': 'noteCount', '#updatedAt': 'updatedAt', '#expiresAt': 'expiresAt' },
          expressionValues: util.dynamodb.toMapValues({ ':one': 1, ':now': now, ':expires': now + KEEP_SECONDS }),
        },
        condition: {
          expression: 'attribute_exists(pk) AND #generation = :generation',
          expressionNames: { '#generation': 'generation' },
          expressionValues: util.dynamodb.toMapValues({ ':generation': generation }),
        },
      },
    ],
  };
}

export function response(ctx) {
  if (ctx.error) {
    const failed = failedIndex(ctx);
    if (failed === 0) util.error('You can only delete your own notes', 'NotYours');
    if (failed === 1) util.error('The board is missing or was just cleared', 'BoardChanged');
    util.error(ctx.error.message, ctx.error.type);
  }
  return {
    boardId: ctx.args.boardId,
    changeId: ctx.args.changeId,
    type: 'noteDeleted',
    data: { noteId: ctx.args.noteId },
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
