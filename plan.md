# Implementation Plan: Sprint Retro Board

**Status**: Approved v3 — v2 (whiteboard canvas and Squad Health Check) approved by the Product Owner on 27 October 2026
**Created**: 26 October 2026
**Updated**: 27 October 2026
**Spec**: [spec.md](spec.md) (Approved v4)

> This plan describes HOW the app in the spec will be built. It contains no code. The task list is in [tasks.md](tasks.md).
>
> Sections marked **[v2]** are new or changed for the whiteboard and health check. Everything else is v1 and already built.

---

## 1. Summary

A single web page that runs in the browser on the Scrum Master's laptop. It is written in plain HTML, CSS and JavaScript, with **no frameworks, no libraries, no build step and no server**. The board is saved in the browser's own storage (`localStorage`), so it survives a refresh on the same browser and device.

**[v2]** On laptop-sized screens, the page becomes a whiteboard. Pan and zoom work by moving and scaling one large area with a CSS transform. Notes are dragged with the browser's pointer events. On phones, the same content is shown as a simple stacked page with no transform and no dragging.

**Why this approach**: v1 and v2 both run on one shared screen with no logins and no syncing (spec §2, §8). Pan, zoom and dragging for about 150 notes don't need a library: CSS transforms and pointer events are built into every supported browser and are fast. Staying library-free keeps the "double-click `index.html`" way of running the app.

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
├── spec.md
├── plan.md
└── tasks.md
```

`logic.js`, `storage.js` and `canvas.js`'s maths don't touch the page, so the tricky rules can be tested automatically, without a browser. If `app.js` gets hard to follow, the health check drawing moves to its own `health.js`.

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

## 10. Decisions confirmed by the Product Owner

Confirmed on 26 October 2026:

1. **How it runs**: the Scrum Master double-clicks `index.html` on their laptop. It can also be put on any static web host later.
2. **Browsers**: current Chrome, Edge, Safari and Firefox only.
3. **Confirm dialogs**: the browser's built-in pop-up is used for every "Delete …?" question.
