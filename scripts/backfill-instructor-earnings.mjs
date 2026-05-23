// Backfill instructor earnings from historical enrollments.
//
// One-off, OPTIONAL, idempotent, dry-run-by-default. It reconstructs an
// 'earning' ledger entry for every pre-existing PAID enrollment, so an
// instructor's earnings ledger reflects sales that happened before the
// instructor-payouts feature shipped.
//
//   Snapshot rule .... every backfilled entry snapshots revenueSharePercent
//                      as 70 — the only deal in effect for all sales so far
//                      — and recomputes the split from the gross paid.
//   createdAt ........ set to a Firestore Timestamp built from the original
//                      enrollment date, so the ledger reads chronologically.
//                      (Live sale code uses FieldValue.serverTimestamp();
//                      a backfill must preserve the real sale date instead.)
//   Idempotent ....... an enrollment that already has an earning entry is
//                      skipped — safe to re-run, and it never double-counts
//                      sales the live code already recorded.
//   Payouts .......... NEVER created. Money already paid to instructors
//                      out of band must be entered by the owner by hand on
//                      /admin-dashboard/instructor-payouts. See the manual
//                      step in docs/INSTRUCTOR_PAYOUTS.md.
//
// Usage (from repo root):
//   node --env-file=.env.local scripts/backfill-instructor-earnings.mjs          # dry run
//   node --env-file=.env.local scripts/backfill-instructor-earnings.mjs --apply  # writes
//
// Dry run prints exactly what an --apply run would write and changes nothing.

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");
const BACKFILL_PERCENT = 70;

// ---- init ------------------------------------------------------------------

const projectId = process.env.FIREBASE_PROJECT_ID || "readiq-1f109";
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!clientEmail || !privateKey) {
  console.error(
    "Missing FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY. Run with:\n" +
      "  node --env-file=.env.local scripts/backfill-instructor-earnings.mjs"
  );
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
  });
}
const db = getFirestore();

// ---- helpers ---------------------------------------------------------------

function computeSplit(gross) {
  const g = Math.max(0, Math.round(gross));
  const instructorShareAmount = Math.round((g * BACKFILL_PERCENT) / 100);
  return {
    grossAmount: g,
    instructorShareAmount,
    platformShareAmount: g - instructorShareAmount,
  };
}

function grossOf(enr) {
  // Sectional enrollments accumulate `totalSpent`; standalone ones carry a
  // single `amount`. Prefer the cumulative figure when present.
  if (typeof enr.totalSpent === "number" && enr.totalSpent > 0) {
    return enr.totalSpent;
  }
  return typeof enr.amount === "number" ? enr.amount : 0;
}

function enrolledDate(enr) {
  const raw = enr.enrolledAt || enr.createdAt;
  const d = raw ? new Date(raw) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

// ---- run -------------------------------------------------------------------

async function main() {
  console.log(
    `\n=== Instructor earnings backfill — ${APPLY ? "APPLY (writing)" : "DRY RUN (no writes)"} ===\n`
  );

  const [enrollmentsSnap, coursesSnap] = await Promise.all([
    db.collection("enrollments").where("status", "==", "completed").get(),
    db.collection("courses").get(),
  ]);

  // courseId -> { createdBy }
  const courses = new Map();
  coursesSnap.docs.forEach((d) => courses.set(d.id, d.data() || {}));

  // Pre-load every existing earning entry's enrollmentId per instructor, so
  // the idempotency check is in-memory (no per-enrollment query).
  const instructorIds = new Set();
  enrollmentsSnap.docs.forEach((d) => {
    const c = courses.get(d.data()?.courseId);
    if (c?.createdBy) instructorIds.add(c.createdBy);
  });
  const seenEnrollmentIds = new Set(); // `${instructorId}::${enrollmentId}`
  for (const instructorId of instructorIds) {
    const led = await db
      .collection("users")
      .doc(instructorId)
      .collection("earningsLedger")
      .where("kind", "==", "earning")
      .get();
    led.docs.forEach((e) => {
      const eid = e.data()?.enrollmentId;
      if (eid) seenEnrollmentIds.add(`${instructorId}::${eid}`);
    });
  }

  let toWrite = 0;
  let skippedExisting = 0;
  let skippedFree = 0;
  let skippedNoInstructor = 0;
  let skippedOwnCourse = 0;
  const perInstructorTotal = new Map();

  for (const doc of enrollmentsSnap.docs) {
    const enr = doc.data() || {};
    const enrollmentId = doc.id;
    const course = courses.get(enr.courseId);
    const instructorId = course?.createdBy;

    if (!instructorId) {
      skippedNoInstructor++;
      continue;
    }
    if (instructorId === enr.userId) {
      skippedOwnCourse++;
      continue;
    }
    const gross = grossOf(enr);
    if (!(gross > 0)) {
      skippedFree++;
      continue;
    }
    if (seenEnrollmentIds.has(`${instructorId}::${enrollmentId}`)) {
      skippedExisting++;
      continue;
    }

    const split = computeSplit(gross);
    toWrite++;
    perInstructorTotal.set(
      instructorId,
      (perInstructorTotal.get(instructorId) || 0) + split.instructorShareAmount
    );

    console.log(
      `  + earning  enrollment=${enrollmentId}  instructor=${instructorId}  ` +
        `gross=${split.grossAmount}  share@${BACKFILL_PERCENT}%=${split.instructorShareAmount}`
    );

    if (APPLY) {
      const userRef = db.collection("users").doc(instructorId);
      const entryRef = userRef.collection("earningsLedger").doc();
      const createdAt = Timestamp.fromDate(enrolledDate(enr));
      const entry = {
        kind: "earning",
        amount: split.instructorShareAmount,
        grossAmount: split.grossAmount,
        revenueSharePercent: BACKFILL_PERCENT,
        instructorShareAmount: split.instructorShareAmount,
        platformShareAmount: split.platformShareAmount,
        courseId: enr.courseId,
        enrollmentId,
        source: "backfill",
        createdBy: enr.userId || "backfill-script",
        createdAt,
        backfilledAt: FieldValue.serverTimestamp(),
      };
      if (Array.isArray(enr.ownedSectionIds) && enr.ownedSectionIds.length) {
        entry.sectionIds = enr.ownedSectionIds;
      }
      await entryRef.set(entry);
      await userRef.set(
        {
          earningsTotal: FieldValue.increment(split.instructorShareAmount),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`  enrollments scanned ......... ${enrollmentsSnap.size}`);
  console.log(`  earning entries to write .... ${toWrite}`);
  console.log(`  skipped (already has entry) . ${skippedExisting}`);
  console.log(`  skipped (free / zero gross) . ${skippedFree}`);
  console.log(`  skipped (no instructor) ..... ${skippedNoInstructor}`);
  console.log(`  skipped (own course) ........ ${skippedOwnCourse}`);
  console.log(`\n  per-instructor earnings to add:`);
  for (const [id, total] of perInstructorTotal) {
    console.log(`    ${id}  +${total.toLocaleString()} IQD`);
  }

  if (!APPLY) {
    console.log(
      `\nDRY RUN — nothing written. Re-run with --apply to commit.\n` +
        `Reminder: this does NOT record past payouts. Enter those by hand\n` +
        `on /admin-dashboard/instructor-payouts (see docs/INSTRUCTOR_PAYOUTS.md).\n`
    );
  } else {
    console.log(
      `\nAPPLIED. ${toWrite} earning entries written.\n` +
        `Next: record any money already paid to instructors as payouts on\n` +
        `/admin-dashboard/instructor-payouts (see docs/INSTRUCTOR_PAYOUTS.md).\n`
    );
  }
}

main().catch((e) => {
  console.error("Backfill failed:", e);
  process.exit(1);
});
