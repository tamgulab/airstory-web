// Deletes ALL users from the configured Firebase project (Auth), in batches.
// Destructive and irreversible — it hits whatever project FIREBASE_PROJECT_ID points at.
// Guarded: pass --yes (or CONFIRM=1) to actually run.
//
//   node src/db/clear-firebase-users.js --yes
//
// Typically paired with a DB reseed: the seed re-provisions the Firebase accounts it needs.
import { firebaseAuth } from "../config/firebase-admin.js";

const confirmed = process.argv.includes("--yes") || process.env.CONFIRM === "1";

async function run() {
  const auth = firebaseAuth();

  // Collect every uid by paging through listUsers (1000 per page).
  const uids = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) uids.push(user.uid);
    pageToken = page.pageToken;
  } while (pageToken);

  if (!uids.length) {
    console.log("No Firebase users to delete.");
    return;
  }

  if (!confirmed) {
    console.log(`Found ${uids.length} Firebase user(s). This will DELETE ALL of them.`);
    console.log("Re-run with --yes to proceed, e.g.  node src/db/clear-firebase-users.js --yes");
    return;
  }

  // deleteUsers accepts up to 1000 uids per call.
  let deleted = 0;
  let failed = 0;
  for (let i = 0; i < uids.length; i += 1000) {
    const batch = uids.slice(i, i + 1000);
    const result = await auth.deleteUsers(batch);
    deleted += result.successCount;
    failed += result.failureCount;
    for (const err of result.errors) {
      console.error(`  failed uid ${batch[err.index]}: ${err.error.message}`);
    }
  }

  console.log(`Deleted ${deleted} Firebase user(s)${failed ? `, ${failed} failed` : ""}.`);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
