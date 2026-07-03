// One-off backfill: set importContentHash = contentHash on every qa doc that
// lacks it. Valid EXACTLY while zero Phase 2 edits exist (every doc's
// contentHash still equals its import-time hash) — run once, before the
// review tab ships. Idempotent; dry-run by default, --write to commit.
//
// Usage: npx tsx --env-file=.env.local scripts/pipeline/backfill_import_hash.mts [--write]

const REQUIRED_ENV = [
  "FIREBASE_PRIVATE_KEY_ID",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_CLIENT_ID",
];
const missingEnv = REQUIRED_ENV.filter((name) => !process.env[name]);
if (missingEnv.length) {
  console.error(`Missing env vars: ${missingEnv.join(", ")} — run via tsx --env-file=.env.local`);
  process.exit(1);
}
const write = process.argv.includes("--write");

const { db } = await import("../../firebase/service");

const courses = await db.collection("courses").get();
let scanned = 0;
let missing = 0;
let alreadySet = 0;
let batch = db.batch();
let batchOps = 0;
const commits: Promise<unknown>[] = [];

for (const course of courses.docs) {
  const qa = await course.ref.collection("qa").get();
  for (const doc of qa.docs) {
    scanned++;
    const d = doc.data();
    if (typeof d.importContentHash === "string" && d.importContentHash) {
      alreadySet++;
      continue;
    }
    if (typeof d.contentHash !== "string" || !d.contentHash) {
      console.warn(`SKIP ${course.id}/qa/${doc.id}: no contentHash to copy`);
      continue;
    }
    missing++;
    if (write) {
      batch.set(doc.ref, { importContentHash: d.contentHash }, { merge: true });
      if (++batchOps >= 400) {
        commits.push(batch.commit());
        batch = db.batch();
        batchOps = 0;
      }
    }
  }
}
if (write && batchOps > 0) commits.push(batch.commit());
await Promise.all(commits);

console.log(
  `${write ? "WRITE" : "DRY-RUN"}: scanned ${scanned} qa docs across ${courses.size} courses — ` +
    `backfilled ${write ? missing : `0 (would backfill ${missing})`}, already set ${alreadySet}`
);
process.exit(0);
