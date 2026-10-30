// deleteArea: removes a health check area and its votes. Only the facilitator may (spec Story 15.5).
// The area's health notes vanish from every screen at once (their area is gone), and the
// facilitator's browser deletes them in the background with removeNotes. `removedNotes` is how
// many of them there are, so the board's note count stays right.
import { util } from '@aws-appsync/utils';

const KEEP_SECONDS = 90 * 24 * 60 * 60;

export function request(ctx) {
  const { boardId, secret, areaId, removedNotes } = ctx.args;
  if (removedNotes < 0 || removedNotes > 300) util.error('Bad note count', 'Invalid');
  const now = util.time.nowEpochSeconds();
  return {
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({ pk: boardId, sk: 'BOARD' }),
    update: {
      expression: 'SET #noteCount = #noteCount - :removed, #updatedAt = :now, #expiresAt = :expires REMOVE #areas.#id, #votes.#id',
      expressionNames: {
        '#noteCount': 'noteCount',
        '#updatedAt': 'updatedAt',
        '#expiresAt': 'expiresAt',
        '#areas': 'areas',
        '#votes': 'votes',
        '#id': areaId,
      },
      expressionValues: util.dynamodb.toMapValues({ ':removed': removedNotes, ':now': now, ':expires': now + KEEP_SECONDS }),
    },
    condition: {
      expression: '#facilitatorSecret = :secret AND attribute_exists(#areas.#id) AND #noteCount >= :removed',
      expressionNames: { '#facilitatorSecret': 'facilitatorSecret', '#areas': 'areas', '#id': areaId, '#noteCount': 'noteCount' },
      expressionValues: util.dynamodb.toMapValues({ ':secret': secret, ':removed': removedNotes }),
    },
  };
}

export function response(ctx) {
  if (ctx.error) {
    if (ctx.error.type === 'DynamoDB:ConditionalCheckFailedException') {
      util.error('Only the facilitator can delete areas', 'NotFacilitator');
    }
    util.error(ctx.error.message, ctx.error.type);
  }
  return {
    boardId: ctx.args.boardId,
    changeId: ctx.args.changeId,
    type: 'areaDeleted',
    data: { areaId: ctx.args.areaId },
  };
}
