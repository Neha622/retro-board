// removeNotes: deletes up to 24 leftover notes after a Clear board or a deleted area.
// Only the facilitator may. The notes are already hidden on every screen, so this
// change isn't sent to anyone (it isn't in the subscription's list).
import { util } from '@aws-appsync/utils';

const TABLE = 'RetroBoard';
const MAX_PER_CALL = 24; // + 1 board check = 25, the most AppSync allows in one transaction

export function request(ctx) {
  const { boardId, secret, noteIds } = ctx.args;
  if (noteIds.length < 1 || noteIds.length > MAX_PER_CALL) util.error('Send 1 to 24 note ids at a time', 'Invalid');

  const check = {
    table: TABLE,
    operation: 'ConditionCheck',
    key: util.dynamodb.toMapValues({ pk: boardId, sk: 'BOARD' }),
    condition: {
      expression: '#facilitatorSecret = :secret',
      expressionNames: { '#facilitatorSecret': 'facilitatorSecret' },
      expressionValues: util.dynamodb.toMapValues({ ':secret': secret }),
    },
  };
  const deletes = noteIds.map((noteId) => ({
    table: TABLE,
    operation: 'DeleteItem',
    key: util.dynamodb.toMapValues({ pk: boardId, sk: 'NOTE#' + noteId }),
  }));

  return { operation: 'TransactWriteItems', transactItems: [check, ...deletes] };
}

export function response(ctx) {
  if (ctx.error) {
    const reasons = (ctx.result && ctx.result.cancellationReasons) || [];
    if (reasons.length > 0 && reasons[0] && reasons[0].type === 'ConditionalCheckFailed') {
      util.error('Only the facilitator can remove notes', 'NotFacilitator');
    }
    util.error(ctx.error.message, ctx.error.type);
  }
  return {
    boardId: ctx.args.boardId,
    changeId: ctx.args.changeId,
    type: 'notesRemoved',
    data: { noteIds: ctx.args.noteIds },
  };
}
