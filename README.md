# Sprint Retro Board

A simple, friendly board for Scrum sprint retrospectives and squad health checks, laid out on a whiteboard you can pan and zoom.

It runs entirely in the browser: no installation, no server and no logins.

## Features

**Retro**
- Three columns: 😊 **Going well**, 😟 **Not going well** and 💡 **Improvements**
- Sticky notes with emojis: use the built-in emoji picker or your keyboard's emojis
- Reactions on every note: 👍 ❤️ 😂 🎉 😮, with **−** to undo
- **Sort by votes** lines each column up by 👍, most first
- Edit and delete notes; up to 200 characters each

**Squad Health Check**
- 11 starter areas, such as Fun, Speed and Health of codebase, each with examples of "Awesome" and "Crappy"
- Vote 🟢 Awesome, 🟡 Fine or 🔴 Sad on each area
- Notes & Comments per area, as sticky notes
- Add, rename and delete areas

**Whiteboard**
- Drag notes anywhere in their column or area, or into another one
- Pan by dragging empty space or scrolling. Zoom with Ctrl/Cmd + scroll, a trackpad pinch, or the **− / + / Fit** buttons
- On phones, the board switches to a simple stacked layout

**Clear board** removes all notes and votes when the next sprint starts. The health check areas are kept.

## How to use it

Open `index.html` in a browser: double-click it, or open the GitHub Pages link if this repository has one.

It's designed for **one shared screen**: the Scrum Master runs the board while the team suggests notes and votes.

**Where your board is saved:** in the browser you use, on that computer. It survives a refresh or closing the browser. A different browser or computer starts with its own empty board, and clearing the browser's site data deletes the board.

**Supported browsers:** current Chrome, Edge, Safari and Firefox.

## Project files

| File | What it is |
|---|---|
| `index.html` | The page |
| `styles.css` | The look: whiteboard, sticky notes, phone layout |
| `app.js` | Draws the board and handles clicks and keys |
| `canvas.js` | Pan, zoom and dragging |
| `logic.js` | The board's rules: limits, sorting, votes, placing notes |
| `storage.js` | Saving and loading the board in the browser |
| `spec.md` | What the app does and why: user stories and acceptance criteria |
| `plan.md` | How it is built |
| `tasks.md` | The build task list and progress |
| `tests/` | Automated tests |

The app is plain HTML, CSS and JavaScript, with no frameworks, libraries or build step.

## Running the tests

You need [Node.js](https://nodejs.org) 20 or later. From the project folder:

```
node --test                    # unit tests for the rules and saving
node tests/browser-check.js    # the whole app in headless Google Chrome (macOS)
```

The browser check expects Google Chrome in `/Applications`. It prints PASS or FAIL for each check, then where it saved its screenshots.
