# How the Sprint Retro Board was made

This is a summary of how the Sprint Retro Board went from an idea to a tested, shared, live app on AWS with a public website: how it was specified, built, tested and deployed, and which tools were used along the way.

For what the app does and how to use it, see [README.md](README.md).

---

## 1. The idea

A Product Owner wanted a simple, friendly board for the team's sprint retrospectives:

- three columns: 😊 Going well, 😟 Not going well and 💡 Improvements
- sticky notes with emojis and reactions
- notes sorted by votes
- nothing to install, no logins, no server

Version 2 added a **whiteboard canvas inspired by Miro**, with pan, zoom and free dragging of notes, and a **Squad Health Check** table next to the retro board.

Version 3 made the board **shared and live**: everyone opens the same link on their own device and sees each other's notes appear. People can edit only their own notes, but can react to anyone's; only the facilitator who started the board can clear it or change its areas. The shared board runs on **AWS**, which the Product Owner chose in order to learn it.

---

## 2. How it was built: spec-driven development

The app was built with **spec-driven development**: decide *what* to build and *why* before writing any code. Each step produces a document, and each document is reviewed and approved before the next step starts.

```
spec.md  →  plan.md  →  tasks.md  →  code  →  tests
 (what)     (how)       (steps)
```

| Document | What it holds |
|---|---|
| [spec.md](spec.md) | 20 user stories with acceptance criteria, functional requirements (FR-001 to FR-027), and a decisions log of every question answered along the way (36 decisions) |
| [plan.md](plan.md) | The technical design: files, data, how each part works, the AWS design, accessibility, testing, risks, cost and teardown |
| [tasks.md](tasks.md) | Numbered build tasks (T001–T095) grouped into phases, ticked off as they're done |

**How questions were handled:** gaps in the spec were raised **one question at a time**, each with the simplest option suggested. Every answer was written into the spec's decisions log, so the reasoning behind each choice is kept.

**Checkpoints:** work stopped at the end of every phase for the Product Owner to review the result before continuing.

### Build phases

| Phase | What it delivered | Status |
|---|---|---|
| 1. Setup | Project files and test setup | ✅ |
| 2. Foundations | The board's rules and saving, tested, before any screen existed | ✅ |
| 3. P1 stories | A usable board: add, edit and delete notes, emojis, saving | ✅ |
| 4. P2 stories | Reactions, Sort by votes, Clear board | ✅ |
| 5. v2 foundations | New rules and saving for the whiteboard and health check, plus upgrading v1 boards | ✅ |
| 6. Whiteboard | Pan, zoom, Fit, dragging notes, phone layout | ✅ |
| 7. Squad Health Check | 11 areas, 🟢 🟡 🔴 votes, notes, and adding, renaming and deleting areas | ✅ |
| 8. Final checks | Manual checks: Safari pinch-zoom, VoiceOver, a real trackpad | ⏸ parked |
| 9. AWS set-up | The GraphQL schema and 13 resolvers written and reviewed, then DynamoDB and AppSync created in the AWS console and their rules tested by hand | ✅ |
| 10. Sync foundations | The rules for applying live changes, who sees which buttons, limits, and this browser's settings | ✅ |
| 11. Talking to AWS | `cloud.js` (queries, changes, live updates, reconnecting) and a fake AWS for tests | ✅ |
| 12. The shared board in the app | Opening, creating and sharing boards, live redraw, owner and facilitator buttons, the connection banner, moving old boards | ✅ |
| 13. Checks for two people | Browser checks with two browsers, updated for the shared board | ✅ |
| 14. Real AWS check and release | A manual check on the real AWS, then a pull request, CI, merge and the live site | Next |
| 15. Teardown | Bring back v2 and delete everything from AWS before the free plan ends (around April 2027) | Later |

---

## 3. How the app works

The page is a **static website**: plain HTML, CSS and JavaScript, with **no frameworks, no libraries and no build step**, served by GitHub Pages. Since v3, the board itself lives on **AWS**:

```
 Each person's browser                        AWS (Europe, Stockholm)
┌───────────────────────┐   changes (HTTPS)   ┌────────────────────┐      ┌──────────────────┐
│ page from GitHub Pages │ ─────────────────▶ │ AppSync            │ ───▶ │ DynamoDB          │
│ app.js + cloud.js      │ ◀───────────────── │ GraphQL API + rules│ ◀─── │ table RetroBoard  │
└───────────────────────┘ live changes (WSS)  └────────────────────┘      └──────────────────┘
```

| File | Lines | Job |
|---|---|---|
| `index.html` | ~90 | The page structure |
| `styles.css` | ~970 | The look: whiteboard, sticky notes, phone layout, light colours that pass WCAG AA contrast |
| `logic.js` | ~620 | The board's rules, as pure functions with no screen code, so they're easy to test, including applying live changes |
| `storage.js` | ~230 | What this browser remembers: its secret, its last board, its zoom; moving an old board |
| `cloud.js` | ~240 | Talks to AppSync: queries and changes with `fetch`, live changes over a `WebSocket`, reconnecting |
| `canvas.js` | ~280 | Pan, zoom and dragging on the whiteboard |
| `app.js` | ~1400 | Draws the board, handles clicks and keys, and sends every change to AWS |
| `aws/` | ~900 | The GraphQL schema, 13 resolvers, and the set-up and teardown guides |

**Main design choices**

- **AppSync + DynamoDB, set up in the AWS web console.** AppSync is a GraphQL API that pushes live changes to everyone watching a board; DynamoDB stores boards (one item per board, one per note). Both are serverless, cost almost nothing, and can be deleted in minutes. The console was used rather than command-line tools, to keep the work laptop's company AWS setup untouched.
- **Rules enforced on AWS, not just in the page.** Each browser has a random secret. AWS stores it on the notes and boards it creates, checks it before an edit, delete, Clear or area change, and never sends it back out. A hidden button can't simply be un-hidden.
- **Changes add up safely.** Reactions and votes are sent as +1 or −1 and added on AWS, so clicks at the same moment all count. Every change has an id, so it's applied once even though it arrives twice (as the answer, and live).
- **Clear board is one update.** It bumps a "generation" number that hides older notes on every screen at once; the leftovers are deleted in the background.
- **Old boards expire.** DynamoDB's TTL deletes a board 90 days after its last change.
- **Rules kept apart from the screen.** All the rules (limits, sorting, votes, placing notes) live in `logic.js`, which can be tested without a browser.
- **Emoji-aware text limits.** `Intl.Segmenter` counts each emoji as 1 character towards the 200-character limit.
- **The whiteboard is a CSS transform.** Panning and zooming move one "world" layer. Notes are dragged with pointer events, and Ctrl/Cmd + scroll or a trackpad pinch zooms.
- **Phones get a simpler layout.** Below 768px wide, the whiteboard turns into stacked columns.
- **Moving old boards.** A board saved in the browser by v1 or v2 moves into that browser's first shared board, once.

---

## 4. Testing

| Kind | File | What it checks | How to run |
|---|---|---|---|
| Unit tests (126) | `tests/logic.test.js`, `tests/storage.test.js`, `tests/cloud.test.js` | The rules, live changes, this browser's settings, and two clients talking through a fake AWS | `node --test` |
| Browser check (179 checks) | `tests/browser-check.js` | The whole app in headless Google Chrome, including a second browser as a teammate: clicking, typing, dragging, zooming, live updates, a lost connection, screenshots | `node tests/browser-check.js` |
| Manual, in the AWS console | `aws/SETUP.md`, step 4 | The resolvers' rules on the real AWS: Bob can react to Alice's card, but can't edit it or clear her board | AppSync → Queries |

**The fake AWS** ([tests/fake-aws.js](tests/fake-aws.js)) is a stand-in for AppSync that runs on your computer, with the same operations, the same rules and the same real-time protocol. Tests and CI use it, so they need no AWS account, cost nothing, and can simulate a lost connection. Its weakness is that it's a copy, which is why the release includes a manual check on the real AWS.

The unit tests use Node's **built-in test runner**, so there's nothing to install. The browser check drives Chrome through the **Chrome DevTools Protocol**.

Bugs that testing found and fixed included:
- clicks missing buttons below the screen
- a note placed too close to another one
- columns of uneven height
- the zoom panel covering focused buttons
- **[v3]** resolvers returning their JSON twice-encoded (spotted in the AppSync console)
- **[v3]** a resolver pasted onto the wrong field (caught by the console tests)
- **[v3]** your own new card arriving without its Edit button, and its position never being saved, because the live copy of a change can arrive before AWS's answer (caught by the two-browser checks)

---

## 5. Version control and GitHub

The code lives at **github.com/Neha622/retro-board** (public).

1. **First upload:** the app files were uploaded through the GitHub website, with a [README.md](README.md) for visitors.
2. **Pull requests:** later changes go on a **branch**, are proposed in a **pull request (PR)**, reviewed in the **Files changed** tab, and then merged into `main`. All of this was done on the GitHub website, with no git commands needed.
3. **`.gitignore`** keeps personal tool settings (`.claude/settings.local.json`) out of the repo.

**PR #1, "Add CI workflow for running unit tests"**, was the first pull request:
- It added the tests and the CI workflow.
- CI went ❌ three times while files were in the wrong place: the workflow was named `ci.yml.` with a stray dot, and the test files sat outside `tests/`.
- CI turned ✅ once the files were fixed, and the PR was then merged.

---

## 6. CI/CD

### CI (Continuous Integration): GitHub Actions
[.github/workflows/ci.yml](.github/workflows/ci.yml) runs on **every pull request** and **every push to `main`**:

```
get the code → install Node.js 22 → node --test
```

The result shows on the PR as ✅ (safe to merge) or ❌ (something broke).

A **branch ruleset** ("Protect main") can make this mandatory:
- every change must go through a PR
- the `Unit tests` check must pass before merging
- force pushes and deleting `main` are blocked
- required approvals stay at 0, because GitHub doesn't let authors approve their own PRs and this is a solo project; the PR is still self-reviewed with a comment review

### CD (Continuous Delivery): GitHub Pages
The app is published with **GitHub Pages** (Settings → Pages → Deploy from a branch → `main`, `/ (root)`), at:

**https://neha622.github.io/retro-board/**

Every merge into `main` updates the live site automatically:

```
branch → pull request → CI tests ✅ → review → merge to main → website updates
```

GitHub Pages is free for public repos. It only serves files, which is all a static app like this needs. Since v3 the data lives on AWS, but the page is still a static site.

**Releasing v3:** because every merge goes live, v3 is merged only after the manual check on the real AWS. Before merging, `main` was tagged **`v2.0`** as a GitHub release, so the single-screen version can be brought back after the AWS resources are deleted.

---

## 7. Tools and technologies

| Area | Tool or technology | Used for |
|---|---|---|
| Language | HTML, CSS, JavaScript | The app itself |
| Browser features | localStorage, `Intl.Segmenter`, Pointer Events, CSS transforms, media queries, `fetch`, `WebSocket`, `crypto.randomUUID`, Clipboard API | This browser's settings, emoji counting, dragging, pan and zoom, phone layout, talking to AWS, ids and secrets, Copy link |
| API | GraphQL (queries, mutations, subscriptions) | The shape of every request to the shared board |
| Cloud | **AWS AppSync** (JavaScript resolvers, API key, real-time subscriptions) | The shared board's API, its rules, and live updates |
| Cloud | **Amazon DynamoDB** (on-demand, condition expressions, transactions, TTL) | Storing boards and notes; safe counts; automatic deletion after 90 days |
| Cloud | **AWS IAM** | The role that lets AppSync use the table, and nothing else |
| Cloud | **AWS Budgets** | An alert as soon as anything costs money |
| Runtime | Node.js | Running the tests and the fake AWS |
| Testing | `node:test`, `node:assert` | Unit tests |
| Testing | Headless Google Chrome + Chrome DevTools Protocol | The browser check, with two browsers |
| Testing | `tests/fake-aws.js` (Node's `http` and `crypto`, with a hand-written WebSocket server) | A stand-in for AppSync, for tests and CI |
| Accessibility | WCAG AA contrast checks, keyboard support, focus management | Making the app usable for everyone |
| Editor | VS Code (Kiro also works) | Editing files |
| AI assistant | Claude Code | Questions on the spec, writing the plan, tasks, code and tests, and guiding the GitHub and AWS setup |
| Version control | Git, GitHub | Storing the code, branches, pull requests, code review |
| CI | GitHub Actions | Running the tests automatically on every PR |
| Branch protection | GitHub rulesets | Blocking merges when CI fails |
| CD and hosting | GitHub Pages | Free public website, updated on every merge |

---

## 8. Lessons learned

- **Spec first saves rework.** Answering questions before coding meant few surprises during the build. The decisions log explains *why* things are the way they are.
- **Keep rules apart from the screen.** Because `logic.js` has no screen code, most of the app is covered by fast unit tests.
- **CI catches mistakes early.** A stray dot in a file name and a misplaced folder were caught by CI before anything reached `main`.
- **Exact names matter.** GitHub only runs workflows at exactly `.github/workflows/<name>.yml`.
- **Static apps can be hosted for free.** Without a server or database, GitHub Pages is enough.
- **Keep work and personal accounts apart.** Do personal GitHub and AWS work in its own browser window or on a personal device, and never mix it with a work laptop's command-line setup.
- **[v3] Put the rules where they can't be skipped.** Hiding a button isn't security; the owner and facilitator checks run on AWS.
- **[v3] Test the cloud by hand before trusting it.** The AppSync console's test queries caught a wrongly pasted resolver and double-encoded JSON before any app code depended on them.
- **[v3] Live systems deliver things out of order.** The live copy of your own change can beat AWS's answer to you. Two-browser tests found it twice.
- **[v3] A fake keeps tests free and fast.** The fake AWS lets CI test every pull request without cloud credentials or cost.
- **[v3] Plan the way out.** A $1 budget alert, a teardown guide and a `v2.0` release mean the AWS experiment can end cleanly before the free plan does.

---

## 9. What's next

- **Phase 14:** the manual check on the real AWS, then releasing v3 through a pull request.
- **Before about April 2027:** the teardown in [aws/TEARDOWN.md](aws/TEARDOWN.md).
- **"Copy retro summary"**: a button that copies the board as Markdown to paste into Slack, Teams or Confluence.
- **Possible later:** sign-in with AWS Cognito instead of secret links, showing who's online, and running the browser check in CI.
- **Phase 8 final checks** (parked): Safari pinch-zoom, VoiceOver, a real trackpad.
