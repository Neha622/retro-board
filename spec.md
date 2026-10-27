# Feature Specification: Sprint Retro Board

**Status**: Approved v4 — v2 feature (whiteboard canvas and Squad Health Check) approved by the Product Owner on 27 October 2026
**Created**: 26 October 2026
**Updated**: 27 October 2026
**Input (v1)**: "I need to create a retro board for my Scrum team. It should have emojis to add, and three columns: Going well, Not going well, Improvements."
**Input (v2)**: "Create the retro board theme like the Miro tool, and add a section for a health check like this [screenshot of a Squad Health Check table]. Get inspired by Miro's design; don't make an exact copy."

> This spec describes WHAT the app does and WHY. It deliberately says nothing about HOW it is built (languages, files, hosting). That belongs in the plan.
>
> **v1** (Stories 1–9) is built. **v2** changes some v1 stories (marked **[v2]**) and adds Stories 10–15.

---

## 1. Purpose

Give a Scrum team a simple, friendly board for sprint retrospectives and squad health checks.

- **Retro**: team members add short sticky notes to three columns, express how they feel with emojis, and vote on what matters most, so the team can quickly see what to discuss first.
- **Health check**: the team votes Awesome, Fine or Sad on a set of areas (such as Fun or Speed) and adds notes, so it can see how the team is doing and where to improve.

Both sit side by side on one whiteboard-style page, inspired by online whiteboard tools such as Miro, but with its own look.

## 2. Users

- **Facilitator** (usually the Scrum Master): runs the session on one shared screen, types or lets people type, arranges notes, sorts the retro when it is time to discuss, and clears the board afterwards.
- **Team member**: suggests notes, adds emojis, reacts and votes, all on the facilitator's shared screen.

The board runs on **one shared screen** controlled by the Scrum Master. There are no logins, and team members do not use their own devices. Everyone on the shared screen can do everything, including clearing the board.

"Works on a phone" means only that the layout still works on a small screen. It does not mean that people use their own phones to join the board.

## 3. Words used in this spec

- **Whiteboard (canvas)**: the whole working area of the page, which can be panned and zoomed. Laptop-sized screens and larger only.
- **Frame**: a titled area on the whiteboard. There are two: **Retro** and **Squad Health Check**.
- **Card**: a sticky note in a retro column.
- **Health note**: a sticky note in a health check area's Notes & Comments cell.
- **Note**: either a card or a health note.
- **Area**: one row of the health check, such as "Fun".

---

## 4. User stories and acceptance criteria

### Story 1 — See the board (Priority: P1) [v2]
As a team member, I want to see the retro and the health check clearly laid out so I know where my feedback goes.

**Acceptance criteria**
1. **Given** I open the app on a laptop-sized screen, **when** the page loads, **then** I see a whiteboard with two frames side by side: **Retro** on the left and **Squad Health Check** on the right.
2. **Given** the Retro frame, **then** it has three columns titled **Going well**, **Not going well** and **Improvements**, in that order from left to right.
3. **Given** each column, **then** it has its own heading emoji so it is easy to recognise at a glance: Going well 😊, Not going well 😟, Improvements 💡.
4. **Given** a column has no cards, **then** it shows a short hint: "No cards yet — add one!".

### Story 2 — Add a card (Priority: P1) [v2]
As a team member, I want to add a short card to any column so I can share my feedback.

**Acceptance criteria**
1. **Given** any column, **when** I type text in the add box at the top of the column and press **Add** or the **Enter** key, **then** a new card with that text appears in the **next free space** in that column, never on top of another note.
2. **Given** I am typing, **when** I press **Shift+Enter**, **then** a new line starts in the same card instead of the card being added.
3. **Given** I try to add an empty card (blank, or only spaces and new lines), **then** nothing is added and I see the message "Type something first 🙂".
4. **Given** I have typed 200 characters, **then** I cannot type further. While typing, I can always see how many characters remain.
5. **Given** I paste text that would take the card over 200 characters, **then** the text is cut to 200 characters and I see the message "Shortened to 200 characters".
6. **Given** a card's text, **then** each emoji counts as **1 character**, however it is stored, including emojis with skin tones and flags.
7. **Given** I have added a card, **then** the text box clears, ready for the next card.
8. **Given** a card, **then** it looks like a sticky note in its column's colour: soft green for Going well, soft pink for Not going well and soft yellow for Improvements.

### Story 3 — Add emojis to a note's text (Priority: P1)
As a team member, I want to add emojis while writing a note so I can express tone quickly.

**Acceptance criteria**
1. **Given** I am writing a note (adding or editing), **when** I click the **emoji button** next to the text box, **then** a small emoji picker opens.
2. **Given** the picker is open, **when** I choose an emoji, **then** it is inserted **where the cursor is** in my text, the picker closes, and the cursor sits just after the new emoji.
3. **Given** the picker, **then** it offers at least these emojis: 😊 😀 🎉 👍 ❤️ 🚀 💡 🤔 😟 😡 😴 🐢 🔥 ✅ ⚠️ 🙏
4. **Given** I use only a keyboard, **then** I can open the picker, move between emojis and pick one (Tab or arrow keys to move, Enter to pick).
5. **Given** the picker is open, **when** I press **Escape** or click anywhere outside it, **then** it closes without inserting anything.
6. **Given** the picker closes for any reason, **then** the cursor returns to the text box.
7. **Given** inserting an emoji would take the note over 200 characters, **then** nothing is inserted and I see the message "No room for that emoji — 200 characters max".
8. **Given** I prefer my device's own emoji keyboard, **then** I can type emojis with it and they display correctly.

### Story 4 — React to a note with emojis (Priority: P1) [v2]
As a team member, I want to react to notes with emojis so I can show agreement or feelings without writing a new note.

**Acceptance criteria**
1. **Given** any note (card or health note), **then** it shows a row of reaction buttons: 👍 ❤️ 😂 🎉 😮.
2. **Given** a reaction button, **when** I click it, **then** its count goes up by 1 and the new count is shown next to the emoji.
3. **Given** clicking the same reaction again, **then** it adds another +1. Because there is one shared screen, the app does not need to stop people voting twice.
4. **Given** a reaction has a count of 0, **then** it is shown faded so the note stays tidy.
5. **Given** a reaction has a count above 0, **then** a small **−** button appears next to its count. Clicking it lowers the count by 1.
6. **Given** a count goes back to 0, **then** its **−** button disappears. A count can never go below 0.
7. **Given** reactions change, **then** the notes do **not** move.

### Story 5 — Sort by votes (Priority: P2) [v2]
As a facilitator, I want to put the most-supported cards first when we are ready to discuss.

**Acceptance criteria**
1. **Given** cards on the board, **then** they stay where they were placed until someone moves them or sorts.
2. **Given** I click **Sort by votes**, **then** the cards in **every retro column** are lined up in neat rows, ordered by **👍 count**, highest first (reading left to right, then top to bottom).
3. **Given** two cards with the same 👍 count, **then** the older card comes first.
4. **Given** the board has been sorted, **when** reactions change or cards are added or moved, **then** nothing re-orders on its own. New cards go into the next free space. Clicking **Sort by votes** again re-sorts.
5. **Given** Sort by votes, **then** it only affects the retro columns. Health notes are not moved.

### Story 6 — Edit and delete a note (Priority: P2) [v2]
As a team member, I want to fix or remove a note added by mistake.

**Acceptance criteria**
1. **Given** a note, **when** I click **Edit**, **then** I can change its text (including emojis) and save it with **Save** or **Enter**; reactions and its place on the board are kept.
2. **Given** I am editing, **then** the same rules as adding a card apply: Shift+Enter for a new line, the 200-character limit, the paste rule and the emoji picker.
3. **Given** I am editing, **when** I press **Escape** or click **Cancel**, **then** the note goes back to its text before editing.
4. **Given** I clear all the text while editing, **then** saving is not allowed and I see the message "A card can't be empty" (or "A note can't be empty" for a health note).
5. **Given** I save an edit, **then** the note keeps its original age, so its place in the sort order does not change.
6. **Given** something is being edited (a note or an area, see Story 15), **when** I click **Edit** on another note or area, **then** the first one is saved automatically and the second one opens for editing. Only one thing is ever in edit mode.
7. **Given** the first one can't be saved because it is empty, **then** it goes back to its text before editing instead, and the second one opens for editing.
8. **Given** a note, **when** I click **Delete**, **then** I am asked "Delete this card?" (or "Delete this note?" for a health note), and the note is removed only if I confirm.

### Story 7 — Keep the board after a refresh (Priority: P1) [v2]
As a facilitator, I want everything to stay if the page is refreshed or the browser is closed by accident.

**Acceptance criteria**
1. **Given** a board with notes, reactions, votes and areas, **when** I refresh the page or close and reopen the same browser on the same device, **then** everything is still there: all notes and their text, emojis, reaction counts and positions; all health votes; the area list with its names and examples; and the zoom level and position of the whiteboard.
2. **Given** the browser cannot save the board, **then** the board still works and a visible notice says "This board can't be saved in this browser — cards will be lost on refresh".
3. **Given** a board saved by v1 of the app, **when** v2 opens it, **then** it is upgraded automatically: every card is kept, laid out in neat rows in its column, and the health check starts with the 11 standard areas.

### Story 8 — Clear the board (Priority: P2) [v2]
As a facilitator, I want to clear the board after the session so the next sprint starts fresh.

**Acceptance criteria**
1. **Given** a board with notes or votes, **when** anyone clicks **Clear board**, **then** they are asked "Delete all notes and votes? This can't be undone."
2. **Given** they confirm, **then** all cards, all health notes and all health votes are removed. The area list and its names and examples are **kept**.
3. **Given** they cancel, **then** nothing changes.
4. **Given** there are no notes and every vote is 0, **then** the **Clear board** button is disabled.

### Story 9 — Use it on any screen (Priority: P2) [v2]
As a facilitator, I want the board to work on a large screen and still be usable on a small one.

**Acceptance criteria**
1. **Given** a laptop-sized screen or larger, **then** the page shows the whiteboard (Stories 10–11).
2. **Given** a phone-sized screen, **then** there is no whiteboard. The page shows a simple layout instead:
   - the three retro columns stacked, each with its cards in a tidy list, in reading order of their place on the whiteboard (top to bottom, then left to right)
   - then the health check, with each area shown as its own block: name, examples, the three vote buttons, and its health notes in a tidy list
   - notes can't be dragged on a phone; everything else works
   - all buttons are easy to tap
3. **Given** I use only a keyboard, **then** I can do everything except move notes and pan the whiteboard (see 9.5): add, edit, delete, react, vote, sort, clear, zoom, use the emoji picker, and add, edit and delete areas (Tab to move, Enter to activate, Escape to cancel).
4. **Given** any text on the board, **then** it is easy to read against its background (meets WCAG AA contrast), including text on sticky notes.
5. **Given** moving notes, **then** it is done with a mouse only in v2. Keyboard moving is planned for later (see §8). When something on the whiteboard gets keyboard focus and is out of view, the whiteboard pans to show it.

### Story 10 — Whiteboard canvas (Priority: P1) [new in v2]
As a facilitator, I want a whiteboard I can move around and zoom, so the retro and the health check both fit on one page.

**Acceptance criteria**
1. **Given** the whiteboard, **then** it has a light dotted-grid background, and each frame has its title above it.
2. **Given** I drag on an empty part of the whiteboard, or scroll with a mouse wheel or trackpad, **then** the whiteboard pans.
3. **Given** I hold **Ctrl** (or **Cmd** on a Mac) and scroll, or pinch on a trackpad, **then** the whiteboard zooms in or out around the pointer.
4. **Given** the zoom controls in a corner of the page, **then** **+** zooms in, **−** zooms out and **Fit** zooms and pans so that both frames are fully in view. The controls show the current zoom, for example "100%".
5. **Given** zooming, **then** the zoom stays between **25%** and **200%**.
6. **Given** the look of the page, **then** it is inspired by online whiteboard tools: sticky notes with soft shadows and floating toolbars. It must **not** use Miro's name, logo or exact colours.

### Story 11 — Move notes on the whiteboard (Priority: P1) [new in v2]
As a facilitator, I want to drag notes around, like on a real whiteboard, to group related ideas.

**Acceptance criteria**
1. **Given** a card, **when** I drag it with the mouse, **then** I can drop it anywhere inside any of the three retro columns. Dropping it in another column moves it to that column (and changes its colour to match).
2. **Given** a health note, **when** I drag it, **then** I can drop it anywhere inside any area's Notes & Comments cell. Dropping it in another area's cell moves it to that area.
3. **Given** I drop a note anywhere else (outside the columns or Notes cells, or a card on a Notes cell, or a health note on a retro column), **then** it slides back to where it was.
4. **Given** notes, **then** they may overlap. The note I drag or edit comes to the front.
5. **Given** I place a note near the bottom of a column or Notes cell, **then** the column or cell grows taller so there is always room.
6. **Given** notes, **then** they are all the same width, and each note's height grows to fit its text.
7. **Given** I start dragging on a button or text box inside a note, **then** the note does not move; the button or text box works as normal.

### Story 12 — See the health check (Priority: P1) [new in v2]
As a team member, I want to see the health check areas with examples so I know what each vote means.

**Acceptance criteria**
1. **Given** the Squad Health Check frame, **then** it shows a table with these columns, in order: **Area**, **Example of Awesome**, **🟢 Awesome**, **🟡 Fine**, **🔴 Sad**, **Example of Crappy**, **Notes & Comments**.
2. **Given** a new board, **then** the table has 11 areas, in this order: Delivering value, Easy to release, Fun, Health of codebase, Learning, Mission, Pawns or players, Speed, Suitable process, Support, Teamwork. Each has starter example texts (appendix A).

### Story 13 — Vote in the health check (Priority: P1) [new in v2]
As a team member, I want to vote Awesome, Fine or Sad for each area so the team can see how we feel.

**Acceptance criteria**
1. **Given** each area, **then** each of its 🟢 Awesome, 🟡 Fine and 🔴 Sad cells shows a vote count and a **+1** button.
2. **Given** I click **+1**, **then** that count goes up by 1. Clicking again adds another vote.
3. **Given** a count above 0, **then** a **−** button appears, which lowers it by 1. A count can never go below 0, and **−** disappears at 0.
4. **Given** a cell with 0 votes, **then** it is shown faded, like a reaction at 0.

### Story 14 — Add notes to a health check area (Priority: P1) [new in v2]
As a team member, I want to add comments to an area so we remember why we voted the way we did.

**Acceptance criteria**
1. **Given** an area's Notes & Comments cell, **when** I click **+ Add note**, **then** an add box opens with the same rules as adding a card (Story 2.2–2.7 and Story 3).
2. **Given** I add the note, **then** it appears in the next free space in that cell.
3. **Given** a health note, **then** it is a light-blue sticky note with the five reactions (Story 4), and can be edited, deleted (Story 6) and dragged (Story 11).
4. **Given** the add box is open, **when** I press **Escape** or click **Cancel**, **then** it closes without adding anything.

### Story 15 — Change the health check areas (Priority: P2) [new in v2]
As a facilitator, I want to adjust the areas so the health check fits my team.

**Acceptance criteria**
1. **Given** an area, **when** I click its **Edit** button, **then** its name and both example texts become text boxes, with **Save** and **Cancel**.
2. **Given** I edit an area, **then** the name must be 1–40 characters and each example up to 200 characters (each emoji counts as 1). Saving an empty name is not allowed and I see the message "An area needs a name". Examples may be empty.
3. **Given** I am editing an area, **when** I press **Escape** or click **Cancel**, **then** the area goes back to how it was. Enter saves; Shift+Enter starts a new line in an example.
4. **Given** I click **Add area** below the table, **then** a new area appears at the bottom, named "New area" with empty examples, opened for editing with the cursor in the name.
5. **Given** an area, **when** I click its **Delete** button, **then** I am asked "Delete this area, its votes and notes?", and the area is removed only if I confirm.
6. **Given** editing an area, **then** the one-edit-at-a-time rule from Story 6.6–6.7 applies (an empty name counts as "can't be saved").

---

## 5. Functional requirements

**Retro (v1, updated for v2)**
- **FR-001** The Retro frame MUST show three columns: Going well, Not going well, Improvements.
- **FR-002** Users MUST be able to add a card of 1–200 characters to any column, where each emoji counts as 1 character. Enter adds the card; Shift+Enter adds a new line. New cards go into the next free space.
- **FR-003** Pasted text that goes over 200 characters MUST be cut to 200 characters, with a short message.
- **FR-004** Users MUST be able to insert emojis at the cursor using an emoji picker that works with a keyboard and closes with Escape or a click outside it.
- **FR-005** Every note MUST offer emoji reactions (👍 ❤️ 😂 🎉 😮) with visible counts, and a − button to lower any count above 0.
- **FR-006** Cards MUST NOT re-order on their own. A **Sort by votes** button MUST line up every retro column in rows by 👍 count, highest first, then oldest first.
- **FR-007** Users MUST be able to edit notes and areas (one at a time, cancel with Escape or Cancel, age unchanged) and delete them after confirming. Starting to edit something else MUST save the current edit automatically, or undo it if it can't be saved.
- **FR-008** The board MUST keep everything (notes, positions, reactions, votes, areas, zoom and position) after a page refresh in the same browser on the same device, and MUST upgrade boards saved by v1.
- **FR-009** Anyone MUST be able to clear all notes and votes, only after confirming. Areas are kept.
- **FR-010** The board MUST work on phone and laptop screen sizes. Everything except moving notes and panning MUST be usable with a keyboard.

**Whiteboard and health check (new in v2)**
- **FR-011** On laptop-sized screens and larger, the page MUST be a whiteboard that pans (drag empty space, scroll) and zooms (Ctrl/Cmd + scroll, pinch, + / − / Fit buttons) between 25% and 200%.
- **FR-012** Notes MUST be movable with the mouse to any place inside a cell of their own kind (cards in retro columns, health notes in Notes cells). Drops anywhere else MUST be undone.
- **FR-013** Columns and Notes cells MUST grow to fit the notes placed in them.
- **FR-014** The Squad Health Check MUST show a table of areas with example texts, Awesome / Fine / Sad vote counts, and a Notes & Comments cell.
- **FR-015** Users MUST be able to vote +1 and −1 on each area's Awesome, Fine and Sad counts (never below 0).
- **FR-016** Users MUST be able to add, edit, delete, react to and move health notes, with the same rules as cards.
- **FR-017** Users MUST be able to add, edit and delete areas.
- **FR-018** On phone-sized screens, the page MUST show a simple stacked layout with no whiteboard and no dragging.

## 6. Key data (what the app remembers)

- **Card**: which column it belongs to, its text (including emojis and line breaks), when it was created, its place in the column, which notes are in front of which, and a count for each reaction emoji.
- **Health note**: which area it belongs to, its text, when it was created, its place in the Notes cell, which notes are in front of which, and a count for each reaction emoji.
- **Area**: its name, its Example of Awesome and Example of Crappy texts, its Awesome, Fine and Sad vote counts, and its place in the list.
- **View**: the whiteboard's zoom level and position.
- **Board**: all of the above. There is one board only.

## 7. Success criteria

- A new user can add their first card with an emoji in **under 30 seconds** without instructions.
- A 6-person team can run a full retro and health check without the board slowing down noticeably, with up to **100 cards** and **50 health notes** on the board, including while dragging and zooming.
- After a refresh, **100%** of notes, positions, reaction counts, votes and areas are still present.

## 8. Out of scope

- Logins, user accounts or names on notes.
- Sharing one live board across several people's devices.
- Limiting votes per person.
- Several boards, or a history of past retros or health checks.
- Anonymous mode, timers, action owners and due dates.
- Exporting to PDF or CSV.
- Custom retro column names.
- **Moving notes with the keyboard** (planned for a later version).
- **Panning the whiteboard with the keyboard**, other than the automatic pan to whatever has focus.
- **Dragging notes on phones**, and a whiteboard on phones.
- Choosing a colour for each note.
- Health check trend arrows (better / same / worse than last time).
- Resizing frames or notes by hand.

## 9. Defaults confirmed by the Product Owner

Claude suggested these as the simplest options, and the Product Owner confirmed all of them. Each is already written into the stories above.

**v1** (26 October 2026)
1. **Clear board when empty**: the button is disabled.
2. **Saving fails**: the board still works, with a visible notice that changes won't survive a refresh.
3. **Number of boards**: one board only. Clearing it is how a new sprint starts.
4. **Number of cards**: no hard limit; the board must stay fast with up to 100 cards.
5. **Votes**: the 👍 reaction is the vote used by **Sort by votes**. There is no separate "+1 vote" button for cards.
6. **Reaction set**: 👍 ❤️ 😂 🎉 😮.
7. **Column order**: Going well → Not going well → Improvements.
8. **Messages**: the wording used in the stories.

**v2** (27 October 2026)
1. **Zoom and pan**: + / − / Fit buttons in a corner; Ctrl/Cmd + scroll or pinch to zoom; drag empty space or scroll to pan; 25%–200%; zoom and position remembered.
2. **Overlapping**: allowed; the note being dragged or edited comes to the front.
3. **Drop rules**: notes can only be dropped inside a cell of their own kind; otherwise they slide back.
4. **Growing space**: columns and Notes cells grow taller to fit.
5. **Note size**: same width for all notes; height grows with the text.
6. **New cards**: added from the box at the top of each column, into the next free space.
7. **New health notes**: from a **+ Add note** button in each Notes cell.
8. **Sort by votes**: retro columns only, lined up in rows.
9. **Health check headings**: Area · Example of Awesome · 🟢 Awesome · 🟡 Fine · 🔴 Sad · Example of Crappy · Notes & Comments.
10. **Add area**: appears at the bottom as "New area", opened for editing.
11. **Delete area**: asks "Delete this area, its votes and notes?".
12. **Area limits**: name 1–40 characters, examples up to 200; the name can't be empty.
13. **Starter examples**: our own wording, in the spirit of the well-known Squad Health Check model (appendix A).
14. **Health note colour**: light blue.
15. **Clear board**: removes all notes and votes, keeps the areas.
16. **Upgrade**: boards saved by v1 upgrade automatically, with cards laid out in rows.
17. **Look**: dotted grid, titled frames, soft shadows, floating toolbars; inspired by Miro, not a copy.

## 10. Decisions log

**v1** — answers from the Product Owner, 26 October 2026:

| # | Question | Decision |
|---|----------|----------|
| 1 | One shared screen, or each person on their own device? | One shared screen run by the Scrum Master. "Works on a phone" means only that the layout works on small screens. Sharing across devices is a later version. |
| 2 | Stopping repeat votes, and undoing a reaction | Repeat votes aren't a concern on a shared screen. Add a small − next to each count above 0 to undo. |
| 3 | Automatic re-sorting | No automatic re-sorting. The facilitator clicks a **Sort by votes** button when ready to discuss. |
| 4 | Counting characters and long pastes | An emoji counts as 1 character. Pasted text that is too long is cut to 200 with a short message. 200 characters is enough. |
| 5 | Line breaks | Shift+Enter adds a new line; Enter adds the card. |
| 6 | Where a picked emoji goes | At the cursor. |
| 7 | Emoji picker | Must work with the keyboard; closes with Escape or a click outside it. |
| 8 | Editing | Escape or Cancel cancels. Editing doesn't change a card's age. Only one card can be edited at a time. |
| 9 | Who can clear the board | Anyone, after confirming. |
| 10 | Clicking Edit on card B while card A is being edited | Card A's changes save automatically and card B opens. If card A's text is empty, card A goes back to its old text instead. |

**v2** — answers from the Product Owner, 27 October 2026:

| # | Question | Decision |
|---|----------|----------|
| 11 | Whiteboard look only, or a free canvas? | A free canvas: notes move freely, like in Miro. The screenshot is only to give an idea. |
| 12 | One page or two tabs? | One page. The health check sits next to the retro board. |
| 13 | What the three health check columns mean | 🟢 green = Awesome, 🟡 amber = Fine, 🔴 red = Sad. |
| 14 | Notes & Comments | Sticky notes per area, with the same rules as cards. |
| 15 | Example texts | Editable. |
| 16 | What Clear board clears | Both the retro and the health check. |
| 17 | Phones | Each area becomes its own stacked block. |
| 18 | Order of work | Finish v1's Phase 4 first, then start v2. |
| 19 | Design | Inspired by Miro; not an exact copy. |
| 20 | What happens to the retro columns on the canvas | The three columns stay; notes can be placed anywhere inside them and dragged between them. Sort by votes tidies each column. The health check frame sits next to the retro frame. |
| 21 | Sticky-note colours | One colour per column. |
| 22 | Health check areas | Start with the standard areas; the team can add, edit and delete areas. |
| 23 | How health votes work | Vote counts with +1 and −, like reactions. |
| 24 | Health notes | Like cards: placed freely in their cell, draggable between areas, with reactions. |
| 25 | Moving notes without a mouse | Mouse only for now. |
| 26 | Phones and the canvas | No canvas on phones; everything stacks in simple lists. |
| 27 | Fit shows the whole board at about 38% on a laptop: keep it, or open on the Retro frame only? | Keep it: the first open and **Fit** both show the whole board. Zoom in with + or Ctrl/Cmd + scroll. (28 October 2026) |

---

## Appendix A — Starter health check areas

| Area | Example of Awesome | Example of Crappy |
|---|---|---|
| Delivering value | What we ship really helps our users, and our stakeholders are happy with it. | What we ship doesn't help anyone, and our stakeholders are frustrated with us. |
| Easy to release | Releasing is simple, safe and mostly automatic. | Releasing is risky and painful, with lots of manual steps, and it takes ages. |
| Fun | We love coming to work and have a great time working together. | Work feels like a chore, and we dread it. |
| Health of codebase | Our code is clean, easy to read and well tested. | Our code is a mess, and technical debt is getting out of hand. |
| Learning | We learn something new all the time. | We never get time to learn anything. |
| Mission | We know exactly why we're here, and we're excited about it. | We don't know why we're here, and the goal is unclear and uninspiring. |
| Pawns or players | We decide what to build and how to build it. | We're just told what to do, with no say in it. |
| Speed | We get things done quickly, with no waiting and no delays. | We never seem to finish anything; we keep getting stuck or interrupted. |
| Suitable process | Our way of working fits us perfectly. | Our way of working gets in the way. |
| Support | We always get great help when we ask for it. | We keep getting stuck because nobody helps us. |
| Teamwork | We're a close team that helps each other out. | We're a group of individuals who don't really work together. |
