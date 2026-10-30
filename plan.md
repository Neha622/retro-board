# Implementation Plan: Sprint Retro Board

**Status**: Approved v4 — v3 (shared live board on AWS) approved by the Product Owner on 29 October 2026
**Created**: 26 October 2026
**Updated**: 29 October 2026
**Spec**: [spec.md](spec.md) (Approved v5)

> This plan describes HOW the app in the spec will be built. It contains no code. The task list is in [tasks.md](tasks.md).
>
> Sections marked **[v2]** are new or changed for the whiteboard and health check. Sections marked **[v3]** are new or changed for the shared live board. Everything else is v1 and already built.

---

## 1. Summary

A single web page that runs in the browser on the Scrum Master's laptop. It is written in plain HTML, CSS and JavaScript, with **no frameworks, no libraries, no build step and no server**. The board is saved in the browser's own storage (`localStorage`), so it survives a refresh on the same browser and device.

**[v2]** On laptop-sized screens, the page becomes a whiteboard. Pan and zoom work by moving and scaling one large area with a CSS transform. Notes are dragged with the browser's pointer events. On phones, the same content is shown as a simple stacked page with no transform and no dragging.

**Why this approach**: v1 and v2 both run on one shared screen with no logins and no syncing (spec §2, §8). Pan, zoom and dragging for about 150 notes don't need a library: CSS transforms and pointer events are built into every supported browser and are fast. Staying library-free keeps the "double-click `index.html`" way of running the app.

**[v3]** The board moves from `localStorage` to **AWS**, so everyone with the link shares it live:

```
 Each person's browser                          AWS (one region, set up in the web console)
┌──────────────────────┐   queries and changes  ┌──────────────────────┐        ┌───────────────────┐
│ index.html + app.js  │ ── HTTPS (fetch) ────▶ │  AWS AppSync          │ ─────▶ │  Amazon DynamoDB   │
│ cloud.js             │                        │  (GraphQL API with    │        │  table "RetroBoard"│
│                      │ ◀── live changes ───── │   checks in resolvers)│ ◀───── │  boards and notes  │
└──────────────────────┘   (WebSocket)          └──────────────────────┘        └───────────────────┘
        ▲  page files from GitHub Pages (unchanged)
```

- **AppSync** is the front door. Every change is a GraphQL **mutation**. AppSync checks the rules (whose note it is, who the facilitator is) in small JavaScript **resolvers**, writes to DynamoDB, and pushes the change to everyone watching that board through a GraphQL **subscription**.
- **DynamoDB** stores the boards and notes.
- The app still uses **no libraries**. `cloud.js` talks to AppSync with the browser's own `fetch` and `WebSocket`, following AppSync's documented real-time protocol.
- The page files are still static and still served by GitHub Pages; only the data moves.

**Why AppSync + DynamoDB**: they're AWS's ready-made pieces for "a database that pushes changes to browsers". Both can be created and deleted entirely in the web console (spec decision 29), both are serverless (nothing to keep running or patch), and a retro board's usage is a tiny fraction of the free plan's credits.

## 2. Technical choices

| Topic | Choice | Reason |
|---|---|---|
| Languages | HTML, CSS, JavaScript (no TypeScript) | No build step, so nothing to install. |
| Libraries | None | The emoji picker only needs 16 emojis, and pan, zoom and dragging need only built-in browser features. |
| Saving | `localStorage` in the browser | Matches "same browser on the same device" (FR-008). No server needed. |
| Counting characters | `Intl.Segmenter` with grapheme granularity, built into the browser | Counts each emoji as 1 character, including skin tones and flags. The textarea's built-in `maxlength` counts emojis as 2 or more, so it can't be used. |
| Confirm dialogs | The browser's own `confirm()` | Already keyboard accessible and handles Escape. Confirmed by the Product Owner. |
| **[v2]** Pan and zoom | One "world" element moved and scaled with CSS `transform: translate() scale()` | One fast operation per frame, however many notes there are. Nothing else on the page moves. |
| **[v2]** Dragging | Pointer events (`pointerdown`, `pointermove`, `pointerup`) with pointer capture | Built in. Works the same for mouse and trackpad, and dragging is turned off on phones anyway. The HTML drag-and-drop feature is not used: it is clumsy and doesn't work with zooming. |
| **[v2]** Health check table | A real HTML `<table>` on the whiteboard | Screen readers announce rows and column headings for free. On phones, CSS turns each row into a block. |
| Running it | Open `index.html` by double-clicking, or host it as static files | Scripts are loaded as classic scripts, not ES modules, because modules don't load from a double-clicked file in some browsers. Confirmed by the Product Owner. |
| Supported browsers | Current Chrome, Edge, Safari and Firefox (from 2024 on) | Confirmed by the Product Owner. |
| **[v3]** Shared store | **AWS AppSync** (GraphQL API) + **Amazon DynamoDB** (one table), in one AWS region | Live updates built in; created in the console; serverless; deleted in a few clicks (§11). |
| **[v3]** Access to the API | AppSync **API key**, kept in `config.js` | The simplest AppSync access mode, and it matches the "secret board link" decision. The key is visible to anyone who looks at the page's code, so the real protection is the long random board code plus the checks in §5.17. The key is set to expire after about 6 months, in line with the free plan. |
| **[v3]** Rules on AWS | AppSync **JavaScript resolvers** (`APPSYNC_JS` runtime) with DynamoDB **condition expressions** and **transactions** | The checks happen on AWS, not only in the browser, so a hidden button can't simply be un-hidden. Conditions also make reactions and votes add up safely when people click at the same moment. |
| **[v3]** Talking to AppSync | Plain `fetch` for queries and mutations; plain `WebSocket` for subscriptions | No AWS library is needed in the browser, so there's still no build step and nothing to install. |
| **[v3]** Board link | `…/retro-board/#board=<id>`, where `<id>` is `crypto.randomUUID()` | The part after `#` is never sent to GitHub Pages, so board codes don't appear in any web server's logs. A random UUID can't be guessed. |
| **[v3]** Identity | A second random UUID per browser (the **browser secret**), kept in `localStorage` | Sent with each change. AWS stores it on the notes and boards it creates, and never sends it back out (§5.17). |
| **[v3]** Running it | GitHub Pages as before; double-clicking `index.html` still works for development | Both need an internet connection to reach AWS. |

## 3. Files

```
Retro-board/
├── index.html      Page structure: header and toolbar, notice, whiteboard, zoom controls, emoji picker
├── styles.css      Colours, whiteboard look, sticky notes, health table, phone layout, focus styles
├── logic.js        Pure rules with no page access: text limits, cards, health check, placing and
│                   sorting notes, zoom maths, upgrading v1 boards
├── storage.js      Load and save the board; check whether saving works; check saved data
├── canvas.js       [v2] Pan, zoom and dragging. Knows nothing about cards or areas: it reports
│                   "note X was dropped on zone Y at (x, y)" and app.js decides what that means
├── app.js          Draws the board, handles clicks and keys, emoji picker, editing, health check
├── tests/
│   ├── logic.test.js       Automated tests for logic.js (Node's built-in test runner)
│   ├── storage.test.js     Automated tests for storage.js
│   ├── browser-check.js    [v2] Drives headless Chrome through the spec's stories (moved from the
│   │                       scratch script used for v1)
│   └── manual-checklist.md One line per acceptance criterion, for the final hand checks
├── config.js       [v3] The AppSync API address, real-time address and API key. Nothing else
├── cloud.js        [v3] Talks to AppSync: sends queries and changes (fetch), listens for live
│                   changes (WebSocket), reconnects, and reports the connection state to app.js
├── aws/            [v3] Everything that lives on AWS, kept in the repo so it's reviewed in PRs
│   ├── schema.graphql      The GraphQL schema to paste into AppSync
│   ├── resolvers/          One small JavaScript file per query or mutation, to paste into AppSync
│   ├── SETUP.md            Step-by-step console instructions (§11)
│   └── TEARDOWN.md         Step-by-step instructions to delete everything (§11)
├── tests/
│   ├── …                   (as before)
│   └── fake-aws.js         [v3] A stand-in for AppSync that runs on your Mac: serves the app files
│                           and answers the same queries, changes and live updates, in memory
├── spec.md
├── plan.md
└── tasks.md
```

`logic.js`, `storage.js` and `canvas.js`'s maths don't touch the page, so the tricky rules can be tested automatically, without a browser. If `app.js` gets hard to follow, the health check drawing moves to its own `health.js`.

**[v3]** `logic.js` gains one important pure function, `applyChange(board, change)`, which applies one live change to the board. Both your own changes and everyone else's go through it, so it is the heart of the sync and is tested thoroughly. `storage.js` keeps loading old v1 and v2 boards (for the one-off move in §5.19) and now also keeps the browser's own settings: its secret, its last board, and the zoom per board.

## 4. Data [v2]

### What is saved
One entry in `localStorage` under the key `retro-board`:

```
{
  "version": 2,
  "cards": [
    {
      "id": "unique id",
      "column": "well" | "notWell" | "improve",
      "text": "card text with emojis and line breaks",
      "createdAt": 1793000000000,
      "reactions": { "thumbsUp": 0, "heart": 0, "laugh": 0, "party": 0, "wow": 0 },
      "x": 16, "y": 240,          // place inside its column; null = not placed yet
      "z": 7                      // higher = in front
    }
  ],
  "health": {
    "areas": [
      {
        "id": "unique id",
        "name": "Fun",
        "awesome": "We love coming to work…",
        "crappy": "Work feels like a chore…",
        "votes": { "awesome": 0, "fine": 0, "sad": 0 }
      }
    ],
    "notes": [
      { "id": "…", "areaId": "…", "text": "…", "createdAt": 0, "reactions": { … }, "x": 0, "y": 0, "z": 0 }
    ]
  },
  "view": { "zoom": 1, "x": 0, "y": 0 }   // null = "Fit" on first open
}
```

- **Positions** (`x`, `y`) are measured inside the note's own column or Notes cell, in whiteboard units, which are pixels at 100% zoom. A note keeps its place when the zoom changes or a frame grows.
- **`x: null`** means "not placed yet". The app places such notes in the next free space the first time it draws them. This is how v1 boards are upgraded without having to guess note heights while loading.
- **Order of areas** is the order of the `areas` list.
- **Card age** is `createdAt`. Editing never changes it.

### Upgrading a v1 board
`storage.js` recognises `version: 1` and upgrades it:
- every card keeps its id, column, text, age and reactions, and gets `x: null, y: null, z: 0`
- the health check gets the 11 starter areas (spec appendix A) with no votes and no notes
- `view` is `null`, so the first open does a "Fit"

The cards are then placed in neat rows in their v1 order the first time the board is drawn, and saved.

### Shared data on AWS [v3]
One DynamoDB table, **`RetroBoard`**, holds every board. Each board is a small group of **items** that share its board code:

| Partition key `pk` | Sort key `sk` | What the item holds |
|---|---|---|
| `<board id>` | `BOARD` | `facilitatorSecret` · `generation` (goes up by 1 on each Clear) · `noteCount` · `areas` (a map from area id to name, examples and order) · `votes` (a map from area id to awesome, fine and sad counts) · `createdAt` · `updatedAt` · `expiresAt` |
| `<board id>` | `NOTE#<note id>` | `kind` (card or health) · `column` or `areaId` · `text` · `createdAt` · `x`, `y`, `z` · `reactions` (the five counts) · `ownerSecret` · `generation` |

- **Why one item per note:** a reaction or a move then writes one small item, rather than rewriting the whole board. That's cheaper, and two people changing different notes never get in each other's way.
- **Why areas and votes live in the board item:** there are only about 11 areas, they change rarely, and only the facilitator changes them. Keeping them together makes **Clear board** a single update.
- **`ownerSecret` and `facilitatorSecret`** are never part of the GraphQL schema's output, so AppSync can't send them to anyone (§5.17).
- **`generation`:** **Clear board** doesn't delete every note one by one. It adds 1 to the board's `generation`, and from then on only notes with the new `generation` are shown. The old notes become invisible at once for everyone, and the facilitator's browser then deletes them in the background, in batches of 24.
- **`expiresAt`:** DynamoDB's **TTL** (time to live) feature deletes the board item 90 days after its last change. Every change sets `expiresAt` to now + 90 days. Once the board item is gone, its link shows "This board doesn't exist", and any notes left behind can't be reached. They're removed when the table is deleted (§11).
- **`noteCount`:** keeps the 300-note limit. Adding notes only succeeds while the count leaves room.

### Kept in this browser only [v3]
`localStorage` now holds the browser's own settings, not the board:
- `retro-browser`: the **browser secret**, the **last board id**, and whether the old saved board has been **moved** (§5.19)
- `retro-view-<board id>`: the zoom and position for that board (spec Story 7.2)
- `retro-board`: the old v1 or v2 board, left untouched after the move

### Kept in memory only, not saved
- What is being edited (one card, health note or area), and its unsaved text.
- Which Notes cell has its **+ Add note** box open.
- Whether the emoji picker is open, and which text box it belongs to.
- A drag in progress.
- Whether the page is in whiteboard mode or phone mode.

## 5. How each part works

### 5.1 Drawing the board
- One `render()` function draws all notes and the health table from the current data each time something changes. 150 notes is small, so this stays fast.
- **[v2]** Notes are always drawn in **reading order**: top to bottom, then left to right, by their position. So the Tab order matches what you see, in both whiteboard and phone mode.
- Redrawing would normally lose keyboard focus. Every button and text box gets a stable key, and `render()` puts focus back on the same element afterwards. If that element has gone, focus moves to the nearest sensible one.
- The add-card boxes are never redrawn. The edit box is moved, not rebuilt, so its text and cursor survive.
- **[v2]** While a note is being dragged, nothing is redrawn. The note just moves with a transform until it is dropped.

### 5.2 Adding a card (v1, placement changed in v2)
- Enter adds the card. Shift+Enter adds a new line.
- Empty text (only spaces and new lines) is refused with "Type something first 🙂". The text is saved as typed.
- **200-character limit**: on every change, the text is counted with `Intl.Segmenter`. If it goes over 200, only the part that fits is kept. Pasting more than fits shows "Shortened to 200 characters".
- A counter under each text box shows the characters left.
- **[v2]** The new card is placed in the **next free space** in its column (§5.12).

### 5.3 Emoji picker (v1)
One shared picker for every text box. It inserts at the remembered cursor position, unless the note would go over 200 characters. Arrow keys move between emojis. Escape or a click outside closes it, and focus goes back to the text box. **[v2]** The picker also closes when the whiteboard pans or zooms, because it would otherwise float away from its text box.

### 5.4 Reactions (v1, extended to health notes in v2)
Five reaction buttons on every note. Zero counts are faded but still readable. **−** appears only above 0, and a count never goes below 0. Reactions never move notes.

### 5.5 Sort by votes (changed in v2)
- **Sort by votes** takes each retro column's cards in order (👍 highest first, ties oldest first) and lines them up in rows of two, reading left to right then top to bottom (§5.12).
- It measures each card's real height first, so rows never overlap.
- Health notes are not touched. The new positions are saved.

### 5.6 Editing and deleting (v1, generalised in v2)
- **[v2]** One "edit" slot covers all three kinds of thing that can be edited: a card, a health note or an area. Each kind supplies its own fields, its own "can this be saved?" check (text not blank, or area name not blank) and its own save step.
- Enter or Save saves. Escape or Cancel restores the old values.
- **Clicking Edit on something else while editing**: the current edit is saved automatically if it can be, otherwise it's put back, then the new one opens.
- **Delete** asks "Delete this card?", "Delete this note?" or "Delete this area, its votes and notes?" first.

### 5.7 Saving and loading (v1, data changed in v2)
- Every change is saved straight away. **[v2]** Pan and zoom changes are saved half a second after the whiteboard stops moving, to avoid hundreds of saves while scrolling.
- If saving doesn't work, a notice stays at the top of the page and the board still works.
- Damaged saved data is copied to a backup key, and the board starts fresh.
- **[v2]** Saved data is checked against the version 2 shape, including health areas, notes and view. Version 1 data is upgraded (§4).

### 5.8 Clearing the board (changed in v2)
- **Clear board** asks "Delete all notes and votes? This can't be undone."
- It removes all cards, all health notes and every vote, and keeps the areas with their names and examples.
- It is disabled when there are no notes and every vote is 0.
- Clearing also closes any open edit, add box or picker.

### 5.9 Messages (v1)
Short messages appear under the text box they belong to, and screen readers announce them (`aria-live="polite"`). Each one clears itself after a few seconds, or as soon as the user carries on typing.

### 5.10 The whiteboard: pan and zoom [v2]
- **Structure**: a full-window **viewport** with the dotted background holds one **world** element. Both frames are placed inside the world. Pan and zoom only change the world's `transform`.
- **Layout of the world**:
  - The Retro frame is at the left. Each column is wide enough for two notes side by side.
  - The Squad Health Check frame is to the right, with a gap.
  - Frame titles sit just above each frame, as on a whiteboard.
- **Panning**:
  - Dragging on empty background, a frame's empty space or an empty part of a column pans the board.
  - Mouse wheel and two-finger trackpad scrolling also pan.
- **Zooming**:
  - **Ctrl or Cmd + wheel** zooms around the pointer. In Chrome and Firefox, a trackpad pinch arrives as Ctrl + wheel. Safari sends its own `gesture` events, which are handled too.
  - The browser's normal page zoom is blocked only inside the whiteboard.
- **Zoom controls**: floating **−**, a zoom label such as "100%", **+** and **Fit**, in the bottom-right corner.
  - **+** and **−** step through 25, 50, 75, 100, 125, 150 and 200%, centred on the middle of the screen.
  - **Fit** shows both frames whole, with a margin.
- **Limits**: the zoom is kept between 25% and 200% (`clampZoom`). The maths for "zoom around a point" and "fit these bounds" are pure functions in `logic.js`, so they can be tested.
- **Keyboard focus**: when anything inside the world gets focus and is partly out of view, the world pans just enough to show it (spec Story 9.5).

### 5.11 Dragging notes [v2]
- **Starting a drag**: pressing the main mouse button on a note starts a possible drag. It becomes a real drag after the pointer moves 4px. Presses on the note's buttons and text boxes never start a drag (spec Story 11.7).
- **During the drag**:
  - The note comes to the front, gets a slightly bigger shadow, and follows the pointer.
  - Pointer movement is divided by the zoom, so the note stays under the pointer at any zoom level.
  - The **drop zone** under the pointer (a retro column, or a Notes cell) is outlined if it accepts this kind of note.
- **Dropping**:
  - On a zone of the right kind, the note's new position is worked out inside that zone and saved. It is kept inside the zone's width and never above its top edge.
  - Dropping a card in another column changes its column, and therefore its colour. A health note dropped in another area's cell changes its area.
- **Cancelling**: dropping anywhere else, or pressing **Escape** during the drag, slides the note back to its old place with a short animation.
- **Bringing to front**: each note has a `z` number. The note being dragged or edited gets the highest `z` plus 1.
- **Phone mode**: dragging is turned off.
- **Panning** (§5.10) is the same mechanism, started on empty space instead of on a note.

### 5.12 Placing and growing [v2]
All of these are pure functions in `logic.js`, so they can be tested:
- **`findFreeSpot`**: given the rectangles of the notes already in a zone and the new note's width and expected height, it finds the first place, scanning top to bottom then left to right on a small grid, that doesn't overlap any note.
- **`tidyLayout`**: given notes in order and their measured heights, it lines them up in rows of two. Each row is as tall as its tallest note.
- **`readingOrder`**: sorts notes by position, top to bottom then left to right, for drawing and for phone mode.
- **Zone heights**: a retro column is always at least a fixed height. Below its lowest note it keeps a free strip one note tall, so a note can always be dropped below the others. A Notes cell works the same way with a smaller minimum.
- Real note heights are measured from the page after drawing. Only the logic that needs heights (free spot, tidy, zone height) receives them.

### 5.13 Health check [v2]
- **Table**: one row per area. The columns are Area, Example of Awesome, 🟢 Awesome, 🟡 Fine, 🔴 Sad, Example of Crappy and Notes & Comments.
  - The Area cell holds the name with **Edit** and **Delete** buttons.
  - The Notes cell is a drop zone with a **+ Add note** button.
- **Votes**: each vote cell shows a large count, a **+1** button and, above 0, a **−** button. Screen-reader labels give the area and the colour, for example "Fun, Awesome: 3 votes. Add one" and "Remove one Awesome vote from Fun".
- **Add note**: opens an add box in the Notes cell. It follows the same rules as adding a card, and Escape or Cancel closes it. Only one add box is open at a time. The new note goes into the next free space in the cell.
- **Areas**:
  - **Add area** below the table adds "New area" at the bottom and opens it for editing.
  - Editing an area turns its name and example cells into text boxes.
  - The name is limited to 1–40 characters and each example to 200, using the same limit code as notes.
- **Starter areas**: the 11 areas and their texts from spec appendix A live in `logic.js` as `DEFAULT_AREAS`.

### 5.14 Phone mode [v2]
- A media query decides the mode: whiteboard from **768px** wide, phone mode below. `app.js` listens for changes, so rotating a tablet or resizing a window switches modes cleanly.
- In phone mode:
  - The world has no transform and the zoom controls are hidden.
  - The retro columns stack.
  - Notes are shown in a tidy list in reading order (§5.12), with no absolute positions.
  - The health table becomes one block per area, with small labels for each part.
  - Nothing can be dragged.
- Positions are not changed by phone mode, so the whiteboard looks the same again on a laptop.

### 5.15 The GraphQL API [v3]
These are the operations in `aws/schema.graphql`. Every **mutation** returns a `Change`: the board id, a change type, a unique change id, and the details as JSON. The single **subscription** `onChange(boardId)` delivers every `Change` for that board to everyone watching it.

| Operation | Who may do it | What it does on DynamoDB |
|---|---|---|
| `getBoard(boardId, secret)` | Anyone with the link | Reads the board item. Returns areas, votes, `generation`, and `isFacilitator` (worked out on AWS by comparing secrets) |
| `listNotes(boardId, secret, nextToken)` | Anyone with the link | Reads the notes of the current `generation`, page by page. Each note comes with `mine: true/false`, worked out on AWS the same way |
| `createBoard(boardId, secret, areas)` | Anyone | Creates the board item, if the id is not already taken. The caller becomes the facilitator |
| `addNotes(boardId, secret, generation, notes)` | Anyone | One **transaction**: up to 24 new notes, owned by the caller, plus a board update that raises `noteCount`. Fails if the board would go over 300 notes or has been cleared since (`generation` changed) |
| `editNote(boardId, secret, noteId, text)` | The note's owner | Updates the text only if `ownerSecret` matches |
| `deleteNote(boardId, secret, noteId)` | The note's owner | One transaction: deletes the note if `ownerSecret` matches, and lowers `noteCount` |
| `moveNotes(boardId, moves)` | Anyone | One transaction: new `x`, `y`, `z` and column or area for up to 24 notes. Used for dragging (1 note) and **Sort by votes** (many notes, sent in chunks of 24) |
| `react(boardId, noteId, reaction, delta)` | Anyone | Adds +1 or −1 to one reaction **on AWS**. A −1 only succeeds if the count is at least 1 |
| `vote(boardId, areaId, kind, delta)` | Anyone | The same, for a health vote |
| `clearBoard(boardId, secret)` | The facilitator | Raises `generation`, sets `noteCount` to 0 and every vote to 0 |
| `saveArea(boardId, secret, area)` | The facilitator | Adds or edits one area |
| `deleteArea(boardId, secret, areaId)` | The facilitator | Removes the area and its votes. Its health notes disappear from view at once and are deleted in the background |
| `removeNotes(boardId, secret, noteIds)` | The facilitator | Deletes up to 24 leftover notes after a Clear or a deleted area. Not sent to other screens |

Every change also stamps the board item's `updatedAt` and `expiresAt` in the same transaction, so "90 days after the last change" is exact.

### 5.16 Live sync [v3]
- **Opening a board**: `cloud.js` calls `getBoard` and `listNotes`, and opens the subscription. The board is drawn once everything has arrived.
- **Making a change**: the app sends the mutation. When AWS confirms it, the returned `Change` goes through `applyChange`, and the board is redrawn. The same `Change` also arrives through the subscription a moment later, and is skipped because its change id has already been applied.
- **Someone else's change**: it arrives through the subscription, goes through `applyChange`, and the board is redrawn. As in v2, redrawing never touches a note being typed or edited, and keeps keyboard focus (§5.1). Zoom and position are never part of a change.
- **Counts**: reactions and votes arrive as "+1" or "−1", not as a new total, so changes from several people add up correctly.
- **Moves**: arrive as the final position, and the last one to arrive wins. A note being dragged on my screen ignores moves from others until I drop it.
- **Clear board**: arrives as "the generation is now N". Every screen hides notes from older generations at once.
- **Drift protection**: after any reconnect (§5.18), the app reloads the whole board from AWS rather than trusting that it saw every change.

### 5.17 Who can change what [v3]
- **The browser secret** is created the first time the app runs, and sent with every change that needs an owner or facilitator check.
- **Owner checks**: `editNote` and `deleteNote` include the DynamoDB condition `ownerSecret = :secret`. If it doesn't match, AWS refuses, and the app shows "You can only change your own notes" (spec Story 6.9).
- **Facilitator checks**: `clearBoard`, `saveArea`, `deleteArea` and `removeNotes` include the condition `facilitatorSecret = :secret`.
- **What the browser is told**: `mine` on each note and `isFacilitator` on the board. AWS works these out by comparing secrets, so the secrets themselves are never sent to anyone. The app shows **Edit** and **Delete** only when `mine` is true, and **Clear board**, **Add area** and the areas' **Edit** and **Delete** only when `isFacilitator` is true.
- **Notes arriving live**: new notes from others are never mine. My own new notes are marked as mine when AWS confirms them.
- **Limits**, as agreed in the spec: another browser has another secret, and clearing browser data loses the secret.

### 5.18 Connection [v3]
- `cloud.js` reports one of three states to `app.js`: **connecting**, **live** or **lost**.
- **Lost**:
  - The top banner says "Connection lost. Reconnecting…".
  - Every button that changes the board is disabled, and dragging is off.
  - Text boxes keep their text.
  - `cloud.js` retries after 1, 2, 4, 8 and then every 15 seconds.
- **Back**: the board is reloaded (§5.16), the banner goes away and the buttons come back.
- **AppSync's keep-alive**: AppSync sends a "ka" message regularly. If none arrives within the time AppSync tells us when connecting, the connection counts as lost, even if the browser hasn't noticed yet, for example after a laptop wakes from sleep.
- **Nothing reachable when opening**: the page shows "Can't reach the shared board. Check your connection and try again." with a **Try again** button, and no board.
- **A change refused because the board was cleared** (the `generation` didn't match): the app reloads the board and sends the new note again once, so typed text isn't lost (spec Story 8.6).

### 5.19 Starting, sharing and moving boards [v3]
- **On opening**:
  1. If the address has `#board=<id>`, open that board.
  2. If not, and this browser has a last board, put it in the address and open it.
  3. If not, create a new board (below).
- **Creating a board**:
  1. Make a new random id and call `createBoard` with the 11 starter areas.
  2. **Move the old board, once** (spec Story 20): if this browser has a saved v1 or v2 board and hasn't moved it yet, its areas and votes go into `createBoard`, and its notes are sent through `addNotes` in chunks, keeping their text, positions, reactions and age. They're owned by this browser.
  3. Mark the move as done. The old saved copy is not changed.
- **A missing board** (`getBoard` finds nothing): show "This board doesn't exist or has been deleted." with **Start a new board**.
- **🔗 Copy link** uses the browser's clipboard and shows "Link copied". If the clipboard is blocked, the link is shown selected in a small box, so it can be copied by hand.
- **New board** asks first, then creates a board as above. Moving the old board is never repeated.

### 5.20 Changes to existing parts [v3]
- **Saving (§5.7)**: there is no local save of the board any more. Each action sends its mutation instead. The "can't save in this browser" notice now only matters for the browser's own settings: if `localStorage` is blocked, the board still works, but the browser gets a new identity on every visit.
- **Sort by votes (§5.5)**: works out the new positions as before, then sends them with `moveNotes`, in chunks of 24.
- **Clear board (§5.8)**: only shown to the facilitator. After `clearBoard` succeeds, the facilitator's browser removes the old notes in the background with `removeNotes`.
- **Editing (§5.6)**: Save sends `editNote`. While it's on its way, the note shows its new text. If AWS refuses, the old text comes back with a message.
- **Phone mode (§5.14)**: unchanged, apart from hiding the same buttons as on the whiteboard.

## 6. Look, accessibility and colours [v2 look]

- **Whiteboard look**:
  - A warm off-white background with a light dot grid, drawn with a CSS radial gradient.
  - Frames are white with a thin border and their title above.
  - Sticky notes are square-cornered with a soft shadow.
  - Floating toolbars are white rounded panels with a shadow.
  - It's our own palette and shapes, inspired by Miro but not copying its colours, logo or name.
- **Sticky-note colours**:
  - Going well: soft green. Not going well: soft pink. Improvements: soft yellow. Health notes: light blue.
  - The ink on each must reach at least 4.5:1, which will be checked with the same contrast script as v1.
- **Tap targets**: every button is at least 44×44px in phone mode.
- **Keyboard**: everything is a real `<button>` or `<textarea>`. Focus outlines are always visible, and focused items are panned into view.
- **Headings**: one main heading, a heading for each frame, and one for each retro column. The health check uses table headings.
- **Long words**: note text wraps long words and keeps line breaks.
- **[v3] Top bar**:
  - **🔗 Copy link** and **New board** sit next to **Sort by votes**.
  - **Clear board** is shown only to the facilitator.
- **[v3] Connection banner**: a full-width bar under the top bar. It uses the same style as the existing save notice, and screen readers announce it (`aria-live="polite"`).
- **[v3] Disabled while offline**: buttons use the real `disabled` attribute, so they're skipped by Tab and announced as unavailable.

## 7. Testing

### Automated (`node --test`)
- **v1** (37 tests, passing): character counting, cutting text, inserting emojis, the empty check, sorting, card changes, saving and loading.
- **[v2]** New `logic.js` tests:
  - **Health check**:
    - starter areas
    - votes going up and down, never below 0
    - adding, editing and deleting areas, where deleting an area also removes its notes
    - area name limits
    - health note changes
  - **Clear board**: removes notes and votes, keeps areas.
  - **Placing**: `findFreeSpot` (empty zone, full rows, odd heights), `tidyLayout`, `readingOrder`, zone heights.
  - **Moving**: moving notes between zones, bringing to front.
  - **Zoom maths**: `clampZoom`, zooming around a point, Fit.
- **[v2]** New `storage.js` tests:
  - loading version 2 data
  - upgrading version 1 data
  - rejecting damaged version 2 data

### Browser checks (`node tests/browser-check.js`, needs Google Chrome)
- **v1**: 68 checks of the spec's acceptance criteria with real typing, keys and clicks (passing).
- **[v2]** New checks:
  - **Whiteboard**: pan by dragging and wheel; zoom with Ctrl + wheel and the buttons; zoom limits; Fit; zoom and position remembered after refresh.
  - **Dragging**: within a column; to another column (colour changes); a dropped-outside note slides back; a card dropped on a Notes cell slides back; Escape cancels; notes come to the front; zones grow.
  - **Health check**: votes, adding areas, editing areas (including an empty name), deleting areas, and health notes (add, edit, react, drag between areas).
  - **Clear board** keeps the areas.
  - **Upgrading** a saved v1 board.
  - **Phone mode**: no transform, stacked lists in reading order, health blocks, no dragging, 44px buttons.

### [v3] Automated tests for the shared board
- **New `logic.js` tests** (`node --test`):
  - `applyChange` for every change type
  - skipping a change that has already been applied
  - counts added from several people
  - the last move wins
  - Clear hides older generations
  - a deleted area hides its notes
  - showing **Edit** and **Delete** only for `mine`, and facilitator buttons only for `isFacilitator`
  - splitting Sort moves into chunks of 24
  - the 300-note limit
- **New `storage.js` tests**: the browser secret is created once and kept; the last board is remembered; zoom is saved per board; the old board is moved only once.
- **`fake-aws.js`**: a small Node program that stands in for AppSync on your Mac.
  - It serves the app's files.
  - It answers the same GraphQL queries and mutations over HTTP, and pushes live changes using the same WebSocket protocol as AppSync.
  - It applies the same owner, facilitator, count and generation rules as the real resolvers.
  - It can pretend to drop the connection.
  - It needs no AWS account and costs nothing, so **CI keeps working without AWS**. It's written with Node's built-in modules only.
- **New browser checks** (`tests/browser-check.js` against `fake-aws.js`, with **two browser tabs as two people**):
  - Tab B sees Tab A's new card within 2 seconds.
  - Tab B has no Edit or Delete on A's card, but can react to it.
  - Both tabs react at once, and the count goes up by 2.
  - B drags A's card, and A sees it move.
  - Only A (the facilitator) sees Clear board, and clearing empties B's screen.
  - A missing board shows its message.
  - A dropped connection shows the banner and disables buttons; when it's back, the board catches up and typed text is kept.
  - The old saved board moves once.
  - Copy link works.
  - Phone mode follows the same rules.
- **Resolvers**: the real AppSync resolvers can only run on AWS, so they are checked by the manual two-window test below, and by AppSync's own **Run test** button in the console while setting up (§11).

### [v3] Manual check on the real AWS, before release
Two browser windows (one normal, one private, so they're two different people), plus a phone if one is to hand, all on the real AppSync:
- every story in spec Stories 16–20
- Stories 4, 6, 8, 11 and 15 as they apply to two people
- AppSync's **Monitoring** page and the AWS **Billing** page checked afterwards, to see the usage and confirm it costs $0

### Manual checklist
One line for each acceptance criterion in spec Stories 1–15, tested by hand:
- in Chrome and Safari, on a laptop screen and a phone-sized screen
- with a mouse wheel **and** a trackpad (pinch to zoom in Safari especially)
- using only the keyboard
- with VoiceOver for a quick screen-reader check
- with saving blocked, to check the notice
- with 100 cards and 50 health notes, to check speed while dragging and zooming

## 8. How the plan covers the spec

| Requirement | Plan section |
|---|---|
| FR-001 Three columns | §5.1, §5.10 |
| FR-002 Add a card, 1–200 characters, next free space | §5.2, §5.12 |
| FR-003 Cut long pastes, with a message | §5.2 |
| FR-004 Emoji picker | §5.3 |
| FR-005 Reactions on every note | §5.4 |
| FR-006 Sort by votes into rows | §5.5, §5.12 |
| FR-007 Edit and delete notes and areas, one at a time | §5.6 |
| FR-008 Keep everything after a refresh; upgrade v1 | §4, §5.7 |
| FR-009 Clear notes and votes, keep areas | §5.8 |
| FR-010 Phone and laptop; keyboard except moving | §5.10, §5.14, §6 |
| FR-011 Pan and zoom, 25%–200% | §5.10 |
| FR-012 Drag within zones of the same kind | §5.11 |
| FR-013 Zones grow | §5.12 |
| FR-014 Health check table | §5.13 |
| FR-015 Health votes | §5.13 |
| FR-016 Health notes | §5.13, §5.11 |
| FR-017 Add, edit, delete areas | §5.13, §5.6 |
| FR-018 Phone layout | §5.14 |
| FR-019 Last board, new board, Copy link | §5.19, §6 |
| FR-020 Live changes within 2 seconds; personal zoom | §5.15, §5.16, §4 |
| FR-021 Owner checks on AWS | §5.17, §5.15 |
| FR-022 Facilitator checks on AWS | §5.17, §5.15 |
| FR-023 Counts add up; last move wins | §5.15, §5.16 |
| FR-024 Lost connection, reconnect, can't reach | §5.18 |
| FR-025 Move the old board once | §5.19 |
| FR-026 300 notes; deleted after 90 days; missing board | §4, §5.15, §5.19 |
| FR-027 Anonymous notes | §4 (no names stored), §5.17 |

## 9. Risks

| Risk | What we do |
|---|---|
| Someone clears the browser's data and the board is lost | Accepted. Export is out of scope (spec §8). |
| The board is opened in two tabs, and one tab overwrites the other's changes | Accepted (one shared screen). |
| Redrawing loses keyboard focus | Stable keys and focus restore (§5.1), tested in the browser checks. |
| Emojis look different on Windows, Mac and phones | Accepted. The app uses each system's own emoji font. |
| **[v2]** Trackpads and mouse wheels send very different scroll amounts, so zoom feels too fast or slow | Zoom speed is based on the scroll amount, not on the number of events. Tuned by hand with both a mouse and a trackpad. |
| **[v2]** Safari pinch-to-zoom uses its own events | Handled separately (§5.10) and tested by hand in Safari. |
| **[v2]** Text is too small to read when zoomed out | Accepted. **Fit** and **+** bring it back. The default after Fit is usually 60–90% on a laptop. |
| **[v2]** Overlapping notes hide each other | Dragging or editing brings a note to the front, and **Sort by votes** tidies a column. |
| **[v2]** Dragging feels slow with many notes | Nothing is redrawn during a drag; only one transform changes. Checked with 150 notes. |
| **[v2]** A note is dragged by accident while someone means to click | Drags start only after 4px of movement, and never from buttons or text boxes. |
| **[v2]** `app.js` grows large | Split the health check into `health.js` if needed (§3). |
| **[v3]** The API key is visible in the page's code, so someone could call the API directly | They'd still need a board's random code to see it, and the owner and facilitator checks run on AWS. There's no "list all boards" operation. The budget alert (§11) warns about unusual use. Sign-in (Cognito) can come later. |
| **[v3]** Someone creates lots of boards or notes to run up costs | Each board is capped at 300 notes. AppSync limits request rates by default. The $1 budget alert emails you, and the API key can be deleted in one click to stop everything. |
| **[v3]** GitHub's secret scanning may flag the API key in `config.js` | Expected, and safe to dismiss: this key is meant to be public. Its protection is described in the row above. |
| **[v3]** Writing the WebSocket protocol by hand gets something subtle wrong | It follows AWS's published AppSync real-time protocol. `fake-aws.js` speaks the same protocol, and the manual check runs against the real AppSync. |
| **[v3]** Changes are missed while the connection is half-alive | Keep-alive timeout (§5.18), and a full reload after every reconnect (§5.16). |
| **[v3]** Notes left behind after a Clear, a deleted area or an expired board stay in the table | Invisible and unreachable; the facilitator's browser removes the first two kinds in the background. Anything left goes when the table is deleted at teardown. The amount is tiny. |
| **[v3]** After teardown, the live site can't reach AWS and stops working | Before v3 is merged, `main` is tagged **`v2.0`** on GitHub. After teardown, a PR brings back the v2 files, so the site works again as a single-screen board. |
| **[v3]** The AWS free plan ends, or costs appear | The teardown checklist (§11) is done before the plan ends, followed by a check of the Billing page. |
| **[v3]** Mixing up personal and company AWS accounts on the work laptop | Everything is done in the AWS **web console**, in a private browser window, signed in to the **personal** account. No AWS command-line tools are used, and the `.aws` folder is never touched. |

## 10. Decisions confirmed by the Product Owner

Confirmed on 26 October 2026:

1. **How it runs**: the Scrum Master double-clicks `index.html` on their laptop. It can also be put on any static web host later.
2. **Browsers**: current Chrome, Edge, Safari and Firefox only.
3. **Confirm dialogs**: the browser's built-in pop-up is used for every "Delete …?" question.

For v3, see spec decisions 28–36 and the v3 defaults (29 October 2026).

## 11. AWS setup, cost and teardown [v3]

All of this is done by hand in the **AWS web console**, in a private browser window signed in to the **personal** AWS account. `aws/SETUP.md` will give click-by-click steps; this is the outline.

### Setting up (about 30–45 minutes, once)
1. **Pick one region** close to the team, for example Europe (London) or Asia Pacific (Mumbai), and use it for everything.
2. **Budget alert first**: Billing and Cost Management → **Budgets** → a monthly cost budget of **$1**, emailing you at 80% and 100%.
3. **DynamoDB**:
   - Create the table **`RetroBoard`**, with partition key `pk` (String) and sort key `sk` (String).
   - Choose **On-demand** capacity, so you only pay per request, and there's nothing to size.
   - Turn on **Time to Live** for the attribute `expiresAt`.
4. **AppSync**:
   - Create a **GraphQL API** → **Design from scratch** → name it `retro-board`.
   - Paste in `aws/schema.graphql`.
   - Add the `RetroBoard` table as a **data source**. The console creates the access role for it.
   - Attach each resolver from `aws/resolvers/`.
   - Try a few with the console's **Queries** page and the resolvers' **Run test** button.
5. **API key**: AppSync → Settings → create an **API key** that expires in about 6 months.
6. **Connect the app**: copy the API's **GraphQL endpoint**, **real-time endpoint** and **API key** into `config.js`.
7. **Logging**: leave AppSync logging **off**. It isn't needed, and it would store the secrets sent with each change in CloudWatch.

### What it costs
- During the AWS Free plan: **$0**. Usage comes out of the free credits, and the free plan never charges a card.
- At list prices, one team's fortnightly retro would cost **well under $1 a month**.
- The budget alert is the safety net.

### Teardown (about 10 minutes, before the free plan ends)
`aws/TEARDOWN.md` will give click-by-click steps:
1. On GitHub: merge the PR that brings back the v2 files (§9), so the live site works without AWS.
2. **AppSync**: delete the `retro-board` API. Its API key, resolvers and data source go with it.
3. **DynamoDB**: delete the `RetroBoard` table, with every board in it.
4. **IAM**: delete the role the console created for the data source; its name starts with `appsync-ds-ddb-`.
5. **CloudWatch**: delete any log groups whose names start with `/aws/appsync/`. There should be none, if logging was left off.
6. **Budgets**: keep the $1 budget until the next bill shows $0, then delete it if you like.
7. **Check**: the AWS **Billing** page shows no running services, and **Cost Explorer** shows $0.
