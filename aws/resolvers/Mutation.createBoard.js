// createBoard: creates a board. The caller becomes its facilitator (plan §5.15, §5.19).
// `areas` and `votes` are the 11 starter areas, or the areas and votes of the old board being moved.
import { util } from '@aws-appsync/utils';

const KEEP_SECONDS = 90 * 24 * 60 * 60; // deleted 90 days after the last change
const MAX_AREAS = 50;
const MAX_NAME_UNITS = 400; // generous: 40 characters, however many units each emoji takes
const MAX_TEXT_UNITS = 3000; // generous: 200 characters, however many units each emoji takes

export function request(ctx) {
  const { boardId, secret } = ctx.args;
  checkId(boardId);
  checkSecret(secret);
  const areas = parse(ctx.args.areas);
  const votes = parse(ctx.args.votes);
  const ids = Object.keys(areas);
  if (ids.length > MAX_AREAS) util.error('Too many areas', 'Invalid');

  const cleanAreas = {};
  const cleanVotes = {};
  ids.forEach((id) => {
    checkId(id);
    cleanAreas[id] = cleanArea(areas[id]);
    const v = votes[id] || {};
    cleanVotes[id] = { awesome: count(v.awesome), fine: count(v.fine), sad: count(v.sad) };
  });

  const now = util.time.nowEpochSeconds();
  return {
    operation: 'PutItem',
    key: util.dynamodb.toMapValues({ pk: boardId, sk: 'BOARD' }),
    attributeValues: util.dynamodb.toMapValues({
      facilitatorSecret: secret,
      generation: 0,
      noteCount: 0,
      areas: cleanAreas,
      votes: cleanVotes,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + KEEP_SECONDS,
    }),
    condition: { expression: 'attribute_not_exists(pk)' },
  };
}

export function response(ctx) {
  if (ctx.error) {
    if (ctx.error.type === 'DynamoDB:ConditionalCheckFailedException') {
      util.error('That board id is already taken', 'BoardExists');
    }
    util.error(ctx.error.message, ctx.error.type);
  }
  return { boardId: ctx.args.boardId, changeId: ctx.args.changeId, type: 'boardCreated', data: {} };
}

function parse(value) {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== 'object') util.error('Expected a JSON object', 'Invalid');
  return parsed;
}

function cleanArea(area) {
  if (!area || typeof area.name !== 'string' || area.name.length < 1 || area.name.length > MAX_NAME_UNITS) {
    util.error('An area needs a name', 'Invalid');
  }
  return {
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

function count(n) {
  return typeof n === 'number' && n >= 0 && n <= 100000 ? Math.floor(n) : 0;
}

function checkId(id) {
  if (typeof id !== 'string' || id.length < 1 || id.length > 64) util.error('Bad id', 'Invalid');
}

function checkSecret(secret) {
  if (typeof secret !== 'string' || secret.length < 20 || secret.length > 100) util.error('Bad secret', 'Invalid');
}
