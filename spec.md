# Feature Specification: Sprint Retro Board

**Status**: Approved v5 — v3 feature (shared live board) approved by the Product Owner on 29 October 2026
**Created**: 26 October 2026
**Updated**: 29 October 2026
**Input (v1)**: "I need to create a retro board for my Scrum team. It should have emojis to add, and three columns: Going well, Not going well, Improvements."
**Input (v2)**: "Create the retro board theme like the Miro tool, and add a section for a health check like this [screenshot of a Squad Health Check table]. Get inspired by Miro's design; don't make an exact copy."
**Input (v3)**: "The board can be edited simultaneously, and cards added by team members can be seen by everyone. People should only be able to edit the cards they create; they can click emojis to react to other team members' cards, but they can't edit or change cards created by other people."

> This spec describes WHAT the app does and WHY. It deliberately says nothing about HOW it is built (languages, files, hosting). That belongs in the plan.
>
> **v1** (Stories 1–9) and **v2** (Stories 10–15) are built. **v3** changes some earlier stories (marked **[v3]**) and adds Stories 16–20.

---

## 1. Purpose

Give a Scrum team a simple, friendly board for sprint retrospectives and squad health checks.

- **Retro**: team members add short sticky notes to three columns, express how they feel with emojis, and vote on what matters most, so the team can quickly see what to discuss first.
- **Health check**: the team votes Awesome, Fine or Sad on a set of areas (such as Fun or Speed) and adds notes, so it can see how the team is doing and where to improve.

Both sit side by side on one whiteboard-style page, inspired by online whiteboard tools such as Miro, but with its own look.

**[v3]** The board is **shared and live**: everyone on the team opens the same board on their own device, and sees what the others add within a second or two.

## 2. Users [v3]

- **Facilitator** (usually the Scrum Master): starts the board and shares its link, arranges notes, sorts the retro when it is time to discuss, and clears the board afterwards. Only the facilitator can clear the board and change the health check areas.
- **Team member**: opens the board link on their own device, adds their own notes, edits or deletes only their own notes, reacts to anyone's notes, and votes in the health check.

There are no logins. Whoever has a board's link can open it and add to it. Notes are **anonymous**: nobody sees who wrote which note, although each person can tell which notes are their own. The app recognises each person by the browser they use, so the same person on another device or browser counts as someone new.

The board works on laptops and phones, and people may join from either.

## 3. Words used in this spec

- **Whiteboard (canvas)**: the whole working area of the page, which can be panned and zoomed. Laptop-sized screens and larger only.
- **Frame**: a titled area on the whiteboard. There are two: **Retro** and **Squad Health Check**.
- **Card**: a sticky note in a retro column.
- **Health note**: a sticky note in a health check area's Notes & Comments cell.
- **Note**: either a card or a health note.
- **Area**: one row of the health check, such as "Fun".
- **Board link** [v3]: the web address of one shared board. It contains a long random code, so only people who are given the link can find the board.
- **My note** [v3]: a note added from my browser. Only I can edit or delete it.
- **Facilitator** [v3]: the person whose browser started the board.

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
3. **Given** clicking the same reaction again, **then** it adds another +1. The app does not stop people reacting more than once. **[v3]** Anyone can react to any note, including other people's notes.
4. **Given** a reaction has a count of 0, **then** it is shown faded so the note stays tidy.
5. **Given** a reaction has a count above 0, **then** a small **−** button appears next to its count. Clicking it lowers the count by 1.
6. **Given** a count goes back to 0, **then** its **−** button disappears. A count can never go below 0.
7. **Given** reactions change, **then** the notes do **not** move.
8. **[v3]** **Given** two people click a reaction at the same moment, **then** both clicks count.

### Story 5 — Sort by votes (Priority: P2) [v2]
As a facilitator, I want to put the most-supported cards first when we are ready to discuss.

**Acceptance criteria**
1. **Given** cards on the board, **then** they stay where they were placed until someone moves them or sorts.
2. **Given** I click **Sort by votes**, **then** the cards in **every retro column** are lined up in neat rows, ordered by **👍 count**, highest first (reading left to right, then top to bottom).
3. **Given** two cards with the same 👍 count, **then** the older card comes first.
4. **Given** the board has been sorted, **when** reactions change or cards are added or moved, **then** nothing re-orders on its own. New cards go into the next free space. Clicking **Sort by votes** again re-sorts.
5. **Given** Sort by votes, **then** it only affects the retro columns. Health notes are not moved.
6. **[v3]** **Given** anyone clicks **Sort by votes**, **then** the cards are rearranged on **everyone's** screen.

### Story 6 — Edit and delete a note (Priority: P2) [v3]
As a team member, I want to fix or remove a note I added by mistake.

**Acceptance criteria**
0. **[v3]** **Given** a note, **then** **Edit** and **Delete** appear only on **my notes**. Other people's notes show only their reactions.
1. **Given** one of my notes, **when** I click **Edit**, **then** I can change its text (including emojis) and save it with **Save** or **Enter**; reactions and its place on the board are kept.
2. **Given** I am editing, **then** the same rules as adding a card apply: Shift+Enter for a new line, the 200-character limit, the paste rule and the emoji picker.
3. **Given** I am editing, **when** I press **Escape** or click **Cancel**, **then** the note goes back to its text before editing.
4. **Given** I clear all the text while editing, **then** saving is not allowed and I see the message "A card can't be empty" (or "A note can't be empty" for a health note).
5. **Given** I save an edit, **then** the note keeps its original age, so its place in the sort order does not change.
6. **Given** something is being edited (a note or an area, see Story 15), **when** I click **Edit** on another note or area, **then** the first one is saved automatically and the second one opens for editing. Only one thing is ever in edit mode **on my screen**. **[v3]** Other people can be editing their own notes at the same time.
7. **Given** the first one can't be saved because it is empty, **then** it goes back to its text before editing instead, and the second one opens for editing.
8. **Given** one of my notes, **when** I click **Delete**, **then** I am asked "Delete this card?" (or "Delete this note?" for a health note), and the note is removed only if I confirm.
9. **[v3]** **Given** someone tries to change or delete a note that isn't theirs by getting round the app, **then** the change is refused and the note stays as it was.

### Story 7 — Keep the board (Priority: P1) [v3]
As a facilitator, I want everything to stay if the page is refreshed or the browser is closed by accident.

**Acceptance criteria**
1. **Given** a shared board with notes, reactions, votes and areas, **when** anyone refreshes the page or opens the board link again, on any device, **then** everything is still there: all notes and their text, emojis, reaction counts and positions; all health votes; and the area list with its names and examples.
2. **Given** my zoom level and position on the whiteboard, **then** they are remembered **in my browser only**; they aren't shared.
3. **Given** the shared board can't be reached, **then** see Story 19.
4. **Given** a board saved by v1 of the app in this browser, **then** it is still upgraded automatically, as in v2, before it is moved to a shared board (Story 20).
5. **Given** a board that nobody has changed for **90 days**, **then** it is deleted automatically, and its link shows the message in Story 16.7.

### Story 8 — Clear the board (Priority: P2) [v3]
As a facilitator, I want to clear the board after the session so the next sprint starts fresh.

**Acceptance criteria**
1. **Given** a board with notes or votes, **when** the **facilitator** clicks **Clear board**, **then** they are asked "Delete all notes and votes? This can't be undone."
2. **Given** they confirm, **then** all cards, all health notes and all health votes are removed **for everyone**. The area list and its names and examples are **kept**, and the board keeps the same link.
3. **Given** they cancel, **then** nothing changes.
4. **Given** there are no notes and every vote is 0, **then** the **Clear board** button is disabled.
5. **[v3]** **Given** I am not the facilitator, **then** I don't see the **Clear board** button.
6. **[v3]** **Given** I am typing a new note when the board is cleared, **then** what I typed stays in the box, and I can still add it.

### Story 9 — Use it on any screen (Priority: P2) [v2]
As a facilitator, I want the board to work on a large screen and still be usable on a small one.

**Acceptance criteria**
1. **Given** a laptop-sized screen or larger, **then** the page shows the whiteboard (Stories 10–11).
2. **Given** a phone-sized screen, **then** there is no whiteboard. The page shows a simple layout instead:
   - the three retro columns stacked, each with its cards in a tidy list, in reading order of their place on the whiteboard (top to bottom, then left to right)
   - then the health check, with each area shown as its own block: name, examples, the three vote buttons, and its health notes in a tidy list
   - notes can't be dragged on a phone; everything else works, including **Copy link** and the rules about whose notes can be changed **[v3]**
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
8. **[v3]** **Given** anyone's note, including other people's, **then** I can drag it to a new place. Moving a note never changes its text.
9. **[v3]** **Given** someone else drags a note, **then** on my screen it jumps to its new place when they drop it. If two people drop the same note, the last drop wins.

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
3. **Given** a health note, **then** it is a light-blue sticky note with the five reactions (Story 4), and can be edited and deleted by the person who added it (Story 6), and dragged by anyone (Story 11).
4. **Given** the add box is open, **when** I press **Escape** or click **Cancel**, **then** it closes without adding anything.

### Story 15 — Change the health check areas (Priority: P2) [v3]
As a facilitator, I want to adjust the areas so the health check fits my team.

**Acceptance criteria**
0. **[v3]** **Given** I am not the facilitator, **then** I don't see the areas' **Edit** and **Delete** buttons, or **Add area**. Everyone can still vote and add health notes.
1. **Given** an area, **when** I click its **Edit** button, **then** its name and both example texts become text boxes, with **Save** and **Cancel**.
2. **Given** I edit an area, **then** the name must be 1–40 characters and each example up to 200 characters (each emoji counts as 1). Saving an empty name is not allowed and I see the message "An area needs a name". Examples may be empty.
3. **Given** I am editing an area, **when** I press **Escape** or click **Cancel**, **then** the area goes back to how it was. Enter saves; Shift+Enter starts a new line in an example.
4. **Given** I click **Add area** below the table, **then** a new area appears at the bottom, named "New area" with empty examples, opened for editing with the cursor in the name.
5. **Given** an area, **when** I click its **Delete** button, **then** I am asked "Delete this area, its votes and notes?", and the area is removed only if I confirm.
6. **Given** editing an area, **then** the one-edit-at-a-time rule from Story 6.6–6.7 applies (an empty name counts as "can't be saved").

### Story 16 — Start and share a board (Priority: P1) [new in v3]
As a facilitator, I want to start a board and share it with my team in one click.

**Acceptance criteria**
1. **Given** I open the app **without** a board link, and I have never had a board in this browser, **then** a new shared board is created, its link appears in the browser's address bar, and I am its facilitator.
2. **Given** I open the app without a board link, but I opened a board in this browser before, **then** my **last board** opens instead of a new one.
3. **Given** the top bar, **when** I click **🔗 Copy link**, **then** the board link is copied and I see "Link copied".
4. **Given** someone opens a board link, **then** they join that board and see everything on it.
5. **Given** the top bar, **when** I click **New board**, **then** I am asked "Start a new, empty board? This board stays available at its link." If I confirm, a new board opens with its own link, and I am its facilitator.
6. **Given** a new board, **then** its health check starts with the 11 standard areas (appendix A).
7. **Given** I open a link to a board that doesn't exist (mistyped, or deleted), **then** I see "This board doesn't exist or has been deleted.", with a **Start a new board** button.
8. **Given** the facilitator's browser forgets them (for example, after its data is cleared), **then** the board keeps working, but nobody can clear it or change its areas. Starting a new board is the fix.

### Story 17 — See my team's changes live (Priority: P1) [new in v3]
As a team member, I want to see what my teammates add while I'm looking at the board, so we can all follow the same retro.

**Acceptance criteria**
1. **Given** several people have the same board open, **when** anyone adds, edits, deletes, moves or sorts notes, reacts, votes, clears the board or changes areas, **then** everyone else sees the change within about **2 seconds**, without refreshing.
2. **Given** a change arrives from someone else, **then** my own zoom and position don't change, and a note I'm typing or editing isn't interrupted.
3. **Given** notes on the board, **then** none of them shows who wrote it.
4. **Given** a board, **then** it can hold up to **300 notes** (cards and health notes together). When it is full, adding a note shows "This board is full (300 notes)".

### Story 18 — Only change my own notes (Priority: P1) [new in v3]
As a team member, I want my notes to be safe from being changed by others, while still letting people react to them.

**Acceptance criteria**
1. **Given** a note I added, **then** only I can edit or delete it (Story 6).
2. **Given** a note someone else added, **then** I can react to it and drag it, but I can't change its text or delete it.
3. **Given** I open the board in a different browser or on a different device, **then** the notes I added before count as someone else's there.
4. **Given** my browser's data is cleared, **then** my notes stay on the board, but I can no longer edit or delete them.

### Story 19 — Lose and regain the connection (Priority: P1) [new in v3]
As a team member, I want to know when my changes can't reach the team, and to carry on once the connection is back.

**Acceptance criteria**
1. **Given** my connection to the shared board drops, **then** a banner says "Connection lost. Reconnecting…", and adding, editing, deleting, moving, reacting, voting, sorting and clearing are paused (shown greyed out).
2. **Given** I was typing a note when the connection dropped, **then** what I typed stays in its box.
3. **Given** the connection comes back, **then** the banner goes away, the board catches up with everything others did meanwhile, and everything works again.
4. **Given** the shared board can't be reached at all when I open the app, **then** I see "Can't reach the shared board. Check your connection and try again.", with a **Try again** button. There is no offline or local-only mode.

### Story 20 — Keep my old board (Priority: P2) [new in v3]
As a facilitator who used the app before v3, I want my existing notes to carry over to the shared board.

**Acceptance criteria**
1. **Given** this browser has a board saved by v1 or v2, **when** v3 creates the first shared board in this browser, **then** that board starts with all the saved notes, reactions, positions, votes and areas, and I am its facilitator and the owner of all those notes.
2. **Given** the move has happened, **then** it never happens again in this browser, and the old saved copy is left untouched.
3. **Given** this browser has no saved board, **then** the first shared board starts empty, with the 11 standard areas.

---

## 5. Functional requirements

**Retro (v1, updated for v2)**
- **FR-001** The Retro frame MUST show three columns: Going well, Not going well, Improvements.
- **FR-002** Users MUST be able to add a card of 1–200 characters to any column, where each emoji counts as 1 character. Enter adds the card; Shift+Enter adds a new line. New cards go into the next free space.
- **FR-003** Pasted text that goes over 200 characters MUST be cut to 200 characters, with a short message.
- **FR-004** Users MUST be able to insert emojis at the cursor using an emoji picker that works with a keyboard and closes with Escape or a click outside it.
- **FR-005** Every note MUST offer emoji reactions (👍 ❤️ 😂 🎉 😮) with visible counts, and a − button to lower any count above 0.
- **FR-006** Cards MUST NOT re-order on their own. A **Sort by votes** button MUST line up every retro column in rows by 👍 count, highest first, then oldest first.
- **FR-007** Users MUST be able to edit notes and areas (one at a time, cancel with Escape or Cancel, age unchanged) and delete them after confirming. Starting to edit something else MUST save the current edit automatically, or undo it if it can't be saved. **[v3]** Only the note's author can edit or delete a note; only the facilitator can add, edit or delete areas.
- **FR-008** **[v3]** The board MUST keep everything (notes, positions, reactions, votes, areas) in a shared store that every device with the link reads, and MUST keep each person's zoom and position in their own browser. Boards saved by v1 MUST still be upgraded.
- **FR-009** **[v3]** Only the facilitator MUST be able to clear all notes and votes, only after confirming. Areas are kept.
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

**Shared live board (new in v3)**
- **FR-019** Opening the app without a board link MUST open this browser's last board, or create a new shared board with a long random link if there is none. A **Copy link** button MUST copy the link, and a **New board** button MUST start a new board after confirming.
- **FR-020** Every change to a board MUST appear on every other open screen of that board within about 2 seconds, without refreshing. Pan and zoom MUST stay personal.
- **FR-021** Each browser MUST get its own hidden identity. Notes MUST record the identity that added them, and the shared store MUST refuse edits and deletes from any other identity.
- **FR-022** The browser that creates a board MUST be its facilitator. The shared store MUST refuse Clear board and area changes from anyone else.
- **FR-023** Reactions and votes made at the same moment by different people MUST all count. For moves, the last drop MUST win.
- **FR-024** When the connection drops, the app MUST show a banner, pause changes, keep any typed text, reconnect on its own and catch up. When the store can't be reached at all, it MUST show an error with **Try again**.
- **FR-025** The first shared board created in a browser MUST start with that browser's saved v1 or v2 board, if any, once only.
- **FR-026** A board MUST hold at most 300 notes, and MUST be deleted automatically 90 days after its last change. A link to a missing board MUST show a clear message.
- **FR-027** Notes MUST NOT show who wrote them.

## 6. Key data (what the app remembers)

- **Card**: which column it belongs to, its text (including emojis and line breaks), when it was created, its place in the column, which notes are in front of which, and a count for each reaction emoji. **[v3]** Also: the hidden identity of the browser that added it.
- **Health note**: which area it belongs to, its text, when it was created, its place in the Notes cell, which notes are in front of which, and a count for each reaction emoji. **[v3]** Also: the hidden identity of the browser that added it.
- **Area**: its name, its Example of Awesome and Example of Crappy texts, its Awesome, Fine and Sad vote counts, and its place in the list.
- **View**: the whiteboard's zoom level and position. **[v3]** Kept in each person's browser only.
- **Board** [v3]: all of the above except the view, plus its random link code, its facilitator's hidden identity and when it last changed. There can be many boards, one per link.
- **This browser** [v3]: its hidden identity, its last board's link, and whether its old saved board has been moved to a shared board.

## 7. Success criteria

- A new user can add their first card with an emoji in **under 30 seconds** without instructions.
- A 6-person team can run a full retro and health check without the board slowing down noticeably, with up to **100 cards** and **50 health notes** on the board, including while dragging and zooming.
- After a refresh, **100%** of notes, positions, reaction counts, votes and areas are still present.
- **[v3]** With **10 people** on one board, each change appears on everyone else's screen within **2 seconds**.
- **[v3]** When 10 people react to the same note at the same moment, the count goes up by exactly 10.
- **[v3]** Running the shared board for one team costs **nothing** during the build and trial period.

## 8. Out of scope

- Logins and user accounts (a sign-in may come in a later version).
- Names on notes (notes are anonymous).
- Limiting votes or reactions per person.
- A history of past retros or health checks, or a list of my boards.
- Working offline and syncing later.
- Seeing other people's notes slide while they drag them, or seeing who is online.
- Handing the facilitator role to someone else.
- Editing my notes from another device or browser.
- Timers, action owners and due dates.
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

**v3** (29 October 2026)
1. **Speed**: changes appear within about 2 seconds; other people's moves show when the note is dropped.
2. **Pan and zoom**: personal, not shared.
3. **Sort by votes**: rearranges the cards for everyone.
4. **Copy link**: a button in the top bar; shows "Link copied".
5. **New board**: a button in the top bar, with a confirmation; whoever clicks it becomes the new board's facilitator.
6. **Missing board**: "This board doesn't exist or has been deleted.", with **Start a new board**.
7. **Facilitator forgotten**: the board keeps working, but nobody can clear it or change areas; start a new board instead.
8. **Old boards**: deleted automatically 90 days after their last change.
9. **Board size**: up to 300 notes.
10. **Shared board unreachable**: an error message with **Try again**; no local-only mode.
11. **Phones**: same rules, in the existing phone layout.
12. **Cost safety**: a $1 budget alert from day one, and a teardown checklist (see the plan).
13. **Testing**: automated tests use a stand-in for the shared store, so CI needs no cloud account; a manual check with two browser windows on the real store before release.
14. **Release**: built on a branch and merged through a pull request with CI passing.

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

**v3** — answers from the Product Owner, 28–29 October 2026. Rows 28 and 29 are build choices; their details belong in the plan, but they're recorded here so the history is in one place.

| # | Question | Decision |
|---|----------|----------|
| 28 | Where does the shared board live? | **AWS**, chosen over Firebase so the Product Owner can learn AWS. It runs on a personal AWS Free plan account, and everything is deleted before or when the free plan ends, so it costs nothing. |
| 29 | How is AWS set up? | In the **AWS web console** only, with no command-line tools, because the work laptop has a company AWS setup that must not be touched. |
| 30 | Who can open a board? | Anyone with the **board link**, which holds a long random code. Nothing confidential goes on the board. Sign-in may come later. |
| 31 | How is a board started and shared? | **Automatically** on first open, with a **Copy link** button. The browser remembers its last board, and a **New board** button starts another. |
| 32 | The board already saved in this browser | **Moved** into the first shared board, once. |
| 33 | Changing other people's notes | Only the author can **edit or delete** a note. Anyone can **react** to any note. |
| 34 | Board-wide actions | Anyone can drag notes, sort and vote. Only the **facilitator** (the browser that started the board) can clear the board and add, edit or delete areas. |
| 35 | Losing the connection | **Pause and reconnect**: a banner, actions greyed out, typed text kept, and the board catches up afterwards. No offline editing. |
| 36 | Names on notes | **Anonymous**: no names shown. |

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
