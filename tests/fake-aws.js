// A stand-in for the AppSync API, for tests and for trying the app without AWS (plan §7, task T070).
// It serves the app's files, answers the same GraphQL operations with the same rules as the
// resolvers in aws/resolvers/, and pushes live changes with AppSync's real-time WebSocket protocol.
// Node's built-in modules only, so CI needs no AWS account and no installs.
//
// Run it by hand with:  node tests/fake-aws.js   then open the address it prints.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const API_KEY = 'fake-api-key';
const MAX_NOTES = 300;
const MAX_PER_CALL = 24;
const COLUMNS = ['well', 'notWell', 'improve'];
const REACTIONS = ['thumbsUp', 'heart', 'laugh', 'party', 'wow'];
const VOTE_KINDS = ['awesome', 'fine', 'sad'];
const SUBSCRIBED = ['addNotes', 'editNote', 'deleteNote', 'moveNotes', 'react', 'vote', 'clearBoard', 'saveArea', 'deleteArea'];
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

// A refusal, sent back the way AppSync sends a resolver's util.error().
class Refused extends Error {
  constructor(errorType, message) {
    super(message);
    this.errorType = errorType;
  }
}

function refuse(errorType, message) {
  throw new Refused(errorType, message);
}

function json(value) {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

// --- The rules: the same as aws/resolvers/ ------------------------------------

function createRules() {
  const boards = new Map(); // boardId → { facilitatorSecret, generation, noteCount, areas, votes, notes: Map }

  function boardOrRefuse(boardId, errorType = 'BoardChanged') {
    const board = boards.get(boardId);
    if (!board) refuse(errorType, 'The board is missing');
    return board;
  }

  function cleanNote(n, now) {
    if (!n || typeof n.id !== 'string' || n.id.length < 1 || n.id.length > 64) refuse('Invalid', 'Bad note id');
    if (typeof n.text !== 'string' || n.text.length < 1 || n.text.length > 3000) refuse('Invalid', 'Bad note text');
    const isCard = n.kind === 'card';
    if (isCard && !COLUMNS.includes(n.column)) refuse('Invalid', 'Bad column');
    if (!isCard && (n.kind !== 'health' || typeof n.areaId !== 'string')) refuse('Invalid', 'Bad note kind');
    const reactions = {};
    for (const r of REACTIONS) {
      const v = n.reactions ? n.reactions[r] : 0;
      reactions[r] = typeof v === 'number' && v >= 0 ? Math.floor(v) : 0;
    }
    return {
      id: n.id, kind: n.kind, column: isCard ? n.column : null, areaId: isCard ? null : n.areaId,
      text: n.text, createdAt: typeof n.createdAt === 'number' ? n.createdAt : now,
      x: typeof n.x === 'number' ? n.x : null, y: typeof n.y === 'number' ? n.y : null,
      z: typeof n.z === 'number' ? n.z : 0, reactions,
    };
  }

  function cleanArea(a) {
    if (!a || typeof a.name !== 'string' || a.name.length < 1) refuse('Invalid', 'An area needs a name');
    return {
      name: a.name,
      awesome: typeof a.awesome === 'string' ? a.awesome : '',
      crappy: typeof a.crappy === 'string' ? a.crappy : '',
      order: typeof a.order === 'number' ? a.order : 0,
    };
  }

  function change(args, type, data) {
    return { boardId: args.boardId, changeId: args.changeId, type, data: JSON.stringify(data) };
  }

  const operations = {
    getBoard(args) {
      const b = boards.get(args.boardId);
      if (!b) return null;
      return {
        boardId: args.boardId, generation: b.generation, noteCount: b.noteCount,
        areas: JSON.stringify(b.areas), votes: JSON.stringify(b.votes),
        isFacilitator: b.facilitatorSecret === args.secret, updatedAt: Math.floor(Date.now() / 1000),
      };
    },

    listNotes(args) {
      const b = boards.get(args.boardId);
      const all = b ? [...b.notes.values()] : [];
      // AppSync applies the page limit before the generation filter, so pages can be short.
      const start = args.nextToken ? Number(args.nextToken) : 0;
      const page = all.slice(start, start + 100);
      const notes = page
        .filter((n) => n.generation === args.generation)
        .map(({ ownerSecret, generation, ...n }) => ({ ...n, mine: ownerSecret === args.secret }));
      const next = start + 100 < all.length ? String(start + 100) : null;
      return { notes: JSON.stringify(notes), nextToken: next };
    },

    createBoard(args) {
      if (boards.has(args.boardId)) refuse('BoardExists', 'That board id is already taken');
      const areas = {};
      const votes = {};
      const given = json(args.areas);
      const givenVotes = json(args.votes);
      for (const id of Object.keys(given)) {
        areas[id] = cleanArea(given[id]);
        const v = givenVotes[id] || {};
        votes[id] = { awesome: v.awesome || 0, fine: v.fine || 0, sad: v.sad || 0 };
      }
      boards.set(args.boardId, {
        facilitatorSecret: args.secret, generation: 0, noteCount: 0, areas, votes, notes: new Map(),
      });
      return change(args, 'boardCreated', {});
    },

    addNotes(args) {
      const notes = json(args.notes);
      if (!Array.isArray(notes) || notes.length < 1 || notes.length > MAX_PER_CALL) refuse('Invalid', 'Send 1 to 24 notes at a time');
      const b = boards.get(args.boardId);
      if (!b || b.generation !== args.generation || b.noteCount + notes.length > MAX_NOTES) {
        refuse('BoardChanged', 'The board is missing, full, or was just cleared');
      }
      const clean = notes.map((n) => cleanNote(n, Date.now()));
      if (clean.some((n) => b.notes.has(n.id))) refuse('Invalid', 'A note with that id already exists');
      for (const n of clean) b.notes.set(n.id, { ...n, ownerSecret: args.secret, generation: args.generation });
      b.noteCount += clean.length;
      return change(args, 'notesAdded', { generation: args.generation, notes: clean });
    },

    editNote(args) {
      const b = boardOrRefuse(args.boardId);
      const n = b.notes.get(args.noteId);
      if (!n || n.ownerSecret !== args.secret) refuse('NotYours', 'You can only change your own notes');
      n.text = args.text;
      return change(args, 'noteEdited', { noteId: args.noteId, text: args.text });
    },

    deleteNote(args) {
      const b = boardOrRefuse(args.boardId);
      const n = b.notes.get(args.noteId);
      if (!n || n.ownerSecret !== args.secret || n.generation !== args.generation) {
        refuse('NotYours', 'You can only delete your own notes');
      }
      if (b.generation !== args.generation) refuse('BoardChanged', 'The board is missing or was just cleared');
      b.notes.delete(args.noteId);
      b.noteCount -= 1;
      return change(args, 'noteDeleted', { noteId: args.noteId });
    },

    moveNotes(args) {
      const moves = json(args.moves);
      if (!Array.isArray(moves) || moves.length < 1 || moves.length > MAX_PER_CALL) refuse('Invalid', 'Send 1 to 24 moves at a time');
      const b = boardOrRefuse(args.boardId);
      // A transaction: check every move before changing anything.
      for (const m of moves) {
        const n = b.notes.get(m.id);
        const isCard = typeof m.column === 'string';
        if (!n || n.kind !== (isCard ? 'card' : 'health')) refuse('NoteMissing', 'A note was deleted or changed kind');
      }
      for (const m of moves) {
        const n = b.notes.get(m.id);
        Object.assign(n, { x: m.x, y: m.y, z: m.z }, typeof m.column === 'string' ? { column: m.column } : { areaId: m.areaId });
      }
      return change(args, 'notesMoved', { moves });
    },

    react(args) {
      if (!REACTIONS.includes(args.reaction)) refuse('Invalid', 'Bad reaction');
      if (args.delta !== 1 && args.delta !== -1) refuse('Invalid', 'delta must be 1 or -1');
      const b = boardOrRefuse(args.boardId);
      const n = b.notes.get(args.noteId);
      if (!n || n.reactions[args.reaction] + args.delta < 0) refuse('NoteMissing', 'The note was deleted, or the count is already 0');
      n.reactions[args.reaction] += args.delta;
      return change(args, 'reacted', { noteId: args.noteId, reaction: args.reaction, delta: args.delta });
    },

    vote(args) {
      if (!VOTE_KINDS.includes(args.kind)) refuse('Invalid', 'Bad vote kind');
      if (args.delta !== 1 && args.delta !== -1) refuse('Invalid', 'delta must be 1 or -1');
      const b = boardOrRefuse(args.boardId);
      const v = b.votes[args.areaId];
      if (!v || v[args.kind] + args.delta < 0) refuse('BoardChanged', 'The area was deleted, or the count is already 0');
      v[args.kind] += args.delta;
      return change(args, 'voted', { areaId: args.areaId, kind: args.kind, delta: args.delta });
    },

    clearBoard(args) {
      const b = boardOrRefuse(args.boardId, 'NotFacilitator');
      if (b.facilitatorSecret !== args.secret) refuse('NotFacilitator', 'Only the facilitator can clear the board');
      b.generation += 1;
      b.noteCount = 0;
      for (const id of args.areaIds) b.votes[id] = { awesome: 0, fine: 0, sad: 0 };
      return change(args, 'boardCleared', { generation: b.generation, areaIds: args.areaIds });
    },

    saveArea(args) {
      const b = boardOrRefuse(args.boardId, 'NotFacilitator');
      const area = json(args.area);
      const known = area && area.id in b.areas;
      if (b.facilitatorSecret !== args.secret || known === args.isNew) refuse('NotFacilitator', 'Only the facilitator can change areas');
      b.areas[area.id] = cleanArea(area);
      if (args.isNew) b.votes[area.id] = { awesome: 0, fine: 0, sad: 0 };
      return change(args, 'areaSaved', { area: { id: area.id, ...cleanArea(area) }, isNew: args.isNew });
    },

    deleteArea(args) {
      const b = boardOrRefuse(args.boardId, 'NotFacilitator');
      if (b.facilitatorSecret !== args.secret || !(args.areaId in b.areas) || b.noteCount < args.removedNotes) {
        refuse('NotFacilitator', 'Only the facilitator can delete areas');
      }
      delete b.areas[args.areaId];
      delete b.votes[args.areaId];
      b.noteCount -= args.removedNotes;
      return change(args, 'areaDeleted', { areaId: args.areaId });
    },

    removeNotes(args) {
      if (args.noteIds.length < 1 || args.noteIds.length > MAX_PER_CALL) refuse('Invalid', 'Send 1 to 24 note ids at a time');
      const b = boardOrRefuse(args.boardId, 'NotFacilitator');
      if (b.facilitatorSecret !== args.secret) refuse('NotFacilitator', 'Only the facilitator can remove notes');
      for (const id of args.noteIds) b.notes.delete(id);
      return change(args, 'notesRemoved', { noteIds: args.noteIds });
    },
  };

  return { boards, operations };
}

// --- WebSocket, by hand (RFC 6455): just enough for AppSync's protocol ------

function acceptKey(key) {
  return crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
}

function frame(opcode, payload) {
  const body = Buffer.from(payload);
  let head;
  if (body.length < 126) {
    head = Buffer.from([0x80 | opcode, body.length]);
  } else if (body.length < 65536) {
    head = Buffer.alloc(4);
    head[0] = 0x80 | opcode;
    head[1] = 126;
    head.writeUInt16BE(body.length, 2);
  } else {
    head = Buffer.alloc(10);
    head[0] = 0x80 | opcode;
    head[1] = 127;
    head.writeBigUInt64BE(BigInt(body.length), 2);
  }
  return Buffer.concat([head, body]);
}

// Reads whole frames from the start of `buffer`. Returns them and whatever is left over.
function readFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (buffer.length - offset >= 2) {
    const opcode = buffer[offset] & 0x0f;
    const masked = (buffer[offset + 1] & 0x80) !== 0;
    let length = buffer[offset + 1] & 0x7f;
    let pos = offset + 2;
    if (length === 126) {
      if (buffer.length < pos + 2) break;
      length = buffer.readUInt16BE(pos);
      pos += 2;
    } else if (length === 127) {
      if (buffer.length < pos + 8) break;
      length = Number(buffer.readBigUInt64BE(pos));
      pos += 8;
    }
    const maskLength = masked ? 4 : 0;
    if (buffer.length < pos + maskLength + length) break;
    const mask = buffer.subarray(pos, pos + maskLength);
    const payload = Buffer.from(buffer.subarray(pos + maskLength, pos + maskLength + length));
    if (masked) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
    frames.push({ opcode, payload });
    offset = pos + maskLength + length;
  }
  return { frames, rest: buffer.subarray(offset) };
}

// --- The server -------------------------------------------------------------

// Options: port (0 = any free port), root (the folder of files to serve),
// kaMs (how often to send "ka"), connectionTimeoutMs (told to clients in connection_ack).
function startFakeAws({ port = 0, root = path.resolve(__dirname, '..'), kaMs = 10000, connectionTimeoutMs = 300000 } = {}) {
  const { boards, operations } = createRules();
  const sockets = new Set(); // live WebSocket connections, each { socket, subscriptions: Map(id → boardId), kaTimer }
  const state = { blocked: false, kaPaused: false, address: '' };

  function send(conn, message) {
    if (!conn.socket.destroyed) conn.socket.write(frame(0x1, JSON.stringify(message)));
  }

  function broadcast(fieldName, result) {
    if (!SUBSCRIBED.includes(fieldName) || !result) return;
    for (const conn of sockets) {
      for (const [id, boardId] of conn.subscriptions) {
        if (boardId === result.boardId) send(conn, { id, type: 'data', payload: { data: { onChange: result } } });
      }
    }
  }

  function serveGraphql(req, res, body) {
    const reply = (status, data) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(data));
    };
    if (req.headers['x-api-key'] !== API_KEY) {
      return reply(401, { errors: [{ errorType: 'UnauthorizedException', message: 'You are not authorized to make this call.' }] });
    }
    let request;
    try {
      request = JSON.parse(body);
    } catch (e) {
      return reply(400, { errors: [{ errorType: 'MalformedHttpRequestException', message: 'Not JSON' }] });
    }
    const match = /\{\s*(\w+)\s*\(/.exec(request.query || '');
    const fieldName = match && match[1];
    const operation = fieldName && operations[fieldName];
    if (!operation) return reply(400, { errors: [{ errorType: 'ValidationError', message: 'Unknown operation' }] });
    try {
      const result = operation(request.variables || {});
      reply(200, { data: { [fieldName]: result } });
      broadcast(fieldName, result);
    } catch (e) {
      if (!(e instanceof Refused)) throw e;
      reply(200, { data: { [fieldName]: null }, errors: [{ path: [fieldName], errorType: e.errorType, message: e.message }] });
    }
  }

  function serveFile(req, res) {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (urlPath === '/config.js') {
      // Points the app at this fake instead of the real AWS.
      res.writeHead(200, { 'content-type': TYPES['.js'], 'cache-control': 'no-store' });
      return res.end(`window.RetroConfig = ${JSON.stringify({
        graphqlUrl: `http://${state.address}/graphql`,
        realtimeUrl: `ws://${state.address}/graphql`,
        apiKey: API_KEY,
      })};\n`);
    }
    const file = path.normalize(path.join(root, urlPath === '/' ? 'index.html' : urlPath));
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403);
      return res.end();
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end('Not found');
      }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(data);
    });
  }

  // Lets the browser checks drop the connection, or block it for a while (plan §7).
  function serveTestControl(req, res) {
    const action = new URL(req.url, 'http://x').pathname.slice('/__test/'.length);
    if (action === 'drop') controls.drop();
    else if (action === 'block') controls.setBlocked(true);
    else if (action === 'unblock') controls.setBlocked(false);
    else if (action === 'reset') boards.clear();
    res.writeHead(204);
    res.end();
  }

  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/__test/')) return serveTestControl(req, res);
    if (req.method === 'POST' && req.url.startsWith('/graphql')) {
      if (state.blocked) return req.socket.destroy();
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => serveGraphql(req, res, body));
      return;
    }
    if (req.method === 'GET') return serveFile(req, res);
    res.writeHead(405);
    res.end();
  });

  server.on('upgrade', (req, socket) => {
    const url = new URL(req.url, 'http://x');
    let header = {};
    try {
      header = JSON.parse(Buffer.from(url.searchParams.get('header') || '', 'base64').toString());
    } catch (e) {
      // Treated as no key below.
    }
    const protocols = (req.headers['sec-websocket-protocol'] || '').split(',').map((p) => p.trim());
    if (state.blocked || header['x-api-key'] !== API_KEY || !protocols.includes('graphql-ws')) {
      socket.end('HTTP/1.1 401 Unauthorized\r\n\r\n');
      return;
    }
    socket.write([
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey(req.headers['sec-websocket-key'])}`,
      'Sec-WebSocket-Protocol: graphql-ws',
      '', '',
    ].join('\r\n'));

    const conn = { socket, subscriptions: new Map(), kaTimer: null };
    sockets.add(conn);
    let pending = Buffer.alloc(0);

    socket.on('data', (data) => {
      const { frames, rest } = readFrames(Buffer.concat([pending, data]));
      pending = rest;
      for (const { opcode, payload } of frames) {
        if (opcode === 0x8) return socket.end(frame(0x8, ''));
        if (opcode === 0x9) socket.write(frame(0xa, payload));
        if (opcode === 0x1) handleMessage(conn, JSON.parse(payload.toString()));
      }
    });
    const forget = () => {
      clearInterval(conn.kaTimer);
      sockets.delete(conn);
    };
    socket.on('close', forget);
    socket.on('error', forget);
  });

  function handleMessage(conn, message) {
    if (message.type === 'connection_init') {
      send(conn, { type: 'connection_ack', payload: { connectionTimeoutMs } });
      send(conn, { type: 'ka' });
      conn.kaTimer = setInterval(() => { if (!state.kaPaused) send(conn, { type: 'ka' }); }, kaMs);
    } else if (message.type === 'start') {
      const request = JSON.parse(message.payload.data);
      const auth = message.payload.extensions && message.payload.extensions.authorization;
      if (!auth || auth['x-api-key'] !== API_KEY || !/onChange/.test(request.query)) {
        send(conn, { id: message.id, type: 'error', payload: { errors: [{ errorType: 'UnauthorizedException', message: 'Not allowed' }] } });
        return;
      }
      conn.subscriptions.set(message.id, request.variables.boardId);
      send(conn, { id: message.id, type: 'start_ack' });
    } else if (message.type === 'stop') {
      conn.subscriptions.delete(message.id);
      send(conn, { id: message.id, type: 'complete' });
    }
  }

  const controls = {
    boards,
    // Cuts every live connection, like Wi-Fi dropping.
    drop() {
      for (const conn of sockets) conn.socket.destroy();
    },
    // While blocked, new connections and requests fail, like being offline.
    setBlocked(blocked) {
      state.blocked = blocked;
      if (blocked) controls.drop();
    },
    // Stops sending keep-alives, like a connection that is open but no longer working.
    pauseKeepAlive(paused) {
      state.kaPaused = paused;
    },
    close() {
      controls.drop();
      return new Promise((resolve) => server.close(resolve));
    },
  };

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      state.address = `127.0.0.1:${server.address().port}`;
      resolve({
        ...controls,
        url: `http://${state.address}/`,
        config: { graphqlUrl: `http://${state.address}/graphql`, realtimeUrl: `ws://${state.address}/graphql`, apiKey: API_KEY },
      });
    });
  });
}

module.exports = { startFakeAws, API_KEY };

if (require.main === module) {
  startFakeAws({ port: Number(process.env.PORT) || 8787 }).then((fake) => {
    console.log(`Fake AWS running. Open ${fake.url} (Ctrl+C to stop)`);
  });
}
