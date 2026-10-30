# Deleting everything from AWS

Click-by-click steps for removing the shared board from AWS (plan §11, tasks T093–T095). Do this **before your AWS Free plan ends**, around April 2027. Allow about 10 minutes.

Use a private browser window signed in to your **personal** AWS account, and make sure the **region** at the top right is the one you used in [SETUP.md](SETUP.md).

> ⚠️ **This deletes every board for good.** Anything on the shared boards that you want to keep, copy out first.

---

## Step 1 — Bring back v2 on GitHub (T093)

Do this first, so the live site keeps working once AWS is gone.

1. Open **github.com/Neha622/retro-board → Releases → v2.0**, and download its **Source code (zip)**.
2. Ask Claude to prepare the PR. It will list exactly which files to upload and delete.
3. Open the PR on a new branch, check that CI turns ✅, and merge it.
4. Open the live site and check that it works as a single-screen board.

---

## Step 2 — AppSync (T094)

1. Open **AppSync → APIs**.
2. Select **`retro-board`** → **Delete** → type the name to confirm.

The API key, schema, resolvers and data source are deleted with it.

## Step 3 — DynamoDB

1. Open **DynamoDB → Tables**.
2. Select **`RetroBoard`** → **Delete**.
3. Leave **Create an on-demand backup** unticked, type `confirm`, and delete.

## Step 4 — IAM role

1. Search for **IAM** and open **Roles**.
2. Search for `appsync-ds-ddb`. You should find one role, created for the `RetroBoardTable` data source.
3. Select it → **Delete** → type its name to confirm.

## Step 5 — CloudWatch logs

1. Open **CloudWatch → Logs → Log groups**.
2. Search for `/aws/appsync/`. If logging was left off, as SETUP.md says, there's nothing here.
3. If any log group shows up, select it → **Actions** → **Delete log group(s)**.

---

## Step 6 — Check the bill (T095)

1. Open **Billing and Cost Management → Bills**. This month's charges should be **$0.00**.
2. Open **Cost Explorer**. The last few months should show **$0**.
3. Wait for next month's bill. Once it shows **$0.00**, you can delete the `retro-board-1-dollar` budget: **Budgets** → select it → **Actions** → **Delete**.

## Done

Nothing from the retro board is left on AWS. If you also want to close the AWS account itself, that's under **your account name → Account → Close account**. It's optional, and separate from this project.
