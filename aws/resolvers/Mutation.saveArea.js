// saveArea: adds a new health check area, or edits one. Only the facilitator may (spec Story 15).
// `area` is { id, name, awesome, crappy, order }.
import { util } from '@aws-appsync/utils';

const KEEP_SECONDS = 90 * 24 * 60 * 60;
const MAX_NAME_UNITS = 400; // generous: 40 characters, however many units each emoji takes
const MAX_TEXT_UNITS = 3000; // generous: 200 characters, however many units each emoji takes

export function request(ctx) {
  const { boardId, secret, isNew } = ctx.args;
  const area = cleanArea(ctx.args.area);
  const now = util.time.nowEpochSeconds();

  const names = { '#areas': 'areas', '#id': area.id, '#updatedAt': 'updatedAt', '#expiresAt': 'expiresAt' };
  const values = {
    ':area': { name: area.name, awesome: area.awesome, crappy: area.crappy, order: area.order },
    ':now': now,
    ':expires': now + KEEP_SECONDS,
  };
  let expression = 'SET #areas.#id = :area, #updatedAt = :now, #expiresAt = :expires';
  if (isNew) {
    names['#votes'] = 'votes';
    values[':noVotes'] = { awesome: 0, fine: 0, sad: 0 };
    expression += ', #votes.#id = :noVotes';
  }

  return {
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({ pk: boardId, sk: 'BOARD' }),
    update: { expression, expressionNames: names, expressionValues: util.dynamodb.toMapValues(values) },
    condition: {
      expression: '#facilitatorSecret = :secret AND ' + (isNew ? 'attribute_not_exists(#areas.#id)' : 'attribute_exists(#areas.#id)'),
      expressionNames: { '#facilitatorSecret': 'facilitatorSecret', '#areas': 'areas', '#id': area.id },
      expressionValues: util.dynamodb.toMapValues({ ':secret': secret }),
    },
  };
}

export function response(ctx) {
  if (ctx.error) {
    if (ctx.error.type === 'DynamoDB:ConditionalCheckFailedException') {
      util.error('Only the facilitator can change areas', 'NotFacilitator');
    }
    util.error(ctx.error.message, ctx.error.type);
  }
  return {
    boardId: ctx.args.boardId,
    changeId: ctx.args.changeId,
    type: 'areaSaved',
    data: { area: cleanArea(ctx.args.area), isNew: ctx.args.isNew },
  };
}

function cleanArea(value) {
  const area = typeof value === 'string' ? JSON.parse(value) : value;
  if (!area || typeof area.id !== 'string' || area.id.length < 1 || area.id.length > 64) util.error('Bad area id', 'Invalid');
  if (typeof area.name !== 'string' || area.name.length < 1 || area.name.length > MAX_NAME_UNITS) {
    util.error('An area needs a name', 'Invalid');
  }
  return {
    id: area.id,
    name: area.name,
    awesome: shortText(area.awesome),
    crappy: shortText(area.crappy),
    order: typeof area.order === 'number' ? area.order : 0,
  };
}

function shortText(text) {
  if (typeof text !== 'string') return '';
  if (text.length > MAX_TEXT_UNITS) util.error('Text too long', 'Invalid');
  return text;
}
