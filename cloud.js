// Talks to the shared board on AWS AppSync (plan §5.15, §5.16, §5.18).
// Queries and changes go over HTTPS with fetch; live changes arrive over a WebSocket, using
// AppSync's real-time protocol. No libraries. Secrets are sent, never received (plan §5.17).
// Works as a classic browser script (sets window.RetroCloud) and as a Node module.
(function (root) {
  'use strict';

  const CHANGE_FIELDS = 'boardId changeId type data';
  const RETRY_DELAYS = [1000, 2000, 4000, 8000, 15000];
  const DEFAULT_TIMEOUT_MS = 300000;

  // The arguments of each change, besides changeId, with their GraphQL types (aws/schema.graphql).
  const MUTATIONS = {
    createBoard: { boardId: 'ID!', secret: 'String!', areas: 'AWSJSON!', votes: 'AWSJSON!' },
    addNotes: { boardId: 'ID!', secret: 'String!', generation: 'Int!', notes: 'AWSJSON!' },
    editNote: { boardId: 'ID!', secret: 'String!', noteId: 'ID!', text: 'String!' },
    deleteNote: { boardId: 'ID!', secret: 'String!', generation: 'Int!', noteId: 'ID!' },
    moveNotes: { boardId: 'ID!', moves: 'AWSJSON!' },
    react: { boardId: 'ID!', noteId: 'ID!', reaction: 'String!', delta: 'Int!' },
    vote: { boardId: 'ID!', areaId: 'ID!', kind: 'String!', delta: 'Int!' },
    clearBoard: { boardId: 'ID!', secret: 'String!', areaIds: '[ID!]!' },
    saveArea: { boardId: 'ID!', secret: 'String!', area: 'AWSJSON!', isNew: 'Boolean!' },
    deleteArea: { boardId: 'ID!', secret: 'String!', areaId: 'ID!', removedNotes: 'Int!' },
    removeNotes: { boardId: 'ID!', secret: 'String!', noteIds: '[ID!]!' },
  };

  const GET_BOARD = `query GetBoard($boardId: ID!, $secret: String!) {
  getBoard(boardId: $boardId, secret: $secret) { boardId generation noteCount areas votes isFacilitator }
}`;

  const LIST_NOTES = `query ListNotes($boardId: ID!, $secret: String!, $generation: Int!, $nextToken: String) {
  listNotes(boardId: $boardId, secret: $secret, generation: $generation, nextToken: $nextToken) { notes nextToken }
}`;

  const ON_CHANGE = `subscription OnChange($boardId: ID!) {
  onChange(boardId: $boardId) { ${CHANGE_FIELDS} }
}`;

  // A refusal or failure. `type` is AWS's errorType (NotYours, NotFacilitator, BoardChanged,
  // BoardExists, NoteMissing, Invalid), or Network when AWS couldn't be reached.
  class CloudError extends Error {
    constructor(type, message) {
      super(message);
      this.name = 'CloudError';
      this.type = type;
    }
  }

  function mutationText(name) {
    const args = { ...MUTATIONS[name], changeId: 'ID!' };
    const params = Object.entries(args).map(([arg, type]) => `$${arg}: ${type}`).join(', ');
    const pass = Object.keys(args).map((arg) => `${arg}: $${arg}`).join(', ');
    return `mutation Change(${params}) {\n  ${name}(${pass}) { ${CHANGE_FIELDS} }\n}`;
  }

  // AWSJSON values travel as JSON text.
  function fromJson(value) {
    return typeof value === 'string' ? JSON.parse(value) : value;
  }

  // A random id: board codes, note ids, change ids and the browser secret.
  // crypto.randomUUID needs a secure page, so fall back to getRandomValues elsewhere.
  function makeId() {
    const c = root.crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    const bytes = c.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // `config` is RetroConfig ({ graphqlUrl, realtimeUrl, apiKey }). Tests may also pass
  // `retryDelays`, and stand-ins for `fetch` and `WebSocket`.
  function createClient(config) {
    const fetchImpl = config.fetch || root.fetch.bind(root);
    const WebSocketImpl = config.WebSocket || root.WebSocket;
    const retryDelays = config.retryDelays || RETRY_DELAYS;
    const host = new URL(config.graphqlUrl).host;
    const auth = { host, 'x-api-key': config.apiKey };

    async function request(query, variables) {
      let response;
      let body;
      try {
        response = await fetchImpl(config.graphqlUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': config.apiKey },
          body: JSON.stringify({ query, variables }),
        });
        body = await response.json();
      } catch (e) {
        throw new CloudError('Network', "Can't reach the shared board.");
      }
      if (body.errors && body.errors.length > 0) {
        const error = body.errors[0];
        throw new CloudError(error.errorType || 'Unknown', error.message || 'Something went wrong.');
      }
      if (!response.ok) throw new CloudError('Network', "Can't reach the shared board.");
      return body.data;
    }

    // Returns { boardId, generation, noteCount, areas, votes, isFacilitator }, or null if the board is missing.
    async function getBoard(boardId, secret) {
      const { getBoard: board } = await request(GET_BOARD, { boardId, secret });
      return board && { ...board, areas: fromJson(board.areas), votes: fromJson(board.votes) };
    }

    // Every note of the current generation, fetching page after page.
    async function listAllNotes(boardId, secret, generation) {
      const notes = [];
      let nextToken = null;
      do {
        const { listNotes: page } = await request(LIST_NOTES, { boardId, secret, generation, nextToken });
        notes.push(...fromJson(page.notes));
        nextToken = page.nextToken;
      } while (nextToken);
      return notes;
    }

    // Sends one change. Returns the confirmed Change: { boardId, changeId, type, data }.
    async function mutate(name, args) {
      const variables = { ...args, changeId: makeId() };
      for (const [arg, type] of Object.entries(MUTATIONS[name])) {
        if (type === 'AWSJSON!') variables[arg] = JSON.stringify(args[arg]);
      }
      const result = (await request(mutationText(name), variables))[name];
      return { ...result, data: fromJson(result.data) };
    }

    // Listens for live changes to one board. `onChange(change)` gets every Change, and
    // `onState(state)` gets 'connecting', 'live' (listening) or 'lost' (retrying on its own).
    // Returns { stop }.
    function watch(boardId, { onChange, onState }) {
      const subscriptionId = makeId();
      let socket = null;
      let stopped = false;
      let attempt = 0;
      let timeoutMs = DEFAULT_TIMEOUT_MS;
      let keepAliveTimer = null;
      let retryTimer = null;

      function send(message) {
        socket.send(JSON.stringify(message));
      }

      function open() {
        if (stopped) return;
        onState('connecting');
        const header = root.btoa(JSON.stringify(auth));
        try {
          socket = new WebSocketImpl(`${config.realtimeUrl}?header=${encodeURIComponent(header)}&payload=e30=`, 'graphql-ws');
        } catch (e) {
          lost();
          return;
        }
        socket.onopen = () => send({ type: 'connection_init' });
        socket.onmessage = (event) => handle(JSON.parse(event.data));
        socket.onclose = () => lost();
        // Some WebSockets (such as Node 22's) report a refused connection only as an error.
        socket.onerror = () => lost();
      }

      function handle(message) {
        switch (message.type) {
          case 'connection_ack':
            timeoutMs = (message.payload && message.payload.connectionTimeoutMs) || DEFAULT_TIMEOUT_MS;
            keepAlive();
            send({
              id: subscriptionId,
              type: 'start',
              payload: { data: JSON.stringify({ query: ON_CHANGE, variables: { boardId } }), extensions: { authorization: auth } },
            });
            break;
          case 'ka':
            keepAlive();
            break;
          case 'start_ack':
            attempt = 0;
            onState('live');
            break;
          case 'data': {
            const change = message.id === subscriptionId && message.payload.data.onChange;
            if (change) onChange({ ...change, data: fromJson(change.data) });
            break;
          }
          case 'error':
          case 'connection_error':
            lost();
            break;
          default:
            break;
        }
      }

      // AppSync sends "ka" regularly. If none arrives in time, the connection is dead even if the
      // browser hasn't noticed, for example after a laptop wakes from sleep (plan §5.18).
      function keepAlive() {
        clearTimeout(keepAliveTimer);
        keepAliveTimer = setTimeout(lost, timeoutMs);
      }

      function closeSocket() {
        clearTimeout(keepAliveTimer);
        if (!socket) return;
        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.onerror = null;
        try {
          socket.close();
        } catch (e) {
          // Already closed.
        }
        socket = null;
      }

      function lost() {
        closeSocket();
        if (stopped) return;
        onState('lost');
        const delay = retryDelays[Math.min(attempt, retryDelays.length - 1)];
        attempt += 1;
        clearTimeout(retryTimer);
        retryTimer = setTimeout(open, delay);
      }

      open();

      return {
        stop() {
          stopped = true;
          clearTimeout(retryTimer);
          if (socket && socket.readyState === 1) send({ id: subscriptionId, type: 'stop' });
          closeSocket();
        },
      };
    }

    return { getBoard, listAllNotes, mutate, watch };
  }

  const RetroCloud = { CloudError, createClient, makeId };

  if (typeof module !== 'undefined' && module.exports) module.exports = RetroCloud;
  else root.RetroCloud = RetroCloud;
})(typeof globalThis !== 'undefined' ? globalThis : this);
