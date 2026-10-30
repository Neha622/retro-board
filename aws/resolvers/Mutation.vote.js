// vote: +1 or −1 on an area's Awesome, Fine or Sad count. Anyone may vote (spec Story 13).
// Votes live in the board item, so this is one update that also stamps the board.
import { util } from '@aws-appsync/utils';

const KEEP_SECONDS = 90 * 24 * 60 * 60;
const KINDS = ['awesome', 'fine', 'sad'];

export function request(ctx) {
  const { boardId, areaId, kind, delta } = ctx.args;
  if (KINDS.indexOf(kind) < 0) util.error('Bad vote kind', 'Invalid');
  if (delta !== 1 && delta !== -1) util.error('delta must be 1 or -1', 'Invalid');
  const now = util.time.nowEpochSeconds();
  const names = { '#votes': 'votes', '#area': areaId, '#kind': kind };

  // The area must exist, and a count can never go below 0.
  const condition = delta === 1
    ? { expression: 'attribute_exists(#votes.#area.#kind)', expressionNames: names }
    : {
        expression: '#votes.#area.#kind >= :one',
        expressionNames: names,
        expressionValues: util.dynamodb.toMapValues({ ':one': 1 }),
      };

  return {
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({ pk: boardId, sk: 'BOARD' }),
    update: {
      expression: 'SET #votes.#area.#kind = #votes.#area.#kind + :delta, #updatedAt = :now, #expiresAt = :expires',
      expressionNames: { '#votes': 'votes', '#area': areaId, '#kind': kind, '#updatedAt': 'updatedAt', '#expiresAt': 'expiresAt' },
      expressionValues: util.dynamodb.toMapValues({ ':delta': delta, ':now': now, ':expires': now + KEEP_SECONDS }),
    },
    condition,
  };
}

export function response(ctx) {
  if (ctx.error) {
    if (ctx.error.type === 'DynamoDB:ConditionalCheckFailedException') {
      util.error('The area was deleted, or the count is already 0', 'BoardChanged');
    }
    util.error(ctx.error.message, ctx.error.type);
  }
  const { areaId, kind, delta } = ctx.args;
  return {
    boardId: ctx.args.boardId,
    changeId: ctx.args.changeId,
    type: 'voted',
    // Sent as +1 or −1, not a total, so votes from several people add up (plan §5.16).
    data: { areaId, kind, delta },
  };
}
