// Drives headless Chrome over the DevTools protocol to try the board like a user would,
// checking the spec's acceptance criteria with real typing, key presses and clicks.
//
// Run from the project folder:   node tests/browser-check.js
// Needs Google Chrome in /Applications. Screenshots are saved to the folder printed at the end
// (or pass a folder as the first argument).
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const page = 'file://' + path.resolve(__dirname, '..', 'index.html');
const out = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'retro-board-check-'));
fs.mkdirSync(out, { recursive: true });
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.join(out, 'profile')}`,
  '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore' });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, nextId = 1;
const pending = new Map();
const errors = [];
const results = [];
const dialogs = [];
let dialogAnswer = true;

function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject, method }));
}

async function js(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || expr);
  return r.result.value;
}

function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + JSON.stringify(detail)}`);
}

async function key(keyName, { shift = false, text } = {}) {
  const codes = { Enter: 13, Escape: 27, Tab: 9, ArrowRight: 39, ArrowLeft: 37, ArrowDown: 40, ArrowUp: 38 };
  const base = { key: keyName, code: keyName, windowsVirtualKeyCode: codes[keyName], modifiers: shift ? 8 : 0 };
  await send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', text, ...base });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await wait(30);
}

async function type(text) {
  await send('Input.insertText', { text });
  await wait(30);
}

// Clicks the middle of an element like a person would: first bringing it into view (on the
// whiteboard, focusing it pans the board), and failing loudly if something covers it.
async function clickAt(selector) {
  const sel = JSON.stringify(selector);
  await js(`(() => { const el = document.querySelector(${sel});
    if (el.matches('button:not(:disabled), textarea')) el.focus(); else el.scrollIntoView({ block: 'nearest' }); })()`);
  await wait(60);
  const box = await js(`(() => { const el = document.querySelector(${sel}); const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2; const hit = document.elementFromPoint(x, y);
    return { x, y, covered: !el.disabled && !(hit && (hit === el || el.contains(hit))) && (hit ? hit.className || hit.tagName : 'nothing') }; })()`);
  if (box.covered) throw new Error(`clickAt(${selector}) is covered by ${box.covered}`);
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
  }
  await wait(50);
}

async function centerOf(selector) {
  return js(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
}

async function wheel(x, y, deltaX, deltaY, { ctrl = false } = {}) {
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX, deltaY, modifiers: ctrl ? 2 : 0 });
  await wait(50);
}

// Presses at `from`, moves to `to` in small steps, then releases (or presses Escape first).
async function drag(from, to, { escape = false } = {}) {
  const mouse = (type, p, extra = {}) => send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', ...extra });
  await mouse('mousePressed', from, { buttons: 1, clickCount: 1 });
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await mouse('mouseMoved', { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }, { buttons: 1 });
  }
  if (escape) await key('Escape');
  await mouse('mouseReleased', to, { buttons: 0, clickCount: 1 });
  await wait(100);
}

async function screenshot(name) {
  // A full-page capture briefly resizes the page, which would close the emoji picker on the
  // whiteboard. The whiteboard never scrolls, so a normal capture shows everything there.
  const fullPage = !(await js(`document.body.classList.contains('is-canvas')`));
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: fullPage });
  fs.writeFileSync(path.join(out, name), Buffer.from(data, 'base64'));
}

async function load() {
  await send('Page.navigate', { url: page });
  await wait(600);
}

const cardTexts = (col) => js(`[...document.querySelectorAll('.column-${col} .card-text')].map(p => p.textContent)`);
const focusedKey = () => js(`document.activeElement.dataset.focusKey || document.activeElement.id || document.activeElement.className`);

(async () => {
  let targets;
  for (let i = 0; i < 50; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      if (targets.some((t) => t.type === 'page')) break;
    } catch (e) { /* not up yet */ }
    await wait(200);
  }
  ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.reject(new Error(p.method + ': ' + msg.error.message)) : p.resolve(msg.result);
    } else if (msg.method === 'Page.javascriptDialogOpening') {
      dialogs.push(msg.params.message);
      send('Page.handleJavaScriptDialog', { accept: dialogAnswer });
    } else if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params.exceptionDetails.exception?.description);
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push(msg.params.args.map((a) => a.value).join(' '));
    }
  });

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await load();
  await js('localStorage.clear()');
  await load();

  // Story 1 — see the board
  const headings = await js(`[...document.querySelectorAll('.column h3')].map(h => h.textContent.trim())`);
  check('1.1/1.2 three columns, in order, with emojis', JSON.stringify(headings) === JSON.stringify(['😊 Going well', '😟 Not going well', '💡 Improvements']), headings);
  const hints = await js(`[...document.querySelectorAll('.empty-hint')].filter(p => !p.hidden).map(p => p.textContent)`);
  check('1.3 empty hint in every column', hints.length === 3 && hints[0] === 'No cards yet — add one!', hints);
  const notice = await js(`document.getElementById('save-notice').hidden`);
  check('7 no save notice when saving works', notice === true);
  await screenshot('1-empty-desktop.png');

  // Story 2 — add a card
  await js(`document.getElementById('add-well').focus()`);
  await key('Enter');
  await wait(50);
  const blankMsg = await js(`document.querySelector('.column-well .form-message').textContent`);
  check('2.3 blank card refused with message', blankMsg === 'Type something first 🙂', blankMsg);
  check('2.3 nothing added', (await cardTexts('well')).length === 0);

  await type('   ');
  await key('Enter');
  check('2.3 spaces-only card refused', (await cardTexts('well')).length === 0);
  await js(`document.getElementById('add-well').value = ''; document.getElementById('add-well').dispatchEvent(new InputEvent('input'))`);

  await type('Great teamwork 🎉');
  const counter = await js(`document.getElementById('counter-well').textContent`);
  check('2.4 counter shows characters left (emoji = 1)', counter === '184 left', counter);
  const msgCleared = await js(`document.querySelector('.column-well .form-message').textContent`);
  check('typing clears the message', msgCleared === '', msgCleared);
  await key('Enter');
  check('2.1 Enter adds the card', JSON.stringify(await cardTexts('well')) === JSON.stringify(['Great teamwork 🎉']), await cardTexts('well'));
  check('2.7 text box clears after adding', (await js(`document.getElementById('add-well').value`)) === '');
  check('2.7 counter resets', (await js(`document.getElementById('counter-well').textContent`)) === '200 left');
  check('focus stays in the text box', (await focusedKey()) === 'add-well', await focusedKey());

  await type('line one');
  await key('Enter', { shift: true, text: '\r' });
  await type('line two');
  await clickAt('.column-well .btn-primary');
  check('2.2 Shift+Enter makes a new line; Add button adds', (await cardTexts('well'))[1] === 'line one\nline two', await cardTexts('well'));
  check('2.1 new card goes to the bottom', (await cardTexts('well')).length === 2);
  check('1.3 hint hidden once a card exists', (await js(`document.querySelector('.column-well .empty-hint').hidden`)) === true);

  // Story 2.4–2.6 — the 200-character limit
  await js(`document.getElementById('add-notWell').focus()`);
  await type('x'.repeat(199));
  await type('👍🏽🇳🇱');
  const limited = await js(`(() => { const v = document.getElementById('add-notWell').value; return { n: RetroLogic.countChars(v), end: v.slice(-5), counter: document.getElementById('counter-notWell').textContent }; })()`);
  check('2.4 typing stops at 200 (emoji kept whole)', limited.n === 200 && limited.end === 'x👍🏽' && limited.counter === '0 left', limited);
  await type('more');
  check('2.4 cannot type further at 200', (await js(`RetroLogic.countChars(document.getElementById('add-notWell').value)`)) === 200);

  await js(`(() => { const t = document.getElementById('add-notWell'); t.value = ''; t.dispatchEvent(new InputEvent('input')); })()`);
  await js(`(() => { const t = document.getElementById('add-notWell'); t.value = 'y'.repeat(250);
    t.dispatchEvent(new InputEvent('input', { inputType: 'insertFromPaste' })); })()`);
  await wait(50);
  const paste = await js(`({ n: document.getElementById('add-notWell').value.length, msg: document.querySelector('.column-notWell .form-message').textContent })`);
  check('2.5 long paste cut to 200 with message', paste.n === 200 && paste.msg === 'Shortened to 200 characters', paste);
  await js(`(() => { const t = document.getElementById('add-notWell'); t.value = ''; t.dispatchEvent(new InputEvent('input')); })()`);

  // Story 3 — emoji picker
  await js(`document.getElementById('add-improve').focus()`);
  await type('Ship it');
  await js(`document.getElementById('add-improve').setSelectionRange(4, 4)`);
  await clickAt('.column-improve .emoji-btn');
  const pickerOpen = await js(`({ open: !document.getElementById('emoji-picker').hidden, expanded: document.querySelector('.column-improve .emoji-btn').getAttribute('aria-expanded'), focused: document.activeElement.textContent, count: document.querySelectorAll('.picker-emoji').length })`);
  check('3.1 picker opens, focus on first emoji', pickerOpen.open && pickerOpen.expanded === 'true' && pickerOpen.focused === '😊', pickerOpen);
  check('3.3 picker offers the 16 emojis', pickerOpen.count === 16);
  await screenshot('2-picker-open.png');
  await key('ArrowRight');
  await key('ArrowDown');
  check('3.4 arrow keys move between emojis', (await js(`document.activeElement.textContent`)) === '🚀', await js(`document.activeElement.textContent`));
  await key('Enter', { text: '\r' });
  const inserted = await js(`(() => { const t = document.getElementById('add-improve'); return { v: t.value, cursor: t.selectionStart, focused: document.activeElement === t, open: !document.getElementById('emoji-picker').hidden }; })()`);
  check('3.2 emoji inserted at the cursor', inserted.v === 'Ship🚀 it', inserted);
  check('3.2 cursor just after the emoji', inserted.cursor === 6, inserted);
  check('3.2/3.6 picker closed, focus back in text box', !inserted.open && inserted.focused, inserted);

  await clickAt('.column-improve .emoji-btn');
  await key('Escape');
  const esc = await js(`({ open: !document.getElementById('emoji-picker').hidden, v: document.getElementById('add-improve').value, focused: document.activeElement.id })`);
  check('3.5 Escape closes without inserting, focus returns', !esc.open && esc.v === 'Ship🚀 it' && esc.focused === 'add-improve', esc);

  await clickAt('.column-improve .emoji-btn');
  await clickAt('.topbar h1');
  const outside = await js(`({ open: !document.getElementById('emoji-picker').hidden, v: document.getElementById('add-improve').value, focused: document.activeElement.id })`);
  check('3.5/3.6 click outside closes, focus returns', !outside.open && outside.v === 'Ship🚀 it' && outside.focused === 'add-improve', outside);

  await clickAt('.column-improve .emoji-btn');
  await clickAt('.column-improve .emoji-btn');
  check('emoji button toggles the picker closed', (await js(`document.getElementById('emoji-picker').hidden`)) === true);

  await key('Enter');
  check('card with picked emoji added', JSON.stringify(await cardTexts('improve')) === JSON.stringify(['Ship🚀 it']), await cardTexts('improve'));

  await js(`document.getElementById('add-notWell').focus()`);
  await type('z'.repeat(200));
  await clickAt('.column-notWell .emoji-btn');
  await key('Enter', { text: '\r' });
  await wait(50);
  const full = await js(`({ n: RetroLogic.countChars(document.getElementById('add-notWell').value), msg: document.querySelector('.column-notWell .form-message').textContent })`);
  check('3.7 no emoji inserted when full', full.n === 200 && full.msg.startsWith('No room'), full);
  await js(`(() => { const t = document.getElementById('add-notWell'); t.value = ''; t.dispatchEvent(new InputEvent('input')); })()`);

  // Story 4 — reactions
  const first = `.column-well .card:nth-child(1)`;
  const zeros = await js(`[...document.querySelectorAll('${first} .reaction')].map(r => r.classList.contains('is-zero') + ':' + r.textContent)`);
  check('4.1/4.4 five reactions, all faded at 0, no − buttons', zeros.length === 5 && zeros.every((z) => z.startsWith('true')) && !zeros.join('').includes('−'), zeros);
  await clickAt(`${first} [data-reaction="thumbsUp"].react-btn`);
  await clickAt(`${first} [data-reaction="thumbsUp"].react-btn`);
  await clickAt(`${first} [data-reaction="heart"].react-btn`);
  const counts = await js(`[...document.querySelectorAll('${first} .react-count')].map(c => c.textContent).join(',')`);
  check('4.2/4.3 counts go up, same reaction twice', counts === '2,1,0,0,0', counts);
  check('4.5 − shows only above 0', (await js(`document.querySelectorAll('${first} .unreact-btn').length`)) === 2);

  await clickAt(`.column-well .card:nth-child(2) [data-reaction="thumbsUp"].react-btn`);
  await clickAt(`.column-well .card:nth-child(2) [data-reaction="thumbsUp"].react-btn`);
  await clickAt(`.column-well .card:nth-child(2) [data-reaction="thumbsUp"].react-btn`);
  check('4.7 cards do not move when reactions change', JSON.stringify(await cardTexts('well')) === JSON.stringify(['Great teamwork 🎉', 'line one\nline two']), await cardTexts('well'));

  await js(`document.querySelector('${first} [data-reaction="heart"].unreact-btn').focus()`);
  await key('Enter', { text: '\r' });
  const afterUnreact = await js(`({ heart: document.querySelectorAll('${first} .react-count')[1].textContent, minus: !!document.querySelector('${first} [data-reaction="heart"].unreact-btn'), focus: document.activeElement.dataset.focusKey })`);
  check('4.5/4.6 − lowers to 0 and disappears', afterUnreact.heart === '0' && !afterUnreact.minus, afterUnreact);
  check('focus moves to the reaction button when − disappears', /:react:heart$/.test(afterUnreact.focus || ''), afterUnreact);

  await js(`document.querySelector('${first} [data-reaction="thumbsUp"].unreact-btn').focus()`);
  await key('Enter', { text: '\r' });
  check('keyboard: focus stays on − after it is used and still shown', /:unreact:thumbsUp$/.test((await focusedKey()) || ''), await focusedKey());
  await screenshot('3-cards-desktop.png');

  // Story 7 — keep after refresh
  const before = await js(`document.getElementById('board').innerText`);
  await load();
  const after = await js(`document.getElementById('board').innerText`);
  check('7.1 cards, emojis, line breaks and counts survive a refresh', before === after);

  // Story 5 — sort by votes
  check('8.4 Clear board enabled when there are cards', (await js(`document.getElementById('clear-btn').disabled`)) === false);
  await clickAt('#sort-btn');
  check('5.2 Sort by votes puts most 👍 first', JSON.stringify(await cardTexts('well')) === JSON.stringify(['line one\nline two', 'Great teamwork 🎉']), await cardTexts('well'));
  await js(`document.getElementById('add-well').focus()`);
  await type('Newest');
  await key('Enter');
  check('5.4 new cards still go to the bottom after sorting', (await cardTexts('well'))[2] === 'Newest', await cardTexts('well'));
  await load();
  check('5.5 sorted order survives a refresh', JSON.stringify(await cardTexts('well')) === JSON.stringify(['line one\nline two', 'Great teamwork 🎉', 'Newest']), await cardTexts('well'));

  // Story 6 — edit
  const wellCard = (n) => `.column-well .card:nth-child(${n})`;
  await clickAt(`${wellCard(1)} [data-action="edit"]`);
  const editOpen = await js(`(() => { const t = document.querySelector('${wellCard(1)} .edit-form textarea');
    return t && { value: t.value, focused: document.activeElement === t, cursorAtEnd: t.selectionStart === t.value.length }; })()`);
  check('6.1 Edit opens a text box with the card text, cursor at the end', editOpen && editOpen.value === 'line one\nline two' && editOpen.focused && editOpen.cursorAtEnd, editOpen);
  await key('Enter', { shift: true, text: '\r' });
  await type('three');
  await clickAt(`${wellCard(3)} [data-focus-key$=":react:thumbsUp"]`);
  const draft = await js(`(() => { const t = document.querySelector('.edit-form textarea'); return t && t.value; })()`);
  check('reacting on another card keeps the edit draft', draft === 'line one\nline two\nthree', draft);
  await clickAt(`${wellCard(1)} .edit-form .emoji-btn`);
  await key('Enter', { text: '\r' });
  const withEmoji = await js(`document.querySelector('.edit-form textarea').value`);
  check('6.2 emoji picker works while editing', withEmoji.endsWith('three😊'), withEmoji);

  await clickAt(`${wellCard(2)} [data-action="edit"]`);
  const switched = await js(`({ forms: document.querySelectorAll('.edit-form').length, texts: [...document.querySelectorAll('.column-well .card')].map(li => li.querySelector('.card-text')?.textContent ?? 'EDITING') })`);
  check('6.6 clicking Edit on another card saves the first and opens the second', switched.forms === 1 && JSON.stringify(switched.texts) === JSON.stringify(['line one\nline two\nthree😊', 'EDITING', 'Newest']), switched);

  await js(`(() => { const t = document.querySelector('.edit-form textarea'); t.value = ''; t.dispatchEvent(new InputEvent('input')); t.focus(); })()`);
  await key('Enter');
  await wait(50);
  const emptySave = await js(`({ forms: document.querySelectorAll('.edit-form').length, msg: document.querySelector('.edit-form .form-message').textContent })`);
  check("6.4 saving empty text is blocked with \"A card can't be empty\"", emptySave.forms === 1 && emptySave.msg === "A card can't be empty", emptySave);

  await clickAt(`${wellCard(3)} [data-action="edit"]`);
  const emptySwitch = await js(`[...document.querySelectorAll('.column-well .card')].map(li => li.querySelector('.card-text')?.textContent ?? 'EDITING')`);
  check('6.7 switching away from an empty edit puts the old text back', JSON.stringify(emptySwitch) === JSON.stringify(['line one\nline two\nthree😊', 'Great teamwork 🎉', 'EDITING']), emptySwitch);

  await type(' changed');
  await key('Escape');
  const cancelled = await js(`({ forms: document.querySelectorAll('.edit-form').length, text: document.querySelector('${wellCard(3)} .card-text').textContent, focus: document.activeElement.dataset.focusKey })`);
  check('6.3 Escape cancels and restores the text', cancelled.forms === 0 && cancelled.text === 'Newest', cancelled);
  check('focus returns to the Edit button after cancel', /:edit$/.test(cancelled.focus || ''), cancelled);

  await clickAt(`${wellCard(3)} [data-action="edit"]`);
  await type('!');
  await clickAt(`${wellCard(3)} .edit-form .btn:not(.btn-primary)`);
  check('6.3 Cancel button restores the text', (await cardTexts('well'))[2] === 'Newest', await cardTexts('well'));

  const ageBefore = await js(`JSON.parse(localStorage.getItem('retro-board')).cards.find(c => c.text === 'Great teamwork 🎉')`);
  await clickAt(`${wellCard(2)} [data-action="edit"]`);
  await type(' 💪');
  await clickAt(`${wellCard(2)} .edit-form .btn-primary`);
  const ageAfter = await js(`JSON.parse(localStorage.getItem('retro-board')).cards.find(c => c.id === '${ageBefore.id}')`);
  check('6.1 Save keeps reactions', ageAfter.text === 'Great teamwork 🎉 💪' && JSON.stringify(ageAfter.reactions) === JSON.stringify(ageBefore.reactions), ageAfter);
  check('6.5 editing keeps the card age', ageAfter.createdAt === ageBefore.createdAt);

  // Story 6.8 — delete
  dialogAnswer = false;
  await clickAt(`${wellCard(3)} [data-action="delete"]`);
  check('6.8 delete asks "Delete this card?"', dialogs.at(-1) === 'Delete this card?', dialogs);
  check('6.8 cancelling keeps the card', (await cardTexts('well')).length === 3);
  dialogAnswer = true;
  await clickAt(`${wellCard(3)} [data-action="delete"]`);
  check('6.8 confirming deletes the card', JSON.stringify(await cardTexts('well')) === JSON.stringify(['line one\nline two\nthree😊', 'Great teamwork 🎉 💪']), await cardTexts('well'));
  check('focus moves to the column add box after delete', (await focusedKey()) === 'add-well', await focusedKey());
  await screenshot('6-after-edits.png');

  // Story 8 — clear board
  dialogAnswer = false;
  await clickAt('#clear-btn');
  check("8.1 Clear asks \"Delete all notes and votes? This can't be undone.\"", dialogs.at(-1) === "Delete all notes and votes? This can't be undone.", dialogs.at(-1));
  check('8.3 cancelling changes nothing', (await js(`document.querySelectorAll('.card').length`)) === 3);
  dialogAnswer = true;
  await clickAt('#clear-btn');
  const cleared = await js(`({ cards: document.querySelectorAll('.card').length, disabled: document.getElementById('clear-btn').disabled, hints: [...document.querySelectorAll('.empty-hint')].filter(p => !p.hidden).length, saved: JSON.parse(localStorage.getItem('retro-board')).cards.length, focus: document.activeElement.id })`);
  check('8.2 confirming removes every card, everywhere', cleared.cards === 0 && cleared.hints === 3 && cleared.saved === 0, cleared);
  check('8.4 Clear board disabled when empty; focus moves to first add box', cleared.disabled && cleared.focus === 'add-well', cleared);
  await clickAt('#clear-btn');
  check('disabled Clear does nothing', dialogs.length === 4, dialogs.length);

  // ===========================================================================
  // Phase 6 — the whiteboard (Stories 10, 11, 2.1, 5, 9)
  // ===========================================================================
  const L = require('../logic.js');
  const view = async () => {
    const t = await js(`document.getElementById('world').style.transform`);
    const m = t.match(/translate\((-?[\d.e-]+)px, (-?[\d.e-]+)px\) scale\(([\d.e-]+)\)/);
    return m && { x: +m[1], y: +m[2], zoom: +m[3] };
  };
  const label = () => js(`document.getElementById('zoom-label').textContent`);
  const near = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;
  const stored = (text) => js(`JSON.parse(localStorage.getItem('retro-board')).cards.find(c => c.text === ${JSON.stringify(text)})`);
  const noteSel = (id) => `[data-note-id="${id}"]`;

  check('10 whiteboard mode on a laptop screen', (await js(`document.body.classList.contains('is-canvas')`)) && (await view()) !== null);
  const fitted = await view();
  const worldBox = await js(`(() => { const r = document.getElementById('world').getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, topbar: document.querySelector('.topbar').getBoundingClientRect().bottom }; })()`);
  check('10.4 Fit shows the whole board below the toolbar', worldBox.left >= 0 && worldBox.right <= 1280 && worldBox.top >= worldBox.topbar && worldBox.bottom <= 900, worldBox);
  check('10.4 the zoom label shows the zoom', (await label()) === `${Math.round(fitted.zoom * 100)}%`, await label());

  await clickAt('#zoom-in');
  check('10.4 + zooms in one step', near((await view()).zoom, L.nextZoomStep(fitted.zoom, +1), 0.001), await view());
  for (let i = 0; i < 8; i++) await clickAt('#zoom-out');
  check('10.5 zoom never goes below 25%', (await view()).zoom === 0.25 && (await label()) === '25%', await label());
  for (let i = 0; i < 10; i++) await clickAt('#zoom-in');
  check('10.5 zoom never goes above 200%', (await view()).zoom === 2 && (await label()) === '200%', await label());
  await clickAt('#zoom-fit');
  const refit = await view();
  check('10.4 Fit button returns to the fitted view', near(refit.zoom, fitted.zoom, 0.001) && near(refit.x, fitted.x) && near(refit.y, fitted.y), { refit, fitted });

  const p = { x: 640, y: 500 };
  const beforeZoom = await view();
  await wheel(p.x, p.y, 0, -100, { ctrl: true });
  const zoomed = await view();
  check("10.3 Ctrl + wheel zooms in", zoomed.zoom > beforeZoom.zoom, { beforeZoom, zoomed });
  check('10.3 …around the pointer', near((p.x - beforeZoom.x) / beforeZoom.zoom, (p.x - zoomed.x) / zoomed.zoom, 0.5) && near((p.y - beforeZoom.y) / beforeZoom.zoom, (p.y - zoomed.y) / zoomed.zoom, 0.5), { beforeZoom, zoomed });

  let v = await view();
  await wheel(p.x, p.y, 150, 200);
  const scrolled = await view();
  check('10.2 the wheel pans', near(scrolled.x, v.x - 150) && near(scrolled.y, v.y - 200) && scrolled.zoom === v.zoom, { v, scrolled });

  const empty = { x: 640, y: 880 };
  check('(test setup) bottom middle is empty whiteboard', (await js(`document.elementFromPoint(${empty.x}, ${empty.y}).id`)) === 'viewport');
  v = await view();
  await drag(empty, { x: empty.x + 120, y: empty.y - 60 });
  const panned = await view();
  check('10.2 dragging empty space pans', near(panned.x, v.x + 120) && near(panned.y, v.y - 60), { v, panned });

  await wait(700);
  await load();
  const restored = await view();
  check('7.1 zoom and position survive a refresh', near(restored.x, panned.x) && near(restored.y, panned.y) && near(restored.zoom, panned.zoom, 0.001), { restored, panned });

  // Work at 75% on the Retro frame for the note checks, so the whole frame is on screen.
  await js(`(() => { const b = JSON.parse(localStorage.getItem('retro-board')); b.view = { zoom: 0.75, x: 0, y: 60 };
    localStorage.setItem('retro-board', JSON.stringify(b)); })()`);
  await load();

  // Notes on the whiteboard
  for (const text of ['Alpha', 'Bravo', 'Charlie']) {
    await js(`document.getElementById('add-well').focus()`);
    await type(text);
    await key('Enter');
  }
  const [A, B, C] = [await stored('Alpha'), await stored('Bravo'), await stored('Charlie')];
  const G = L.NOTE_GAP;
  check('2.1 new cards fill the next free space, left to right, then a new row',
    A.x === G && A.y === G && B.x === 2 * G + L.NOTE_WIDTH && B.y === G && C.x === G && C.y > A.y + 60, { A, B, C });
  const placedBox = await js(`(() => { const a = document.querySelector('${noteSel(A.id)}').getBoundingClientRect(), b = document.querySelector('${noteSel(B.id)}').getBoundingClientRect();
    return { overlap: a.right > b.left && a.bottom > b.top && b.bottom > a.top }; })()`);
  check('11.6 notes are drawn at their places without overlapping', !placedBox.overlap, placedBox);

  v = await view();
  let from = await centerOf(`${noteSel(A.id)} .card-text`);
  await drag(from, { x: from.x, y: from.y + 200 });
  let A2 = await stored('Alpha');
  check('11.1 dragging a card moves it within its column', A2.column === 'well' && near(A2.x, A.x, 1) && near(A2.y, A.y + 200 / v.zoom, 2), { A, A2, zoom: v.zoom });
  const zs = [A2.z, (await stored('Bravo')).z, (await stored('Charlie')).z];
  check('11.4 the dragged card comes to the front', A2.z > zs[1] && A2.z > zs[2], zs);

  from = await centerOf(`${noteSel(B.id)} .card-text`);
  let to = await centerOf('.column-improve .drop-zone');
  await drag(from, to);
  const B2 = await stored('Bravo');
  const bLook = await js(`(() => { const el = document.querySelector('${noteSel(B.id)}');
    return { column: el.closest('.column').classList.contains('column-improve'), bg: getComputedStyle(el).backgroundColor }; })()`);
  check('11.1 dropping a card in another column moves it there', B2.column === 'improve' && bLook.column, { B2, bLook });
  check('11.1 …and it takes that column\'s colour', bLook.bg === 'rgb(255, 242, 168)', bLook);

  const C0 = await stored('Charlie');
  from = await centerOf(`${noteSel(C.id)} .card-text`);
  await drag(from, empty);
  await wait(350);
  const cBack = await js(`(() => { const el = document.querySelector('${noteSel(C.id)}'); return { transform: el.style.transform, dragging: el.classList.contains('is-dragging') }; })()`);
  check('11.3 a card dropped outside every column slides back', JSON.stringify(await stored('Charlie')) === JSON.stringify(C0) && cBack.transform === '' && !cBack.dragging, { cBack, C: await stored('Charlie') });

  from = await centerOf(`${noteSel(C.id)} .card-text`);
  await drag(from, await centerOf('.column-notWell .drop-zone'), { escape: true });
  await wait(350);
  check('11 Escape during a drag puts the card back', JSON.stringify(await stored('Charlie')) === JSON.stringify(C0), await stored('Charlie'));

  from = await centerOf(`${noteSel(C.id)} [data-reaction="heart"].react-btn`);
  await drag(from, { x: from.x + 100, y: from.y + 100 });
  const cAfterButton = await stored('Charlie');
  check('11.7 pressing on a button never drags the card', cAfterButton.x === C0.x && cAfterButton.y === C0.y, cAfterButton);

  const zoneHeights = () => js(`[...document.querySelectorAll('.column .drop-zone')].map(z => z.offsetHeight)`);
  const h0 = await zoneHeights();
  check('retro columns are all the same height', h0.every((x) => x === h0[0]), h0);
  const zoneBox = await js(`(() => { const r = document.querySelector('.column-well .drop-zone').getBoundingClientRect(); return { x: r.left + r.width / 2, bottom: r.bottom }; })()`);
  from = await centerOf(`${noteSel(A.id)} .card-text`);
  await drag(from, { x: zoneBox.x, y: zoneBox.bottom - 10 });
  const h1 = await zoneHeights();
  check('11.5 a column grows when a card is placed near its bottom, and they grow together', h1[0] > h0[0] && h1.every((x) => x === h1[0]), { h0, h1 });

  // Sort by votes on the whiteboard
  await clickAt(`${noteSel(C.id)} [data-reaction="thumbsUp"].react-btn`);
  await clickAt('#sort-btn');
  const [As, Cs] = [await stored('Alpha'), await stored('Charlie')];
  check('5.2 Sort by votes lines the column up in rows, most 👍 first', Cs.x === G && Cs.y === G && As.x === 2 * G + L.NOTE_WIDTH && As.y === G, { As, Cs });
  check('5.5 Sort keeps the cards in their columns', (await stored('Bravo')).column === 'improve');

  // Keyboard focus pans the whiteboard (Story 9.5)
  await wheel(p.x, p.y, 0, -3000);
  await js(`document.querySelector('${noteSel(A.id)} [data-reaction="thumbsUp"].react-btn').focus()`);
  await wait(150);
  const focusBox = await js(`(() => { const r = document.activeElement.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; })()`);
  check('9.5 focusing something off-screen pans it into view', focusBox.top >= 0 && focusBox.bottom <= 900 && focusBox.left >= 0 && focusBox.right <= 1280, focusBox);

  // The emoji picker closes when the board moves
  await clickAt('#zoom-fit');
  await clickAt('.column-well .emoji-btn');
  const opened = !(await js(`document.getElementById('emoji-picker').hidden`));
  await wheel(p.x, p.y, 0, -100, { ctrl: true });
  check('the emoji picker closes when the board is zoomed', opened && (await js(`document.getElementById('emoji-picker').hidden`)));
  await screenshot('8-whiteboard-notes.png');

  // Phone mode (Story 9.2)
  const wideView = await view();
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await wait(300);
  const phone = await js(`(() => { const note = document.querySelector('${noteSel(A.id)}');
    return { canvas: document.body.classList.contains('is-canvas'), transform: document.getElementById('world').style.transform,
      position: getComputedStyle(note).position, zoomShown: getComputedStyle(document.querySelector('.zoom-controls')).display !== 'none',
      order: [...document.querySelectorAll('.column-well .card-text')].map(p => p.textContent) }; })()`);
  check('9.2 phone: no whiteboard, no zoom controls, notes in a plain list', !phone.canvas && phone.transform === '' && phone.position === 'static' && !phone.zoomShown, phone);
  check('9.2 phone: notes in reading order of their places', JSON.stringify(phone.order) === JSON.stringify(['Charlie', 'Alpha']), phone.order);
  const A3 = await stored('Alpha');
  from = await centerOf(`${noteSel(A.id)} .card-text`);
  await drag(from, { x: from.x, y: from.y + 150 });
  check('9.2 phone: notes cannot be dragged', JSON.stringify(await stored('Alpha')) === JSON.stringify(A3));
  await screenshot('9-phone-list.png');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await wait(300);
  const back = await view();
  check('switching back to a laptop screen restores the whiteboard view', back && near(back.x, wideView.x) && near(back.y, wideView.y) && near(back.zoom, wideView.zoom, 0.001), { back, wideView });
  dialogAnswer = true;
  await clickAt('#clear-btn');

  // ===========================================================================
  // Phase 7 — Squad Health Check (Stories 12–15, 1.1, 4, 6, 8, 11)
  // ===========================================================================
  const savedBoard = () => js(`JSON.parse(localStorage.getItem('retro-board'))`);
  const areaRow = (id) => `tr[data-area-id="${id}"]`;
  const healthNote = async (text) => (await savedBoard()).health.notes.find((n) => n.text === text);
  async function showView(v) {
    await js(`(() => { const b = JSON.parse(localStorage.getItem('retro-board')); b.view = ${JSON.stringify(v)};
      localStorage.setItem('retro-board', JSON.stringify(b)); })()`);
    await load();
  }
  const healthX = await js(`document.querySelector('.frame-health').offsetLeft`);
  await showView({ zoom: 0.75, x: 40 - healthX * 0.75, y: 60 });

  const frames = await js(`(() => { const r = document.querySelector('.frame-retro').getBoundingClientRect(), h = document.querySelector('.frame-health').getBoundingClientRect();
    return { retroRight: r.right, healthLeft: h.left, retroTop: r.top, healthTop: h.top }; })()`);
  check('1.1 the health check sits to the right of the retro', frames.retroRight < frames.healthLeft && near(frames.retroTop, frames.healthTop, 1), frames);
  const tableHeadings = await js(`[...document.querySelectorAll('.health-table thead th')].map(th => th.textContent.trim())`);
  check('12.1 health table headings, in order', JSON.stringify(tableHeadings) === JSON.stringify(['Area', 'Example of Awesome', '🟢 Awesome', '🟡 Fine', '🔴 Sad', 'Example of Crappy', 'Notes & Comments']), tableHeadings);
  const areaNames = () => js(`[...document.querySelectorAll('.health-table tbody .area-name')].map(s => s.textContent)`);
  check('12.2 the 11 starter areas, in order', JSON.stringify(await areaNames()) === JSON.stringify(L.DEFAULT_AREAS.map((a) => a.name)), await areaNames());
  const funTexts = await js(`[...document.querySelectorAll('${areaRow('area-fun')} .example-text')].map(p => p.textContent)`);
  check('12.2 each area shows its examples', JSON.stringify(funTexts) === JSON.stringify([L.DEFAULT_AREAS[2].awesome, L.DEFAULT_AREAS[2].crappy]), funTexts);

  // Story 13 — votes
  const fun = areaRow('area-fun');
  await clickAt(`${fun} [data-action="vote"][data-vote="awesome"]`);
  await clickAt(`${fun} [data-action="vote"][data-vote="awesome"]`);
  await clickAt(`${fun} [data-action="vote"][data-vote="sad"]`);
  const votes = await js(`(() => { const cells = [...document.querySelectorAll('${fun} .vote-cell')];
    return { counts: cells.map(c => c.querySelector('.vote-count').textContent), zero: cells.map(c => c.classList.contains('is-zero')),
      minus: cells.map(c => !!c.querySelector('[data-action="unvote"]')),
      label: document.querySelector('${fun} [data-action="vote"][data-vote="awesome"]').getAttribute('aria-label') }; })()`);
  check('13.1/13.2 +1 adds votes, again and again', JSON.stringify(votes.counts) === '["2","0","1"]', votes);
  check('13.3/13.4 − only above 0; zero cells faded', JSON.stringify(votes.minus) === '[true,false,true]' && JSON.stringify(votes.zero) === '[false,true,false]', votes);
  check('13 vote buttons say the area, the colour and the count', votes.label === 'Fun, Awesome: 2 votes. Add one', votes.label);
  check('8.4 Clear board is enabled when there are only votes', (await js(`document.getElementById('clear-btn').disabled`)) === false);
  await js(`document.querySelector('${fun} [data-action="unvote"][data-vote="sad"]').focus()`);
  await key('Enter', { text: '\r' });
  const afterUnvote = await js(`({ sad: document.querySelector('${fun} .vote-sad .vote-count').textContent, minus: !!document.querySelector('${fun} [data-action="unvote"][data-vote="sad"]'), focus: document.activeElement.dataset.focusKey })`);
  check('13.3 − lowers a vote to 0 and disappears; focus moves to +1', afterUnvote.sad === '0' && !afterUnvote.minus && afterUnvote.focus === 'area-fun:vote:sad', afterUnvote);
  check('7.1 votes are saved', JSON.stringify((await savedBoard()).health.areas.find((a) => a.id === 'area-fun').votes) === '{"awesome":2,"fine":0,"sad":0}');

  // Story 14 — health notes
  await clickAt(`${fun} [data-action="add-note"]`);
  check('14.1 + Add note opens a box with the cursor in it', (await js(`document.activeElement.id`)) === 'add-note-area-fun', await js(`document.activeElement.id`));
  await key('Enter');
  await wait(50);
  check('14.1 an empty note is refused', (await js(`document.querySelector('${fun} .add-note-form .form-message').textContent`)) === 'Type something first 🙂');
  await type('Great vibes 🎉');
  await key('Enter');
  const added = await js(`({ notes: [...document.querySelectorAll('${fun} .health-note .card-text')].map(p => p.textContent), box: document.getElementById('add-note-area-fun')?.value, focus: document.activeElement.id,
    bg: getComputedStyle(document.querySelector('${fun} .health-note')).backgroundColor })`);
  check('14.2 the note appears in its area; the box clears and keeps focus', JSON.stringify(added.notes) === '["Great vibes 🎉"]' && added.box === '' && added.focus === 'add-note-area-fun', added);
  check('14.3 health notes are light blue', added.bg === 'rgb(215, 233, 255)', added.bg);
  const gv = await healthNote('Great vibes 🎉');
  check('14.2 …placed in the next free space', gv.areaId === 'area-fun' && gv.x === L.NOTE_GAP && gv.y === L.NOTE_GAP, gv);
  await key('Escape');
  const closed = await js(`({ box: !!document.getElementById('add-note-area-fun'), focus: document.activeElement.dataset.focusKey })`);
  check('14.4 Escape closes the add box; focus goes to + Add note', !closed.box && closed.focus === 'area-fun:add-note', closed);

  await clickAt(`${fun} [data-action="add-note"]`);
  await type('Carry over');
  await clickAt(`${areaRow('area-speed')} [data-action="add-note"]`);
  const switchedBox = await js(`({ fun: [...document.querySelectorAll('${fun} .health-note .card-text')].map(p => p.textContent), boxes: document.querySelectorAll('.add-note-form').length, focus: document.activeElement.id })`);
  check('14 one add box at a time; switching adds what was typed', JSON.stringify(switchedBox.fun.sort()) === JSON.stringify(['Carry over', 'Great vibes 🎉']) && switchedBox.boxes === 1 && switchedBox.focus === 'add-note-area-speed', switchedBox);
  await clickAt(`${areaRow('area-speed')} .add-note-form .btn:not(.btn-primary)`);
  check('14.4 Cancel closes the add box', (await js(`document.querySelectorAll('.add-note-form').length`)) === 0);

  const gvSel = noteSel(gv.id);
  await clickAt(`${gvSel} [data-reaction="party"].react-btn`);
  check('14.3 health notes have reactions', (await healthNote('Great vibes 🎉')).reactions.party === 1);

  // Story 6 — editing health notes
  await clickAt(`${gvSel} [data-action="edit"]`);
  await js(`(() => { const t = document.querySelector('${gvSel} textarea'); t.value = ''; t.dispatchEvent(new InputEvent('input')); t.focus(); })()`);
  await key('Enter');
  await wait(50);
  check("6.4 \"A note can't be empty\"", (await js(`document.querySelector('${gvSel} .form-message').textContent`)) === "A note can't be empty");
  await key('Escape');
  check('6.3 Escape restores the health note', (await js(`document.querySelector('${gvSel} .card-text').textContent`)) === 'Great vibes 🎉');
  await clickAt(`${gvSel} [data-action="edit"]`);
  await type('!');

  // Story 6.6 / 15 — one edit slot across notes and areas
  await clickAt(`${fun} [data-action="edit"]`);
  const areaEdit = await js(`(() => { const t = document.getElementById('area-name-area-fun');
    return { saved: document.querySelector('${gvSel} .card-text')?.textContent, value: t && t.value, focused: document.activeElement === t,
      selected: t && t.selectionStart === 0 && t.selectionEnd === t.value.length, edits: document.querySelectorAll('.edit-form, .area-input-name').length }; })()`);
  check('6.6 Edit on an area saves the note being edited', areaEdit.saved === 'Great vibes 🎉!', areaEdit);
  check('15.1 the area opens for editing, name selected', areaEdit.value === 'Fun' && areaEdit.focused && areaEdit.selected && areaEdit.edits === 1, areaEdit);
  await key('Enter', { shift: true, text: '\r' });
  check('15.3 Shift+Enter adds no new line to a name', (await js(`document.getElementById('area-name-area-fun').value`)) === 'Fun');
  await js(`(() => { const t = document.getElementById('area-name-area-fun'); t.value = ''; t.dispatchEvent(new InputEvent('input')); t.focus(); })()`);
  await key('Enter');
  await wait(50);
  check('15.2 "An area needs a name"', (await js(`document.querySelector('${fun} .area-field .form-message').textContent`)) === 'An area needs a name');
  await type('x'.repeat(45));
  check('15.2 area names stop at 40 characters', (await js(`document.getElementById('area-name-area-fun').value.length`)) === 40);
  await js(`(() => { const t = document.getElementById('area-name-area-fun'); t.value = ''; t.dispatchEvent(new InputEvent('input')); t.focus(); })()`);
  await type('Joy 🎉');
  await js(`document.getElementById('area-awesome-area-fun').focus()`);
  await js(`document.getElementById('area-awesome-area-fun').select()`);
  await type('Line one');
  await key('Enter', { shift: true, text: '\r' });
  await type('Line two');
  await key('Enter');
  const savedArea = (await savedBoard()).health.areas.find((a) => a.id === 'area-fun');
  check('15.1/15.3 saving an area keeps its votes; examples can have new lines', savedArea.name === 'Joy 🎉' && savedArea.awesome === 'Line one\nLine two' && savedArea.votes.awesome === 2, savedArea);
  check('focus returns to the area Edit button', (await focusedKey()) === 'area-fun:edit', await focusedKey());
  await clickAt(`${fun} [data-action="edit"]`);
  await type('Changed');
  await key('Escape');
  check('15.3 Escape cancels an area edit', (await js(`document.querySelector('${fun} .area-name').textContent`)) === 'Joy 🎉');

  // Story 15.4 — add an area
  await clickAt('#add-area');
  const newArea = await js(`(() => { const rows = [...document.querySelectorAll('.health-table tbody tr')]; const last = rows.at(-1); const t = last.querySelector('.area-input-name');
    return { count: rows.length, value: t && t.value, focused: document.activeElement === t }; })()`);
  check('15.4 Add area adds "New area" at the bottom, open for editing', newArea.count === 12 && newArea.value === 'New area' && newArea.focused, newArea);
  await type('Retro quality');
  await key('Enter');
  check('15.4 the new area is saved', (await savedBoard()).health.areas.at(-1).name === 'Retro quality');

  // Story 11.2–11.3 — dragging health notes
  await showView({ zoom: 0.75, x: 40 - healthX * 0.75, y: 60 });
  const easy = areaRow('area-easy-to-release');
  from = await centerOf(`${gvSel} .card-text`);
  await drag(from, await centerOf(`${easy} .drop-zone`));
  const moved = await healthNote('Great vibes 🎉!');
  check('11.2 a health note can be dragged to another area', moved.areaId === 'area-easy-to-release' && !!(await js(`document.querySelector('${easy} ${gvSel}')`)), moved);

  await clickAt('#zoom-fit');
  await js(`document.getElementById('add-well').focus()`);
  await type('Retro card');
  await key('Enter');
  const rc = await stored('Retro card');
  from = await centerOf(`${noteSel(rc.id)} .card-text`);
  await drag(from, await centerOf(`${fun} .drop-zone`));
  await wait(350);
  check('11.3 a card dropped on a Notes cell slides back', JSON.stringify(await stored('Retro card')) === JSON.stringify(rc), await stored('Retro card'));
  from = await centerOf(`${gvSel} .card-text`);
  await drag(from, await centerOf('.column-notWell .drop-zone'));
  await wait(350);
  check('11.3 a health note dropped on a retro column slides back', JSON.stringify(await healthNote('Great vibes 🎉!')) === JSON.stringify(moved));
  await screenshot('10-health-check.png');

  // Delete a health note and an area
  await showView({ zoom: 0.75, x: 40 - healthX * 0.75, y: 60 });
  dialogAnswer = true;
  const carry = await healthNote('Carry over');
  await clickAt(`${noteSel(carry.id)} [data-action="delete"]`);
  check('6.8 delete asks "Delete this note?"', dialogs.at(-1) === 'Delete this note?', dialogs.at(-1));
  check('6.8 the health note is deleted; focus goes to its + Add note', !(await healthNote('Carry over')) && (await focusedKey()) === 'area-fun:add-note', await focusedKey());

  dialogAnswer = false;
  await clickAt(`${easy} [data-action="delete-area"]`);
  check('15.5 Delete area asks "Delete this area, its votes and notes?"', dialogs.at(-1) === 'Delete this area, its votes and notes?', dialogs.at(-1));
  check('15.5 cancelling keeps the area', (await savedBoard()).health.areas.length === 12);
  dialogAnswer = true;
  await clickAt(`${easy} [data-action="delete-area"]`);
  const afterAreaDelete = await savedBoard();
  check('15.5 confirming removes the area and its notes', afterAreaDelete.health.areas.length === 11 && !afterAreaDelete.health.areas.some((a) => a.id === 'area-easy-to-release') && !afterAreaDelete.health.notes.some((n) => n.areaId === 'area-easy-to-release'), afterAreaDelete.health);
  check('focus moves to Add area after deleting an area', (await js(`document.activeElement.id`)) === 'add-area');

  // Story 8 — Clear board clears both, keeps areas
  await clickAt(`${fun} [data-action="add-note"]`);
  await type('Will be cleared');
  await key('Enter');
  dialogAnswer = true;
  await clickAt('#clear-btn');
  const cleared2 = await savedBoard();
  check('8.2 Clear removes cards, health notes and votes', cleared2.cards.length === 0 && cleared2.health.notes.length === 0 && cleared2.health.areas.every((a) => a.votes.awesome + a.votes.fine + a.votes.sad === 0), cleared2.health.notes);
  check('8.2 …and keeps the areas, renamed ones included', cleared2.health.areas.length === 11 && cleared2.health.areas.some((a) => a.name === 'Joy 🎉') && cleared2.health.areas.some((a) => a.name === 'Retro quality'));
  check('8.4 Clear board disabled again', (await js(`document.getElementById('clear-btn').disabled`)) === true);
  check('the add-note box closes when the board is cleared', (await js(`document.querySelectorAll('.add-note-form').length`)) === 0);

  // Story 9.2 — health check on a phone
  await clickAt(`${fun} [data-action="vote"][data-vote="fine"]`);
  await clickAt(`${fun} [data-action="add-note"]`);
  await type('On a phone');
  await key('Enter');
  await key('Escape');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await wait(300);
  const phoneHealth = await js(`(() => { const row = document.querySelector('${fun}'); const r = row.getBoundingClientRect();
    const small = [...row.querySelectorAll('button')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect()).filter(b => b.width < 44 || b.height < 44).length;
    return { display: getComputedStyle(row).display, width: r.width, label: getComputedStyle(row.querySelector('.vote-fine'), '::before').content,
      note: getComputedStyle(row.querySelector('.health-note')).position, small, scroll: document.documentElement.scrollWidth > innerWidth }; })()`);
  check('9.2 phone: each area is its own block with labels', phoneHealth.display === 'grid' && phoneHealth.width <= 390 && phoneHealth.label.includes('Fine'), phoneHealth);
  check('9.2 phone: health notes in a plain list, buttons at least 44×44, no sideways scroll', phoneHealth.note === 'static' && phoneHealth.small === 0 && !phoneHealth.scroll, phoneHealth);
  await screenshot('11-phone-health.png');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await wait(300);
  await clickAt('#clear-btn');

  // Story 7.3 — a board saved by v1 is upgraded
  await js(`localStorage.setItem('retro-board', JSON.stringify({ version: 1, cards: [
    { id: 'v1a', column: 'improve', text: 'From v1 🐢', createdAt: 1, reactions: { thumbsUp: 2, heart: 0, laugh: 0, party: 0, wow: 0 } },
    { id: 'v1b', column: 'well', text: 'Also v1', createdAt: 2, reactions: { thumbsUp: 0, heart: 1, laugh: 0, party: 0, wow: 0 } } ] }))`);
  await load();
  const upgraded = await js(`({ improve: [...document.querySelectorAll('.column-improve .card-text')].map(p => p.textContent),
    well: [...document.querySelectorAll('.column-well .card-text')].map(p => p.textContent),
    notice: document.getElementById('save-notice').hidden })`);
  check('7.3 a v1 board opens with every card kept', JSON.stringify(upgraded.improve) === '["From v1 🐢"]' && JSON.stringify(upgraded.well) === '["Also v1"]' && upgraded.notice, upgraded);
  await clickAt('.column-well [data-reaction="thumbsUp"].react-btn');
  const resaved = await js(`(() => { const b = JSON.parse(localStorage.getItem('retro-board')); return { version: b.version, cards: b.cards.length, areas: b.health.areas.length }; })()`);
  check('7.3 the upgraded board is saved as version 2 with the 11 areas', resaved.version === 2 && resaved.cards === 2 && resaved.areas === 11, resaved);

  // Story 7.2 — saving blocked
  await js(`localStorage.setItem('retro-board', '{broken')`);
  await load();
  const damaged = await js(`({ hidden: document.getElementById('save-notice').hidden, text: document.getElementById('save-notice').textContent, backup: localStorage.getItem('retro-board-backup') })`);
  check('damaged data: notice shown, backup kept', !damaged.hidden && damaged.text.startsWith("The saved board couldn't") && damaged.backup === '{broken', damaged);
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); };` });
  await load();
  const blocked = await js(`({ hidden: document.getElementById('save-notice').hidden, text: document.getElementById('save-notice').textContent })`);
  check('7.2 notice shown when saving is blocked', !blocked.hidden && blocked.text.startsWith("This board can't be saved"), blocked);
  await js(`document.getElementById('add-well').focus()`);
  await type('Still works');
  await key('Enter');
  check('7.2 board still works when saving is blocked', (await cardTexts('well')).includes('Still works'));
  await screenshot('4-notice.png');

  // Story 9 — phone layout
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await wait(200);
  const layout = await js(`(() => { const cols = [...document.querySelectorAll('.column')].map(c => c.getBoundingClientRect());
    const small = [...document.querySelectorAll('button')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect()).filter(r => r.width < 44 || r.height < 44).length;
    return { stacked: cols[0].bottom <= cols[1].top && cols[1].bottom <= cols[2].top, scroll: document.documentElement.scrollWidth > innerWidth, small }; })()`);
  check('9.2 columns stack on a phone, no sideways scroll', layout.stacked && !layout.scroll, layout);
  check('9.2 every button at least 44×44 on a phone', layout.small === 0, layout);
  await screenshot('5-phone.png');
  await clickAt('.column-well .card [data-action="edit"]');
  const phoneEdit = await js(`(() => { const small = [...document.querySelectorAll('button')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect()).filter(r => r.width < 44 || r.height < 44).length;
    return { small, scroll: document.documentElement.scrollWidth > innerWidth }; })()`);
  check('9.2 phone: edit form buttons at least 44×44, no sideways scroll', phoneEdit.small === 0 && !phoneEdit.scroll, phoneEdit);
  await send('Page.captureScreenshot', { format: 'png' }).then(({ data }) => fs.writeFileSync(path.join(out, '7-phone-edit.png'), Buffer.from(data, 'base64')));

  check('no errors in the console', errors.length === 0, errors);

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed. Screenshots: ${out}`);
  ws.close();
  chrome.kill();
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  chrome.kill();
  process.exit(1);
});
