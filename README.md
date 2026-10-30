# Sprint Retro Board

A simple, friendly board for Scrum sprint retrospectives and squad health checks, laid out on a whiteboard you can pan and zoom.

The whole team works on **one shared board, live**: everyone opens the same link on their own laptop or phone and sees each other's notes appear within a second or two. There's nothing to install and no logins.

## Features

**Shared and live**
- Share the board with one click: **🔗 Copy link**, then paste it in Teams or Slack
- Everyone sees new notes, reactions, votes and moves as they happen
- You can edit and delete only **your own** notes; anyone can react to any note and move it
- The person who starts the board is its **facilitator**: only they can clear it or change the health check areas
- Notes are anonymous
- If the connection drops, the board pauses and catches up on its own once it's back; nothing you were typing is lost

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

**Clear board** removes all notes and votes when the next sprint starts. The health check areas are kept, and so is the board's link.

## How to use it

1. **The Scrum Master** opens the app. A new board starts, and its link appears in the address bar.
2. Click **🔗 Copy link** and share it with the team.
3. **Everyone** opens the link and adds notes, reacts and votes.
4. After the retro, the Scrum Master clicks **Clear board**, ready for next sprint. The same link keeps working.

Your browser remembers your last board, so opening the app again takes you back to it. **New board** starts another one.

**Good to know**
- **Anyone with the link can open the board.** Don't put anything confidential on it.
- **"Your" notes belong to your browser.** On another device or browser you're someone new, and clearing your browser's data means you can no longer edit your old notes. They stay on the board.
- **Boards that nobody changes for 90 days are deleted automatically.**
- If you used the app before it was shared, your board moves into your first shared board automatically.

**Supported browsers:** current Chrome, Edge, Safari and Firefox.

## How it works

The page itself is plain HTML, CSS and JavaScript on GitHub Pages. The shared board lives on **AWS**:
- **AppSync** is a GraphQL API. It checks the rules (whose note it is, who the facilitator is) and pushes live changes to everyone over a WebSocket.
- **DynamoDB** stores the boards.

Everything on AWS is described in the [`aws/`](aws/) folder: the schema, the resolvers, and step-by-step guides to [set it up](aws/SETUP.md) and [delete it](aws/TEARDOWN.md).

## Project files

| File | What it is |
|---|---|
| `index.html` | The page |
| `styles.css` | The look: whiteboard, sticky notes, phone layout |
| `app.js` | Draws the board, handles clicks and keys, and sends every change to AWS |
| `canvas.js` | Pan, zoom and dragging |
| `logic.js` | The board's rules: limits, sorting, votes, placing notes, applying live changes |
| `storage.js` | What this browser remembers: its identity, its last board, its zoom |
| `cloud.js` | Talks to AWS AppSync: queries and changes, live updates, reconnecting |
| `config.js` | The AppSync address and API key (public by design) |
| `aws/` | The GraphQL schema, resolvers, and AWS set-up and teardown guides |
| `spec.md` | What the app does and why: user stories and acceptance criteria |
| `plan.md` | How it is built |
| `tasks.md` | The build task list and progress |
| `documentation.md` | How the app was made, and the tools used |
| `tests/` | Automated tests, and a fake AWS for running them |

The app is plain HTML, CSS and JavaScript, with no frameworks, libraries or build step.

## Running the tests

You need [Node.js](https://nodejs.org) 22 or later. From the project folder:

```
node --test                    # unit tests: the rules, this browser's settings, and talking to AWS
node tests/browser-check.js    # the whole app in headless Google Chrome, with two people (macOS)
```

Neither needs AWS: both use **`tests/fake-aws.js`**, a stand-in for AppSync that runs on your computer, with the same rules and the same live updates. CI runs `node --test` on every pull request.

The browser check expects Google Chrome in `/Applications`. It prints PASS or FAIL for each check, then where it saved its screenshots.

## Trying it without AWS

```
node tests/fake-aws.js
```

Then open **http://127.0.0.1:8787** in a normal window and a private window (they count as two people), and share the first window's link with the second. Boards live only in memory and are gone when you stop it with Ctrl+C.
