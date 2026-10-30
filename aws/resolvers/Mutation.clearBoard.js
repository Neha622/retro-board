// clearBoard: removes all notes and votes for everyone. Only the facilitator may (spec Story 8).
// Notes aren't deleted one by one here: the generation goes up by 1, which hides every older
// note at once. The facilitator's browser then deletes them in the background with removeNotes.
import { util } from '@aws-appsync/utils';

const KEEP_SECONDS = 90 * 24 * 60 * 60;
const MAX_AREAS = 50;

export function request(ctx) {
  const { boardId, secret, areaIds } = ctx.args;
  if (areaIds.length > MAX_AREAS) util.error('Too many areas', 'Invalid');
  const now = util.time.nowEpochSeconds();

  // Each area's votes are set back to 0 one by one, so areas are never lost from the map.
  const names = {
    '#generation': 'generation',
    '#noteCount': 'noteCount',
    '#votes': 'votes',
    '#updatedAt': 'updatedAt',
    '#expiresAt': 'expiresAt',
  };
  const sets = ['#generation = #generation + :one', '#noteCount = :zero', '#updatedAt = :now', '#expiresAt = :expires'];
  areaIds.forEach((areaId, i) => {
    names['#area' + i] = areaId;
    sets.push('#votes.#area' + i + ' = :noVotes');
  });

  return {
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({ pk: boardId, sk: 'BOARD' }),
    update: {
      expression: 'SET ' + sets.join(', '),
      expressionNames: names,
      expressionValues: util.dynamodb.toMapValues({
        ':one': 1,
        ':zero': 0,
        ':noVotes': { awesome: 0, fine: 0, sad: 0 },
        ':now': now,
        ':expires': now + KEEP_SECONDS,
      }),
    },
    condition: {
      expression: '#facilitatorSecret = :secret',
      expressionNames: { '#facilitatorSecret': 'facilitatorSecret' },
      expressionValues: util.dynamodb.toMapValues({ ':secret': secret }),
    },
  };
}

export function response(ctx) {
  if (ctx.error) {
    if (ctx.error.type === 'DynamoDB:ConditionalCheckFailedException') {
      util.error('Only the facilitator can clear the board', 'NotFacilitator');
    }
    util.error(ctx.error.message, ctx.error.type);
  }
  return {
    boardId: ctx.args.boardId,
    changeId: ctx.args.changeId,
    type: 'boardCleared',
    data: { generation: ctx.result.generation, areaIds: ctx.args.areaIds },
  };
}
