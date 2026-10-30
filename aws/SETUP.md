# Setting up AWS for the shared board

Click-by-click steps for creating everything the shared board needs on AWS (plan §11, tasks T058–T063). Allow 30–45 minutes.

AWS changes its console from time to time, so a button may be worded or placed a little differently from what's written here. Look for the nearest match.

---

## Before you start

- Use a **private browser window**, signed in to your **personal** AWS account, never a work one.
- Don't install or use any AWS command-line tools on the work laptop.
- **Pick one region** and use it for every step, for example **Europe (London) `eu-west-2`** or **Asia Pacific (Mumbai) `ap-south-1`**. The region menu is at the top right of the console, next to your account name. Check it before each step.

---

## Step 1 — Budget alert (T058)

Do this first, so you'll hear about any cost straight away.

1. Search the top bar for **Budgets** and open **Billing and Cost Management → Budgets**.
2. Click **Create budget**.
3. Choose **Use a template (simplified)** → **Monthly cost budget**.
4. Fill in:
   - **Budget name:** `retro-board-1-dollar`
   - **Budgeted amount:** `1`
   - **Email recipients:** your personal email
5. Click **Create budget**. AWS emails you when actual spend reaches 85% and 100% of the $1, and when it's forecast to go over.

---

## Step 2 — DynamoDB table (T059)

1. Search for **DynamoDB** and open it. Check the region.
2. Click **Tables → Create table**.
3. Fill in:
   - **Table name:** `RetroBoard` (exactly, with capital R and B)
   - **Partition key:** `pk`, type **String**
   - **Sort key:** `sk`, type **String**
4. Under **Table settings**, choose **Customize settings**, then:
   - **Capacity mode:** **On-demand**
   - Leave everything else as it is.
5. Click **Create table**, and wait until its status is **Active**.
6. **Turn on automatic deletion (TTL):**
   1. Open the table, then the **Additional settings** tab.
   2. In **Time to Live (TTL)**, click **Turn on**.
   3. **TTL attribute name:** `expiresAt`
   4. Click **Turn on TTL**.

---

## Step 3 — AppSync API (T060)

### 3a. Create the API
1. Search for **AppSync** and open it. Check the region.
2. Click **Create API** → **GraphQL APIs** → **Design from scratch** → **Next**.
3. **API name:** `retro-board`. If you're asked about creating resources now, choose **later**. Click **Next**, then **Create**.

### 3b. Paste the schema
1. In the left menu, open **Schema**.
2. Delete what's in the editor, paste in the whole of [`schema.graphql`](schema.graphql), and click **Save Schema**.

### 3c. Connect the table
1. In the left menu, open **Data sources** → **Create data source**.
2. Fill in:
   - **Data source name:** `RetroBoardTable`
   - **Data source type:** **Amazon DynamoDB table**
   - **Region:** the region you picked
   - **Table name:** `RetroBoard`
   - **Create or use an existing role:** **New role**
3. Click **Create**.

### 3d. Attach the 13 resolvers
For **each row** in the table below:
1. On the **Schema** page, find the field in the **Resolvers** panel on the right (it lists `Query` and `Mutation` fields), and click **Attach** next to it.
2. Choose:
   - **Resolver type:** **Unit resolver**
   - **Resolver runtime:** **APPSYNC_JS**
   - **Data source:** `RetroBoardTable`
3. Click **Create**.
4. Replace the code in the editor with the whole of the matching file from [`resolvers/`](resolvers/), and click **Save**.

| Type | Field | File |
|---|---|---|
| Query | `getBoard` | `Query.getBoard.js` |
| Query | `listNotes` | `Query.listNotes.js` |
| Mutation | `createBoard` | `Mutation.createBoard.js` |
| Mutation | `addNotes` | `Mutation.addNotes.js` |
| Mutation | `editNote` | `Mutation.editNote.js` |
| Mutation | `deleteNote` | `Mutation.deleteNote.js` |
| Mutation | `moveNotes` | `Mutation.moveNotes.js` |
| Mutation | `react` | `Mutation.react.js` |
| Mutation | `vote` | `Mutation.vote.js` |
| Mutation | `clearBoard` | `Mutation.clearBoard.js` |
| Mutation | `saveArea` | `Mutation.saveArea.js` |
| Mutation | `deleteArea` | `Mutation.deleteArea.js` |
| Mutation | `removeNotes` | `Mutation.removeNotes.js` |

The **Subscription** field `onChange` needs **no** resolver. Leave it as it is.

If the console shows an error when you save a resolver, copy the message and send it to Claude.

### 3e. Check that logging is off
1. In the left menu, open **Settings**.
2. Under **Logging**, make sure logging is **not** turned on. Logs aren't needed, and they would store the browser secrets sent with each change.

---

## Step 4 — Test it in the console (T061)

1. In the left menu, open **Queries**. If it asks which sign-in to use, choose **API key**.
2. Paste each operation below into the editor, one at a time, and click the orange ▶ **Run** button. Each one says what you should see.

**A. Create a test board, as "Alice".** You should see `"type": "boardCreated"`.
```graphql
mutation CreateTestBoard {
  createBoard(
    boardId: "test-board-1"
    secret: "alice-secret-1234567890"
    changeId: "test-1"
    areas: "{\"area-fun\":{\"name\":\"Fun\",\"awesome\":\"We love it\",\"crappy\":\"We dread it\",\"order\":0}}"
    votes: "{}"
  ) { boardId changeId type data }
}
```

**B. Alice adds a card.** You should see `"type": "notesAdded"`.
```graphql
mutation AliceAddsACard {
  addNotes(
    boardId: "test-board-1"
    secret: "alice-secret-1234567890"
    changeId: "test-2"
    generation: 0
    notes: "[{\"id\":\"note-1\",\"kind\":\"card\",\"column\":\"well\",\"text\":\"Great sprint 🎉\",\"x\":16,\"y\":16,\"z\":1}]"
  ) { boardId changeId type data }
}
```

**C. "Bob" reacts with 👍.** Anyone may react, so this works: you should see `"type": "reacted"`.
```graphql
mutation BobReacts {
  react(boardId: "test-board-1", changeId: "test-3", noteId: "note-1", reaction: "thumbsUp", delta: 1) {
    boardId changeId type data
  }
}
```

**D. Bob tries to edit Alice's card.** This must be **refused**: you should see an error with `"errorType": "NotYours"`.
```graphql
mutation BobTriesToEdit {
  editNote(boardId: "test-board-1", secret: "bob-secret-12345678901", changeId: "test-4", noteId: "note-1", text: "Hacked") {
    boardId changeId type data
  }
}
```

**E. Bob tries to clear the board.** This must be **refused**: you should see `"errorType": "NotFacilitator"`.
```graphql
mutation BobTriesToClear {
  clearBoard(boardId: "test-board-1", secret: "bob-secret-12345678901", changeId: "test-5", areaIds: ["area-fun"]) {
    boardId changeId type data
  }
}
```

**F. Bob reads the board.** You should see `"isFacilitator": false`, and one note with `"mine": false`, the text "Great sprint 🎉" and `"thumbsUp": 1`.
```graphql
query BobReads {
  getBoard(boardId: "test-board-1", secret: "bob-secret-12345678901") {
    boardId generation noteCount areas votes isFacilitator
  }
  listNotes(boardId: "test-board-1", secret: "bob-secret-12345678901", generation: 0) {
    notes nextToken
  }
}
```

**G. Look in DynamoDB.** Open **DynamoDB → Explore items → RetroBoard**. You should see two items with `pk` = `test-board-1`: one with `sk` = `BOARD`, and one with `sk` = `NOTE#note-1`.

**H. Tidy up.** In **Explore items**, tick both test items → **Actions** → **Delete items** → confirm.

If any result is different from what's described, copy the whole result and send it to Claude.

---

## Step 5 — API key and addresses for the app (T062)

1. In AppSync's left menu, open **Settings**.
2. Under **API keys**, there's a key created with the API, which expires after 7 days. Click **Edit** (or delete it and **Create API key**) and set the expiry to about **6 months** from today.
3. Copy these three values and send them to Claude for `config.js`:
   - **GraphQL endpoint**, ending in `/graphql`
   - **Realtime endpoint**, starting with `wss://`
   - **API key**, starting with `da2-`

The API key ends up in the app's public code on GitHub. That's expected for this setup (plan §9), so it's fine to share.

---

## Step 6 — Keep v2 safe on GitHub (T063)

So the single-screen v2 can be brought back after teardown:

1. Open **github.com/Neha622/retro-board** in your private window.
2. In the right-hand column, click **Releases** (or **Create a new release**).
3. Click **Draft a new release**.
4. Click **Choose a tag**, type `v2.0`, and choose **Create new tag: v2.0 on publish**. The target should be `main`.
5. **Release title:** `v2.0 — single-screen board`
6. Click **Publish release**.

---

## Done

Tell Claude when every step is finished. That's checkpoint 9.
