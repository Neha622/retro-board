// listNotes: reads a board's notes of the current generation, one page at a time (plan §5.15).
// Call again with nextToken until it comes back empty.
import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const query = {
    operation: 'Query',
    query: {
      expression: 'pk = :pk AND begins_with(sk, :prefix)',
      expressionValues: util.dynamodb.toMapValues({ ':pk': ctx.args.boardId, ':prefix': 'NOTE#' }),
    },
    // Notes from before the last Clear board are hidden (plan §4).
    filter: {
      expression: '#generation = :generation',
      expressionNames: { '#generation': 'generation' },
      expressionValues: util.dynamodb.toMapValues({ ':generation': ctx.args.generation }),
    },
    consistentRead: true,
    limit: 100,
  };
  if (ctx.args.nextToken) query.nextToken = ctx.args.nextToken;
  return query;
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const secret = ctx.args.secret;
  const notes = ctx.result.items.map((item) => ({
    id: item.id,
    kind: item.kind,
    column: item.column,
    areaId: item.areaId,
    text: item.text,
    createdAt: item.createdAt,
    x: item.x,
    y: item.y,
    z: item.z,
    reactions: item.reactions,
    // The owner's secret is never returned, only whether it matches (plan §5.17).
    mine: item.ownerSecret === secret,
  }));
  return { notes, nextToken: ctx.result.nextToken };
}
