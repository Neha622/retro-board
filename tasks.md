# Tasks: Sprint Retro Board

**Status**: Approved v2 — v2 tasks (Phases 5–7) approved by the Product Owner on 27 October 2026
**Created**: 26 October 2026
**Updated**: 27 October 2026
**Spec**: [spec.md](spec.md) (Approved v4) · **Plan**: [plan.md](plan.md) (Approved v3)

> Work through the tasks in order. Tasks marked **[P]** don't depend on each other and can be done in any order within their phase. Each phase ends with a checkpoint: the app must work and the tests must pass before the next phase starts.
>
> For `logic.js` and `storage.js`, the tests are written first: write the test, see it fail, then write the rule until it passes.
>
> Phases 1–4 (v1) are done. Phases 5–7 build v2. Phase 8 is the final checks for everything, as agreed with the Product Owner.

---

## Phase 1 — Setup ✅

- [x] **T001** Create the files from plan §3: `index.html`, `styles.css`, `logic.js`, `storage.js`, `app.js` and `tests/logic.test.js`. Each starts nearly empty.
  - *Done when*: `index.html` opens in a browser by double-clicking, loads all three scripts with no console errors, and `node --test` runs (with no tests yet).
- [x] **T002** Set up `logic.js` and `storage.js` so they work in both places: in the browser as classic scripts, and in Node for the tests (plan §2, §3).
  - *Done when*: a placeholder test can call a function from `logic.js`.

**Checkpoint 1**: the empty page opens and the test runner works.

---

## Phase 2 — Foundations (rules and saving, no page yet) ✅

Tests first (all in `tests/logic.test.js`):

- [x] **T003** [P] Tests for **character counting**: plain text, emojis, skin-tone emojis, flags, family emojis and line breaks. Each emoji counts as 1 (spec Story 2.6).
- [x] **T004** [P] Tests for **cutting text to 200 characters** without breaking an emoji in half (Story 2.5).
- [x] **T005** [P] Tests for **inserting an emoji at the cursor**: at the start, middle and end; refused if it would go over 200 (Story 3.2, 3.7).
- [x] **T006** [P] Tests for the **empty-text check**: blank, spaces only, new lines only, and normal text (Story 2.3, 6.4).
- [x] **T007** [P] Tests for **sorting**: 👍 highest first, ties oldest first, each column separately, other reactions ignored (Story 5.2–5.3).
- [x] **T008** [P] Tests for **card changes**:
  - adding puts the card at the end
  - editing keeps the card's age and reactions
  - deleting a card
  - clearing all cards
  - reactions go up by 1, and down by 1 but never below 0
  - (Stories 2, 4, 6, 8)

Rules:

- [x] **T009** Write the rules in `logic.js` until T003–T008 pass (plan §5.2–5.6).
- [x] **T010** Write `storage.js` (plan §5.7). It must:
  - check whether saving works
  - load the board, or start an empty one
  - save the board
  - copy damaged saved data to a backup key and start empty
- [x] **T011** Add tests (in `tests/storage.test.js`) for loading missing, valid and damaged saved data. Use a stand-in for the browser's storage.

**Checkpoint 2**: `node --test` passes everything. There's still no visible board.

---

## Phase 3 — P1 stories (a usable board) ✅

- [x] **T012** **Page structure and colours** (Story 1; plan §6)
  - Add the header (the **Sort by votes** and **Clear board** buttons are added with T018 and T019), a message area under each add box (`aria-live="polite"`), the saving notice area and three columns. The columns are Going well 😊, Not going well 😟 and Improvements 💡, each with a heading, an add box, an emoji button, an **Add** button and a "left" counter.
  - Define the colours as variables and check every pair meets WCAG AA. Make focus outlines visible.
  - *Done when*: Story 1.1 and 1.2 pass by hand.
- [x] **T013** **Drawing the board** (Story 1.3; plan §5.1)
  - Write `render()`: it draws the cards in list order and shows "No cards yet — add one!" in empty columns.
  - Add focus restore using a stable key on each element.
  - Card text keeps line breaks and wraps long words.
- [x] **T014** **Adding a card** (Story 2; plan §5.2)
  - Enter adds the card and Shift+Enter starts a new line.
  - Show the "left" counter and stop typing at 200.
  - Cut long pastes, with the message "Shortened to 200 characters".
  - Block empty cards, with the message "Type something first 🙂".
  - Clear the text box after adding.
  - Messages clear themselves after a few seconds or when typing starts again (plan §5.9).
- [x] **T015** **Saving and loading** (Story 7; plan §5.7)
  - Save after every change and load on start.
  - Show the "can't be saved" notice when saving doesn't work.
  - *Done when*: Story 7.1 passes after a refresh, and Story 7.2 passes in a private window.
- [x] **T016** **Emoji picker** (Story 3; plan §5.3)
  - One shared picker with the 16 emojis, opened from any emoji button.
  - Move between emojis with the arrow keys; only one emoji is in the Tab order. Pick with Enter or a click.
  - Insert the emoji at the remembered cursor position.
  - Close with Escape or a click outside, then put focus back in the text box.
- [x] **T017** **Reactions** (Story 4; plan §5.4)
  - Add the five reaction buttons with counts. Zero counts are faded but still pass contrast checks.
  - Show a **−** button only when a count is above 0. When it disappears, focus moves to the reaction button.
  - Add screen-reader labels. Cards never move when reactions change.

**Checkpoint 3**: a retro can run end to end. You can add cards with emojis, react, and refresh without losing anything. Every P1 acceptance criterion passes by hand.

---

## Phase 4 — P2 stories ✅

- [x] **T018** [P] **Sort by votes** (Story 5; plan §5.5)
  - The button sorts every column and saves the new order.
  - New cards still go to the bottom afterwards.
  - The order survives a refresh.
- [x] **T019** [P] **Clear board** (Story 8; plan §5.8)
  - Ask "Delete all cards? This can't be undone." before clearing.
  - Disable the button when the board is empty.
  - Clearing closes any open edit or picker.
- [x] **T020** **Editing** (Story 6.1–6.7; plan §5.6)
  - **Edit** opens a text box on the card with **Save**, **Cancel** and an emoji button. It follows the same rules as adding (T014).
  - Enter or Save saves. Saving empty text is blocked with "A card can't be empty".
  - Escape or Cancel restores the old text.
  - Clicking Edit on another card saves the current card first, or restores it if empty.
- [x] **T021** **Deleting** (Story 6.8)
  - Ask "Delete this card?" before deleting.
  - Deleting the card being edited also ends the edit.
- [x] **T022** **Responsive layout** (Story 9.1–9.2; plan §6)
  - Columns sit side by side from 768px wide and stack below that.
  - Buttons are at least 44×44px on small screens.

**Checkpoint 4**: every P2 acceptance criterion passes by hand. *(68 browser checks pass.)*

---

## Phase 5 — v2 foundations (rules and saving, no new screens) ✅

- [x] **T023** Move the browser check script into the project as `tests/browser-check.js` (plan §3, §7), with a line at the top on how to run it.
  - *Done when*: `node tests/browser-check.js` passes all 68 v1 checks.

Tests first (in `tests/logic.test.js`):

- [x] **T024** [P] Tests for **health areas and votes** (Stories 12, 13, 15):
  - `DEFAULT_AREAS` has the 11 areas in order, with their texts
  - votes go up by 1, and down by 1 but never below 0
  - adding an area puts it at the bottom
  - editing an area's name and examples
  - deleting an area also removes its health notes
  - area name check: 1–40 characters, emojis count as 1
- [x] **T025** [P] Tests for **health notes** (Story 14): create, edit (keeps age, reactions and place), delete, react.
- [x] **T026** [P] Tests for **clearing** (Story 8): removes all cards, health notes and votes, and keeps the areas with their texts.
- [x] **T027** [P] Tests for **placing** (plan §5.12):
  - `findFreeSpot`: an empty zone, a full first row, notes of different heights, overlapping notes
  - `tidyLayout`: rows of two, each row as tall as its tallest note
  - `readingOrder`: top to bottom, then left to right
  - zone height: never below the minimum, and always a free strip below the lowest note
- [x] **T028** [P] Tests for **moving** (Story 11):
  - moving a card within its column, or to another column (which changes its column)
  - moving a health note to another area
  - positions kept inside the zone's width and never above its top
  - bringing a note to the front
- [x] **T029** [P] Tests for **zoom maths** (Story 10): `clampZoom` (25%–200%), zooming around a point keeps that point still, and Fit shows the given bounds with a margin.

Rules and saving:

- [x] **T030** Write the rules in `logic.js` until T024–T029 pass. New cards get `x: null, y: null, z: 0`.
- [x] **T031** Update `storage.js` for version 2 (plan §4, §5.7), with tests first in `tests/storage.test.js`:
  - load valid version 2 data
  - upgrade version 1 data: cards kept and unplaced, 11 starter areas, view `null`
  - treat damaged version 2 data as damaged, including bad areas, health notes or view

**Checkpoint 5**: `node --test` passes everything, and the app still works as v1 with upgraded data (`node tests/browser-check.js` passes).

---

## Phase 6 — Whiteboard (retro on the canvas) ✅

- [x] **T032** **Whiteboard page and look** (Story 1, 10.1, 10.6; plan §5.10, §6)
  - Add the viewport, the world, the Retro frame with its title, and the floating zoom controls (−, label, +, Fit).
  - Make the new look: dotted grid, white frames, sticky-note colours per column, soft shadows, floating toolbars.
  - Run the contrast check on every new colour pair, including ink on every sticky colour.
- [x] **T033** **Pan and zoom** in `canvas.js` (Story 10.2–10.5; plan §5.10)
  - Pan by dragging empty space, mouse wheel and trackpad scrolling.
  - Zoom with Ctrl/Cmd + wheel (and pinch) around the pointer, plus Safari's `gesture` events.
  - The + / − buttons step through set levels, Fit shows both frames, and the label shows the zoom. Zoom stays between 25% and 200%.
  - Save the view half a second after movement stops, and restore it on load. The first open, or `view: null`, does a Fit.
- [x] **T034** **Notes on the canvas** (Story 2.1, 7.3, 11.5–11.6; plan §5.1, §5.12)
  - Draw cards at their positions inside their column, in reading order in the page.
  - Place new cards, and any unplaced (upgraded) cards, with `findFreeSpot`, using measured heights.
  - Columns grow to fit their notes.
- [x] **T035** **Dragging cards** (Story 11.1, 11.3, 11.4, 11.7; plan §5.11)
  - Start after 4px of movement, never from buttons or text boxes.
  - The card follows the pointer at any zoom, and the zone under the pointer is outlined.
  - Dropping in a column moves the card there, and its colour changes if the column changes.
  - Dropping anywhere else, or pressing Escape, slides it back.
  - The dragged or edited card comes to the front.
- [x] **T036** **Sort by votes on the canvas** (Story 5; plan §5.5): measure heights, then line up each column with `tidyLayout`.
- [x] **T037** **Keyboard on the canvas** (Story 9.3, 9.5; plan §5.10, §5.3)
  - Focused items pan into view.
  - The emoji picker closes on pan or zoom.
  - The zoom buttons work from the keyboard.
- [x] **T038** **Phone mode for the retro** (Story 9.2; plan §5.14)
  - Below 768px: no transform, no zoom controls, stacked columns, cards in a tidy list in reading order, no dragging.
  - Switches cleanly when the window is resized.

**Checkpoint 6**:
- The retro works fully on the whiteboard and in phone mode.
- The v1 browser checks pass, updated where v2 changed the behaviour (placement and sorting).
- New browser checks pass for pan, zoom, dragging and phone mode.

---

## Phase 7 — Squad Health Check ✅

- [x] **T039** **Health check frame and table** (Story 1.1, 12; plan §5.13)
  - Add the Squad Health Check frame to the right of the Retro frame, with the table headings in order and the 11 starter areas.
  - Fit now covers both frames.
- [x] **T040** **Votes** (Story 13): **+1** and **−** in each vote cell, zero cells faded, and screen-reader labels with the area and colour.
- [x] **T041** **One edit slot for everything** (Story 6.6–6.7, 15.6; plan §5.6)
  - Generalise editing so a card, a health note or an area can be edited, one at a time.
  - Switching saves the current edit, or puts it back if it can't be saved.
- [x] **T042** **Health notes** (Story 14, 4, 6, 11.2–11.3; plan §5.13, §5.11)
  - **+ Add note** opens an add box (same rules as cards; Escape or Cancel closes it; one box open at a time).
  - The new note goes into the next free space in its cell.
  - Health notes are light blue, with reactions, Edit and Delete ("Delete this note?", "A note can't be empty").
  - They drag between areas' Notes cells, but not into retro columns. Cards can't go into Notes cells.
- [x] **T043** **Changing areas** (Story 15; plan §5.13)
  - Edit an area's name and examples (name 1–40, examples up to 200, "An area needs a name").
  - **Add area** adds "New area" at the bottom, opened for editing.
  - **Delete** asks "Delete this area, its votes and notes?".
- [x] **T044** **Clear board for both** (Story 8; plan §5.8)
  - The new wording is "Delete all notes and votes? This can't be undone."
  - Clearing removes cards, health notes and votes, and keeps the areas.
  - The button is disabled when there are no notes and every vote is 0.
- [x] **T045** **Phone mode for the health check** (Story 9.2; plan §5.14): one block per area, with labels and health notes in a tidy list, and 44px buttons.

**Checkpoint 7**:
- Retro and health check work together on one whiteboard and in phone mode.
- All automated tests pass.
- New browser checks pass for votes, areas, health notes, clearing and upgrading a v1 board.

---

## Phase 8 — Final checks (v1 and v2) ⏸ parked

> Parked by the Product Owner on 28 October 2026: the app is good to use as it is. Pick this phase up before relying on Safari pinch-to-zoom, VoiceOver or very large boards.

- [ ] **T046** Write the manual checklist (`tests/manual-checklist.md`), with one line for each acceptance criterion in spec Stories 1–15.
- [ ] **T047** [P] Run the checklist in **Chrome** and **Safari** on a laptop-sized screen, with both a **mouse wheel** and a **trackpad**. Check pinch to zoom in Safari especially.
- [ ] **T048** [P] Run the checklist on a **phone-sized** screen.
- [ ] **T049** [P] **Keyboard only**: do every action except moving notes without a mouse (Story 9.3).
- [ ] **T050** [P] **Screen reader**: a quick VoiceOver pass covering frame and column headings, the health table, vote labels, reaction labels and spoken messages.
- [ ] **T051** [P] **Speed**: with 100 cards and 50 health notes, check that dragging, zooming, adding and sorting still feel smooth (spec §7).
- [ ] **T052** **Upgrade with real data**: open v2 in the browser that holds the current v1 board, and check that every card is still there, laid out in rows.
- [ ] **T053** **Success criterion**: someone who hasn't seen the app adds a card with an emoji in under 30 seconds (spec §7).
- [ ] **T054** Fix anything found in T047–T053, then re-run `node --test`, `node tests/browser-check.js` and the failed checklist lines.

**Checkpoint 8 (done)**: all automated tests and browser checks pass, every checklist line passes, and the spec's success criteria are met.

---

## Coverage

| Spec story | Tasks |
|---|---|
| 1 See the board | T012, T013, T032, T039 |
| 2 Add a card | T003, T004, T006, T009, T014, T034 |
| 3 Emojis in note text | T005, T009, T016, T037 |
| 4 Reactions | T008, T009, T017, T042 |
| 5 Sort by votes | T007, T009, T018, T036 |
| 6 Edit and delete | T006, T008, T020, T021, T041, T042 |
| 7 Keep after refresh, upgrade v1 | T010, T011, T015, T031, T033, T052 |
| 8 Clear board | T008, T019, T026, T044 |
| 9 Any screen, keyboard, contrast | T012, T022, T032, T037, T038, T045, T049, T050 |
| 10 Whiteboard canvas | T029, T032, T033 |
| 11 Move notes | T027, T028, T034, T035, T042 |
| 12 See the health check | T024, T039 |
| 13 Health votes | T024, T040 |
| 14 Health notes | T025, T042 |
| 15 Change areas | T024, T041, T043 |
