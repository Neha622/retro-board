# Tasks: Sprint Retro Board

**Status**: Approved v3 — v3 tasks (Phases 9–15) approved by the Product Owner on 29 October 2026
**Created**: 26 October 2026
**Updated**: 29 October 2026
**Spec**: [spec.md](spec.md) (Approved v5) · **Plan**: [plan.md](plan.md) (Approved v4)

> Work through the tasks in order. Tasks marked **[P]** don't depend on each other and can be done in any order within their phase. Each phase ends with a checkpoint: the app must work and the tests must pass before the next phase starts.
>
> For `logic.js` and `storage.js`, the tests are written first: write the test, see it fail, then write the rule until it passes.
>
> Phases 1–4 (v1) are done. Phases 5–7 build v2. Phase 8 is the final checks for v1 and v2 (parked). Phases 9–15 build v3, the shared live board.
>
> **[v3] Who does what**: tasks marked **👩‍💼 PO** are done by the Product Owner in the AWS console or on the GitHub website, with Claude guiding step by step. Claude does everything else.

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

## Phase 9 — AWS files and console setup [v3]

Claude writes the AWS pieces into the repo first, so they can be reviewed before anything is created on AWS:

- [x] **T055** Write `aws/schema.graphql` (plan §5.15).
  - It has the `Change` type, the 2 queries, the 11 mutations and the `onChange(boardId)` subscription.
  - The secrets appear only as inputs, never in any output type.
- [x] **T056** Write the resolvers in `aws/resolvers/`, one file per operation (plan §4, §5.15, §5.17).
  - Use DynamoDB conditions for the owner and facilitator checks, the 300-note limit, `generation`, and "never below 0".
  - Use transactions for the operations that change more than one item.
  - Every change stamps `updatedAt` and `expiresAt` on the board item.
  - Work out `mine` and `isFacilitator` on AWS.
- [x] **T057** Write `aws/SETUP.md` and `aws/TEARDOWN.md`, with click-by-click console steps (plan §11).

**Checkpoint 9a**: the Product Owner has read the schema and both guides.

Then the Product Owner sets up AWS in the web console, in a private window signed in to the **personal** account. Claude guides each step:

- [x] **T058** 👩‍💼 PO: pick the region, and create the **$1 monthly budget** with email alerts at 80% and 100%.
- [x] **T059** 👩‍💼 PO: create the DynamoDB table `RetroBoard`: `pk` and `sk` as Strings, **on-demand** capacity, and **TTL** on `expiresAt`.
- [x] **T060** 👩‍💼 PO: create the AppSync GraphQL API `retro-board`:
  - paste in the schema
  - add the table as a data source
  - attach every resolver
  - leave logging off
- [x] **T061** 👩‍💼 PO: test it in the AppSync console's **Queries** page:
  - create a board, add a note, react to it
  - try to edit the note with the wrong secret, and check it's refused
  - check the items in DynamoDB's **Explore items**
- [x] **T062** 👩‍💼 PO: create the **API key** (expiring in about 6 months), and send Claude the GraphQL endpoint, the real-time endpoint and the API key for `config.js`.
- [x] **T063** 👩‍💼 PO: on GitHub, tag the current `main` as **`v2.0`** (Releases → Draft a new release → new tag `v2.0`), so v2 can be brought back after teardown (plan §9).

**Checkpoint 9**: AWS answers the console tests correctly, the owner check refuses a wrong secret, and the budget alert exists.

---

## Phase 10 — Sync foundations: rules and browser settings [v3]

Tests first (in `tests/logic.test.js`):

- [x] **T064** [P] Tests for **`applyChange`** (plan §5.16), one or more for each change type:
  - notes added, edited, deleted and moved
  - reactions +1 and −1
  - votes
  - board cleared (new generation)
  - area saved and deleted (its notes hidden)
- [x] **T065** [P] Tests for **sync rules**:
  - a change id that has already been applied is skipped
  - +1 from several people adds up
  - the last move wins
  - a note being dragged here ignores moves from others until it's dropped
  - notes from older generations are hidden
- [x] **T066** [P] Tests for **permissions on screen** (spec Stories 6, 8, 15, 18):
  - Edit and Delete only when `mine`
  - Clear board, Add area and area Edit/Delete only when `isFacilitator`
- [x] **T067** [P] Tests for **chunking and limits**:
  - Sort's moves split into chunks of 24, and old notes split into batches of 24
  - adding a note on a board with 300 notes is refused with "This board is full (300 notes)"
- [x] **T068** Write the rules in `logic.js` until T064–T067 pass.

Browser settings (in `storage.js`, tests first in `tests/storage.test.js`):

- [x] **T069** Tests and code for the **browser settings** (plan §4):
  - the secret is created once and then kept
  - the last board is remembered
  - zoom and position are saved per board
  - the old v1 or v2 board is offered for moving only once, and is never changed
  - when `localStorage` is blocked, everything still works with a new identity each time

**Checkpoint 10**: `node --test` passes everything, including all v1 and v2 tests. Nothing on screen has changed yet.

---

## Phase 11 — Talking to AWS: `cloud.js` and the fake AWS [v3]

- [x] **T070** Write `tests/fake-aws.js` (plan §7), using Node's built-in modules only:
  - serves the app's files
  - answers the same queries and mutations over HTTP, with the same owner, facilitator, limit and generation rules as the real resolvers
  - pushes changes over WebSocket using AppSync's real-time protocol (`connection_init`, `connection_ack`, `start`, `data`, `ka`)
  - can drop the connection on request, for tests
- [x] **T071** Write `config.js`, and `cloud.js` part 1: **queries and changes** with `fetch` (plan §5.15).
  - It sends the API key, returns the `Change`, and turns AWS refusals into clear errors: not yours, not the facilitator, board full, board cleared, board missing.
- [x] **T072** `cloud.js` part 2: **live changes** over `WebSocket` (plan §5.16, §5.18).
  - Connect, subscribe to `onChange(boardId)`, and pass each `Change` to the app.
  - Watch the keep-alive.
  - Report **connecting**, **live** and **lost**.
  - Retry after 1, 2, 4, 8 and then every 15 seconds.
- [x] **T073** A small Node script checks `cloud.js` against `fake-aws.js`: two clients, one adds a note and the other receives it; and a dropped connection reconnects.

**Checkpoint 11**: `cloud.js` works against the fake AWS, including reconnecting.

---

## Phase 12 — The shared board in the app [v3]

- [x] **T074** **Opening a board** (Story 16.1–16.2, 16.4, 16.7, 19.4; plan §5.19)
  - Read `#board=` from the address, use the last board, or create a new one.
  - Load the board and its notes, page by page, and open the live connection.
  - Show "This board doesn't exist or has been deleted." with **Start a new board**.
  - Show "Can't reach the shared board…" with **Try again**.
- [x] **T075** **Every action goes to AWS** (Stories 2, 4, 5, 6, 8, 11, 13, 14, 15; plan §5.20)
  - Adding, editing, deleting, reacting, voting, dragging, Sort by votes, Clear board and area changes each send their change.
  - Each is applied through `applyChange` once AWS confirms it.
  - Refusals show their message, and an edit that's refused restores the old text.
- [x] **T076** **Live redraw** (Story 17; plan §5.16)
  - Others' changes redraw the board without touching zoom, a note being typed or edited, or keyboard focus.
  - A note being dragged ignores others' moves until it's dropped.
  - The board reloads after every reconnect.
- [x] **T077** **Who sees which buttons** (Stories 6, 8, 15, 18; plan §5.17)
  - Edit and Delete only on my notes.
  - Clear board, Add area and area Edit/Delete only for the facilitator, on the whiteboard and in phone mode.
- [x] **T078** **Clear board and deleted areas** (Story 8, 15.5; plan §5.20)
  - The screen updates through the new generation.
  - The facilitator's browser removes old notes in the background, in batches of 24.
  - A note typed during a Clear is still added, retrying once with the new generation.
- [x] **T079** **Top bar** (Story 16.3, 16.5; plan §5.19, §6)
  - **🔗 Copy link**, with "Link copied", and a fallback box if the clipboard is blocked.
  - **New board**, with its confirmation.
  - Remember the last board.
- [x] **T080** **Connection banner** (Story 19; plan §5.18, §6)
  - "Connection lost. Reconnecting…", announced to screen readers.
  - Every changing button is disabled and dragging is off.
  - Typed text is kept, and everything comes back once the connection does.
- [x] **T081** **Moving the old board** (Story 20; plan §5.19)
  - The first board created in a browser that has a saved v1 or v2 board starts with its areas, votes and notes.
  - The notes keep their text, positions, reactions and age, and are owned by this browser.
  - The move happens only once.
- [x] **T082** **Zoom per person** (Story 7.2): zoom and position are saved per board in this browser, and never sent to AWS.
- [x] **T083** Remove the old local saving of the board, and update the "can't save" notice for browser settings only (plan §5.20).

**Checkpoint 12**: the app works fully against `fake-aws.js` in two browser tabs, on the whiteboard and in phone mode.

---

## Phase 13 — Automated checks for two people [v3]

- [x] **T084** Update `tests/browser-check.js`:
  - start `fake-aws.js`, and load the app from it instead of `file://`
  - update the v1 and v2 checks where v3 changed the behaviour (saving, Clear board for the facilitator)
- [x] **T085** Add **two-tab checks** (plan §7), with tab A as the facilitator and tab B as a teammate:
  - live adds within 2 seconds
  - no Edit or Delete on someone else's note, but reactions work
  - simultaneous reactions both count
  - live moves and Sort
  - only the facilitator can Clear or change areas, and everyone sees the result
  - a missing board
  - connection lost and back, with typed text kept
  - the old board moved once
  - Copy link
  - phone mode
- [x] **T086** Confirm CI still passes: `node --test` runs the new tests, and needs no AWS.
- [x] **T087** [P] Update `README.md` and `documentation.md`: sharing a board, who can do what, the AWS pieces, the `aws/` folder, and the teardown.

**Checkpoint 13**: all unit tests and every browser check (v1, v2 and v3) pass.

---

## Phase 14 — Real AWS check and release [v3]

- [x] **T088** 👩‍💼 PO, with Claude: **manual check on the real AWS** (plan §7). Use two windows (one normal, one private) and a phone if possible, going through Stories 16–20 and the two-person parts of Stories 4, 6, 8, 11 and 15.
- [x] **T089** Fix anything found in T088, then re-run all the tests.
- [ ] **T090** 👩‍💼 PO: upload the v3 files to a new branch `shared-board` on the GitHub website, and open a PR.
  - Review it in **Files changed**.
  - Watch CI turn ✅.
  - **Squash and merge**, then watch GitHub Pages update.
- [ ] **T091** 👩‍💼 PO: open the live site in two windows and check that a card added in one appears in the other.
- [ ] **T092** 👩‍💼 PO: check AWS **Billing** and the AppSync **Monitoring** page a day later, to confirm the usage and that it costs $0.

**Checkpoint 14 (v3 done)**: the shared board is live on GitHub Pages, works for two or more people, and costs $0.

---

## Phase 15 — Teardown [v3] (later: before the AWS free plan ends, about April 2027)

- [ ] **T093** 👩‍💼 PO: on GitHub, open a PR that brings back the `v2.0` files (plan §9), and merge it once CI passes, so the live site works without AWS.
- [ ] **T094** 👩‍💼 PO: follow `aws/TEARDOWN.md`. Delete the AppSync API, the DynamoDB table, the data source's IAM role, and any `/aws/appsync/` log groups.
- [ ] **T095** 👩‍💼 PO: check that Billing shows no running services and $0 in Cost Explorer, then delete the budget if you like.

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
| 15 Change areas | T024, T041, T043, T066, T077, T078 |
| **[v3]** 4, 5, 6, 7, 8, 11, 13, 14 as shared | T056, T064–T068, T075–T078, T082, T085 |
| **[v3]** 16 Start and share a board | T074, T079, T085, T088 |
| **[v3]** 17 See changes live | T064, T065, T072, T076, T085, T088 |
| **[v3]** 18 Only change my own notes | T055, T056, T061, T066, T077, T085 |
| **[v3]** 19 Lose and regain the connection | T072, T074, T080, T085 |
| **[v3]** 20 Keep my old board | T069, T081, T085 |
