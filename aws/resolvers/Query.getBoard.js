// getBoard: reads one board's settings, areas and votes (plan §5.15).
// Returns null when the board doesn't exist or has expired.
import { util } from '@aws-appsync/utils';

export function request(ctx) {
  return {
    operation: 'GetItem',
    key: util.dynamodb.toMapValues({ pk: ctx.args.boardId, sk: 'BOARD' }),
    consistentRead: true,
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const board = ctx.result;
  // DynamoDB's TTL can take a day or two to remove an expired item, so check the time too.
  if (!board || board.expiresAt < util.time.nowEpochSeconds()) return null;
  return {
    boardId: board.pk,
    generation: board.generation,
    noteCount: board.noteCount,
    areas: board.areas,
    votes: board.votes,
    // The secret itself is never returned, only whether it matches (plan §5.17).
    isFacilitator: board.facilitatorSecret === ctx.args.secret,
    updatedAt: board.updatedAt,
  };
}
