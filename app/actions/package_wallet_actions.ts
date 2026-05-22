// Course-package wallet purchase action (Phase 2).
//
// `purchasePackageWithWallet` is the single atomic entry point for buying a
// package: it debits the buyer's wallet, writes N full-access enrollments,
// credits the dedicated platform wallet, locks the package's course list,
// and records one `package_sales` doc — all in one Firestore transaction.
//
// This is a THIRD purchase model alongside standalone
// (`purchaseCourseWithWallet`) and sectional (`purchaseSectionsWithWallet` /
// `purchaseBundleWithWallet`). It does not touch either of those paths.
//
// Revenue model — deliberate divergence: a package sale credits ONLY the
// platform wallet (`wallets/__platform__`). It NEVER credits an instructor
// wallet and writes NO instructor earning row. Instructors are settled out
// of band against the per-instructor owed tally, which is summed from the
// payout snapshot stored on each `package_sales` doc.
//
// Idempotency mirrors the sectional pattern but on the `package_sales`
// collection, keyed by `(buyerId, protectionKey)`. The protectionKey is
// required to be namespaced `package_purchase_*` so it can never collide
// with a standalone/sectional `purchase_*` key.
//
// Error envelope matches the sectional actions:
// `{ success: false, error: <code>, message: <human>, details? }`.
"use server";

import { adminAuth, db } from "@/firebase/service";
import { FieldValue } from "firebase-admin/firestore";
import type { Course, CoursePackage, Enrollment } from "@/types/types";
import type { Wallet } from "@/types/wallets";
import { hasFullAccess, isPartialSectionalOwner } from "@/lib/packages/access";
import {
  PACKAGE_PURCHASE_ACTION,
  PLATFORM_WALLET_ID,
  PLATFORM_WALLET_NAME,
} from "@/lib/packages/constants";

// ===== Result shapes =====

export type PackagePurchaseErrorCode =
  | "AUTH_FAILED"
  | "INVALID_INPUT"
  | "PACKAGE_NOT_FOUND"
  | "PACKAGE_NOT_ACTIVE"
  | "PACKAGE_UNAVAILABLE"
  | "ALREADY_OWNS_COURSE"
  | "OWN_COURSE"
  | "WALLET_NOT_FOUND"
  | "INSUFFICIENT_BALANCE"
  | "INTERNAL_ERROR";

export type PackagePurchaseSuccess = {
  success: true;
  saleId: string;
  txId: string;
  charged: number;
  newBalance: number;
  enrollmentIds: string[];
  isDuplicate: boolean;
};

export type PackagePurchaseFailure = {
  success: false;
  error: PackagePurchaseErrorCode;
  message: string;
  details?: unknown;
};

export type PackagePurchaseResult =
  | PackagePurchaseSuccess
  | PackagePurchaseFailure;

function fail(
  error: PackagePurchaseErrorCode,
  message: string,
  details?: unknown
): PackagePurchaseFailure {
  return { success: false, error, message, details };
}

// ===== Idempotency helper =====
//
// A `package_sales` row keyed to `(buyerId, protectionKey)` means this exact
// purchase already completed. On a hit we reconstruct the success shape from
// the stored doc and re-read the wallet for a fresh `newBalance`.
async function findExistingSale(
  buyerId: string,
  protectionKey: string
): Promise<{ id: string; data: FirebaseFirestore.DocumentData } | null> {
  const snap = await db
    .collection("package_sales")
    .where("buyerId", "==", buyerId)
    .where("protectionKey", "==", protectionKey)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, data: doc.data() };
}

async function readWalletBalance(userId: string): Promise<number> {
  const snap = await db.collection("wallets").doc(userId).get();
  if (!snap.exists) return 0;
  return (snap.data() as Wallet).balance ?? 0;
}

// True if a course is currently sellable inside a package: it exists, is not
// soft-deleted, and is approved. Any failure auto-pauses the whole package.
function isCourseAvailable(course: Course | undefined): boolean {
  return !!course && course.isDeleted !== true && course.isApproved === true;
}

// ===== purchasePackageWithWallet =====

export async function purchasePackageWithWallet(
  token: string,
  packageId: string,
  protectionKey: string
): Promise<PackagePurchaseResult> {
  // --- Branch 1: authentication ---
  let buyerId: string;
  try {
    const verified = await adminAuth.verifyIdToken(token);
    buyerId = verified.uid;
  } catch {
    return fail("AUTH_FAILED", "Authentication failed");
  }

  // --- Branch 2: input validation ---
  if (!packageId || typeof packageId !== "string") {
    return fail("INVALID_INPUT", "packageId is required");
  }
  if (!protectionKey || typeof protectionKey !== "string") {
    return fail("INVALID_INPUT", "protectionKey is required");
  }
  // Enforce the idempotency-key namespace server-side, so the
  // no-collision guarantee with course `purchase_*` keys does not depend
  // on the client behaving.
  if (!protectionKey.startsWith(`${PACKAGE_PURCHASE_ACTION}_`)) {
    return fail(
      "INVALID_INPUT",
      "protectionKey must be namespaced for package purchases"
    );
  }

  // --- Branch 3: idempotency short-circuit ---
  const existing = await findExistingSale(buyerId, protectionKey);
  if (existing) {
    const newBalance = await readWalletBalance(buyerId);
    return {
      success: true,
      saleId: existing.id,
      txId: existing.data.txId ?? "",
      charged: existing.data.pricePaid ?? 0,
      newBalance,
      enrollmentIds: Array.isArray(existing.data.enrollmentIds)
        ? (existing.data.enrollmentIds as string[])
        : [],
      isDuplicate: true,
    };
  }

  // --- Branch 4: load package, must exist and be active ---
  const packageSnap = await db.collection("packages").doc(packageId).get();
  if (!packageSnap.exists) {
    return fail("PACKAGE_NOT_FOUND", "Package not found");
  }
  const pkg = packageSnap.data() as CoursePackage | undefined;
  if (pkg?.status !== "active") {
    return fail("PACKAGE_NOT_ACTIVE", "This package is not available for sale");
  }

  const courseIds = Array.isArray(pkg.courseIds) ? pkg.courseIds : [];
  if (courseIds.length === 0) {
    return fail("PACKAGE_NOT_ACTIVE", "This package has no courses");
  }

  const price = pkg.price;
  if (typeof price !== "number" || price <= 0) {
    return fail("PACKAGE_NOT_ACTIVE", "This package has no valid price");
  }

  // --- Branch 5: auto-pause gate — every member course must be available ---
  const courseSnaps = await Promise.all(
    courseIds.map((id) => db.collection("courses").doc(id).get())
  );
  const courses: (Course | undefined)[] = courseSnaps.map((s) =>
    s.exists ? ({ id: s.id, ...s.data() } as Course) : undefined
  );
  const unavailableIds = courseIds.filter(
    (_id, i) => !isCourseAvailable(courses[i])
  );
  if (unavailableIds.length > 0) {
    return fail(
      "PACKAGE_UNAVAILABLE",
      "One or more courses in this package are no longer available",
      { unavailableCourseIds: unavailableIds }
    );
  }

  // --- Branch 6: buyer must not be the instructor of any included course ---
  const ownCourseIds = courseIds.filter(
    (_id, i) => courses[i]!.createdBy === buyerId
  );
  if (ownCourseIds.length > 0) {
    return fail("OWN_COURSE", "You cannot purchase a package with your own course", {
      ownCourseIds,
    });
  }

  // --- Branch 7: eligibility — buyer must NOT already have full access to
  //     any included course. Blocking is decided ONLY by `hasFullAccess`;
  //     partial section ownership does not block (it gets upgraded). ---
  const enrollmentSnaps = await Promise.all(
    courseIds.map((id) =>
      db.collection("enrollments").doc(`${buyerId}_${id}`).get()
    )
  );
  const enrollments: (Enrollment | undefined)[] = enrollmentSnaps.map((s) =>
    s.exists ? (s.data() as Enrollment) : undefined
  );
  const ownedCourseIds = courseIds.filter((_id, i) =>
    hasFullAccess(courses[i]!, enrollments[i])
  );
  if (ownedCourseIds.length > 0) {
    console.log(
      `package-purchase REJECTED buyerId=${buyerId} packageId=${packageId} reason=ALREADY_OWNS_COURSE courseIds=${ownedCourseIds.join(",")}`
    );
    return fail(
      "ALREADY_OWNS_COURSE",
      "You already have full access to one or more courses in this package",
      { ownedCourseIds }
    );
  }

  // --- Branch 8: the atomic transaction ---
  const nowIso = new Date().toISOString();
  try {
    const result = await db.runTransaction(async (transaction) => {
      const buyerWalletRef = db.collection("wallets").doc(buyerId);
      const platformWalletRef = db.collection("wallets").doc(PLATFORM_WALLET_ID);
      const packageRef = db.collection("packages").doc(packageId);
      const courseRefs = courseIds.map((id) =>
        db.collection("courses").doc(id)
      );
      const enrollmentRefs = courseIds.map((id) =>
        db.collection("enrollments").doc(`${buyerId}_${id}`)
      );

      // ----- All reads first (Firestore transaction rule) -----
      const [
        buyerWalletDoc,
        platformWalletDoc,
        packageDoc,
        courseDocs,
        enrollmentDocs,
      ] = await Promise.all([
        transaction.get(buyerWalletRef),
        transaction.get(platformWalletRef),
        transaction.get(packageRef),
        Promise.all(courseRefs.map((r) => transaction.get(r))),
        Promise.all(enrollmentRefs.map((r) => transaction.get(r))),
      ]);

      // ----- Re-validate everything inside the transaction -----
      // The package could have flipped inactive, a course could have been
      // deleted, or the buyer could have bought a course in the window
      // between the outer reads and now.
      const pkgTxn = packageDoc.data() as CoursePackage | undefined;
      if (pkgTxn?.status !== "active") {
        throw new Error("PACKAGE_NOT_ACTIVE");
      }

      const coursesTxn: Course[] = courseDocs.map((d, i) => {
        if (!d.exists) throw new Error("PACKAGE_UNAVAILABLE");
        const c = { id: courseIds[i], ...d.data() } as Course;
        if (!isCourseAvailable(c)) throw new Error("PACKAGE_UNAVAILABLE");
        return c;
      });

      const enrollmentsTxn: (Enrollment | undefined)[] = enrollmentDocs.map(
        (d) => (d.exists ? (d.data() as Enrollment) : undefined)
      );
      coursesTxn.forEach((c, i) => {
        if (hasFullAccess(c, enrollmentsTxn[i])) {
          throw new Error("ALREADY_OWNS_COURSE");
        }
      });

      if (!buyerWalletDoc.exists) {
        throw new Error("WALLET_NOT_FOUND");
      }
      const buyerWallet = buyerWalletDoc.data() as Wallet;
      if (buyerWallet.balance < price) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      // ----- Writes -----
      const newBalance = buyerWallet.balance - price;
      const pkgTitle =
        typeof pkgTxn.title === "string" && pkgTxn.title.length
          ? pkgTxn.title
          : packageId;

      // Buyer wallet debit.
      transaction.update(buyerWalletRef, {
        balance: newBalance,
        totalSpent: FieldValue.increment(price),
        updatedAt: nowIso,
      });

      // Platform wallet credit — the ONLY wallet a package sale credits.
      // Created on the fly on the first ever package sale.
      const platformBalanceBefore = platformWalletDoc.exists
        ? (platformWalletDoc.data() as Wallet).balance ?? 0
        : 0;
      if (platformWalletDoc.exists) {
        transaction.update(platformWalletRef, {
          balance: platformBalanceBefore + price,
          totalEarnings:
            ((platformWalletDoc.data() as Wallet).totalEarnings ?? 0) + price,
          updatedAt: nowIso,
        });
      } else {
        transaction.set(platformWalletRef, {
          userId: PLATFORM_WALLET_ID,
          userName: PLATFORM_WALLET_NAME,
          balance: price,
          totalEarnings: price,
          totalTopups: 0,
          totalSpent: 0,
          dailyLimit: 0,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }

      // One full-access enrollment per included course.
      const enrollmentIds: string[] = [];
      coursesTxn.forEach((course, i) => {
        const courseId = courseIds[i];
        const enrollmentId = `${buyerId}_${courseId}`;
        const enrollmentRef = enrollmentRefs[i];
        const hadEnrollment = enrollmentDocs[i].exists;
        enrollmentIds.push(enrollmentId);

        if (hadEnrollment) {
          // Upgrade an existing partial / pending enrollment to full.
          // We never reach here for an unset or already-'full' accessScope
          // — Branch 7 / the txn re-check blocked those. So this overwrite
          // is only ever the allowed sectional -> full upgrade.
          transaction.update(enrollmentRef, {
            accessScope: "full",
            ownedSectionIds: FieldValue.delete(),
            status: "completed",
            enrollmentType: "paid",
            paymentMethod: "wallet",
            sourcePackageId: packageId,
            updatedAt: nowIso,
          });
        } else {
          transaction.set(enrollmentRef, {
            userId: buyerId,
            courseId,
            status: "completed",
            enrollmentType: "paid",
            paymentMethod: "wallet",
            amount: 0, // money went to the package, not allocatable per course
            accessScope: "full",
            sourcePackageId: packageId,
            transactionId: protectionKey,
            enrolledAt: nowIso,
            createdAt: nowIso,
            updatedAt: nowIso,
          });
        }

        // Course-doc updates: lock all sections on a sectional course (the
        // package sells full access, i.e. every section), and bump
        // enrollmentCount only on a brand-new enrollment.
        const courseUpdate: Record<string, unknown> = { updatedAt: nowIso };
        if (course.purchaseMode === "sectional") {
          const sections = Array.isArray(course.sections)
            ? course.sections
            : [];
          courseUpdate.sections = sections.map((s) => ({
            ...s,
            isLocked: true,
          }));
        }
        if (!hadEnrollment) {
          courseUpdate.enrollmentCount = FieldValue.increment(1);
        }
        transaction.update(courseRefs[i], courseUpdate);
      });

      // Buyer ledger row — carries the protectionKey (idempotency marker).
      const buyerTxnRef = db.collection("wallet_transactions").doc();
      transaction.set(buyerTxnRef, {
        userId: buyerId,
        type: "purchase",
        amount: -price,
        balanceBefore: buyerWallet.balance,
        balanceAfter: newBalance,
        description: `شراء حزمة: ${pkgTitle}`,
        metadata: { packageId, packageTitle: pkgTxn.title ?? null },
        protectionKey,
        createdAt: nowIso,
      });

      // Platform ledger row — `package_revenue`, not `earning`.
      const platformTxnRef = db.collection("wallet_transactions").doc();
      transaction.set(platformTxnRef, {
        userId: PLATFORM_WALLET_ID,
        type: "package_revenue",
        amount: price,
        balanceBefore: platformBalanceBefore,
        balanceAfter: platformBalanceBefore + price,
        description: `إيراد حزمة: ${pkgTitle}`,
        metadata: { packageId, packageTitle: pkgTxn.title ?? null },
        protectionKey,
        createdAt: nowIso,
      });

      // Lock the package's course list at the first sale; bump saleCount.
      transaction.update(packageRef, {
        coursesLocked: true,
        saleCount: FieldValue.increment(1),
        updatedAt: nowIso,
      });

      // The sale record — audit trail AND owed-tally source. `payouts` is a
      // SNAPSHOT of the package's payout map at sale time.
      const saleRef = db.collection("package_sales").doc();
      transaction.set(saleRef, {
        packageId,
        buyerId,
        courseIds,
        pricePaid: price,
        payouts:
          pkgTxn.payouts && typeof pkgTxn.payouts === "object"
            ? pkgTxn.payouts
            : {},
        protectionKey,
        txId: buyerTxnRef.id,
        enrollmentIds,
        createdAt: nowIso,
      });

      return {
        saleId: saleRef.id,
        txId: buyerTxnRef.id,
        newBalance,
        enrollmentIds,
      };
    });

    console.log(
      `package-purchase issued buyerId=${buyerId} packageId=${packageId} charged=${price} saleId=${result.saleId} courses=${courseIds.length}`
    );

    return {
      success: true,
      saleId: result.saleId,
      txId: result.txId,
      charged: price,
      newBalance: result.newBalance,
      enrollmentIds: result.enrollmentIds,
      isDuplicate: false,
    };
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : "";
    const code: PackagePurchaseErrorCode =
      raw === "INSUFFICIENT_BALANCE"
        ? "INSUFFICIENT_BALANCE"
        : raw === "WALLET_NOT_FOUND"
          ? "WALLET_NOT_FOUND"
          : raw === "PACKAGE_NOT_ACTIVE"
            ? "PACKAGE_NOT_ACTIVE"
            : raw === "PACKAGE_UNAVAILABLE"
              ? "PACKAGE_UNAVAILABLE"
              : raw === "ALREADY_OWNS_COURSE"
                ? "ALREADY_OWNS_COURSE"
                : "INTERNAL_ERROR";
    const message =
      code === "INSUFFICIENT_BALANCE"
        ? "Insufficient wallet balance"
        : code === "WALLET_NOT_FOUND"
          ? "Wallet not found"
          : code === "PACKAGE_NOT_ACTIVE"
            ? "This package is no longer available for sale"
            : code === "PACKAGE_UNAVAILABLE"
              ? "One or more courses in this package are no longer available"
              : code === "ALREADY_OWNS_COURSE"
                ? "You already have full access to one or more courses in this package"
                : "Purchase failed";
    console.log(
      `package-purchase REJECTED buyerId=${buyerId} packageId=${packageId} reason=${code}`
    );
    return fail(code, message);
  }
}

// ===== getPackagePurchasePreview =====
//
// Read-only companion for the checkout dialog. Unlike the purchase action
// (which fails on the first problem), the preview reports EVERY issue at
// once so the dialog can render the full picture: which courses block the
// sale, and which sectional courses the buyer partially owns (the concrete
// partial-ownership disclosure).

export type PackagePreviewCourse = {
  courseId: string;
  title: string;
  instructorName: string | null;
};

// Why a package is not purchasable by this buyer. `null` = purchasable.
export type PackageBlockedReason =
  | "PACKAGE_NOT_ACTIVE"
  | "PACKAGE_UNAVAILABLE"
  | "ALREADY_OWNS_COURSE"
  | "OWN_COURSE"
  | null;

export type PackagePreviewResult =
  | {
      success: true;
      package: {
        id: string;
        title: string;
        description: string | null;
        price: number;
      };
      courses: PackagePreviewCourse[];
      walletBalance: number;
      // Eligibility — `purchasable` is false if the package is inactive /
      // unavailable, or the buyer owns or authored any included course.
      purchasable: boolean;
      blockedReason: PackageBlockedReason;
      // Titles of the courses that caused a block (for the dialog message).
      blockedCourseTitles: string[];
      // Sectional courses where the buyer owns SOME sections — a package
      // purchase upgrades them to full access with no refund. Drives the
      // concrete per-course disclosure line. Never overlaps a blocked
      // course (full owners are blocked; partial owners are not).
      partialOwnershipCourses: { courseId: string; title: string }[];
    }
  | {
      success: false;
      error: "AUTH_FAILED" | "INVALID_INPUT" | "PACKAGE_NOT_FOUND";
      message: string;
    };

export async function getPackagePurchasePreview(
  token: string,
  packageId: string
): Promise<PackagePreviewResult> {
  let buyerId: string;
  try {
    const verified = await adminAuth.verifyIdToken(token);
    buyerId = verified.uid;
  } catch {
    return { success: false, error: "AUTH_FAILED", message: "Authentication failed" };
  }

  if (!packageId || typeof packageId !== "string") {
    return { success: false, error: "INVALID_INPUT", message: "packageId is required" };
  }

  const packageSnap = await db.collection("packages").doc(packageId).get();
  if (!packageSnap.exists) {
    return { success: false, error: "PACKAGE_NOT_FOUND", message: "Package not found" };
  }
  const pkg = packageSnap.data() as CoursePackage;
  const courseIds = Array.isArray(pkg.courseIds) ? pkg.courseIds : [];

  const [courseSnaps, enrollmentSnaps, walletBalance] = await Promise.all([
    Promise.all(courseIds.map((id) => db.collection("courses").doc(id).get())),
    Promise.all(
      courseIds.map((id) =>
        db.collection("enrollments").doc(`${buyerId}_${id}`).get()
      )
    ),
    readWalletBalance(buyerId),
  ]);

  const courses: (Course | undefined)[] = courseSnaps.map((s) =>
    s.exists ? ({ id: s.id, ...s.data() } as Course) : undefined
  );
  const enrollments: (Enrollment | undefined)[] = enrollmentSnaps.map((s) =>
    s.exists ? (s.data() as Enrollment) : undefined
  );

  const previewCourses: PackagePreviewCourse[] = courseIds.map((id, i) => ({
    courseId: id,
    title: courses[i]?.title ?? id,
    instructorName: courses[i]?.instructorName ?? null,
  }));

  // Evaluate all blocking conditions; the first non-null reason wins for the
  // top-level message, but blockedCourseTitles collects every offender.
  let blockedReason: PackageBlockedReason = null;
  const blockedCourseTitles: string[] = [];
  const partialOwnershipCourses: { courseId: string; title: string }[] = [];

  if (pkg.status !== "active") {
    blockedReason = "PACKAGE_NOT_ACTIVE";
  }

  courseIds.forEach((id, i) => {
    const course = courses[i];

    // Unavailable course (missing / deleted / unapproved) — auto-pause gate.
    if (!isCourseAvailable(course)) {
      blockedReason = blockedReason ?? "PACKAGE_UNAVAILABLE";
      blockedCourseTitles.push(course?.title ?? id);
      return;
    }
    // Buyer authored this course.
    if (course!.createdBy === buyerId) {
      blockedReason = blockedReason ?? "OWN_COURSE";
      blockedCourseTitles.push(course!.title ?? id);
      return;
    }
    // Buyer already has full access — the ONLY eligibility-blocking check.
    if (hasFullAccess(course!, enrollments[i])) {
      blockedReason = blockedReason ?? "ALREADY_OWNS_COURSE";
      blockedCourseTitles.push(course!.title ?? id);
      return;
    }
    // Disclosure only — partial ownership never blocks. Kept strictly
    // separate from `hasFullAccess`.
    if (isPartialSectionalOwner(course!, enrollments[i])) {
      partialOwnershipCourses.push({ courseId: id, title: course!.title ?? id });
    }
  });

  return {
    success: true,
    package: {
      id: packageId,
      title: pkg.title,
      description: pkg.description ?? null,
      price: pkg.price,
    },
    courses: previewCourses,
    walletBalance,
    purchasable: blockedReason === null,
    blockedReason,
    blockedCourseTitles,
    partialOwnershipCourses,
  };
}

// ===== getPackagesForCourse =====
//
// Powers the course-page upsell banner: active packages that include
// `courseId` AND that this buyer could actually purchase. Packages the
// buyer is already ineligible for (owns/authored an included course, or a
// member course is unavailable) are filtered out so the banner never
// dangles an un-buyable offer. The checkout dialog re-runs the full,
// authoritative `getPackagePurchasePreview`.
//
// Scaling note: queries `packages` by `status` only and filters `courseIds`
// in memory — see "Known scaling limits" in docs/COURSE_PACKAGES.md.

export type CoursePackageSummary = {
  id: string;
  title: string;
  price: number;
  courseCount: number;
};

export async function getPackagesForCourse(
  token: string,
  courseId: string
): Promise<
  | { success: true; packages: CoursePackageSummary[] }
  | { success: false }
> {
  let buyerId: string;
  try {
    const verified = await adminAuth.verifyIdToken(token);
    buyerId = verified.uid;
  } catch {
    return { success: false };
  }
  if (!courseId || typeof courseId !== "string") {
    return { success: false };
  }

  try {
    const pkgSnap = await db
      .collection("packages")
      .where("status", "==", "active")
      .get();
    const candidates = pkgSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as CoursePackage))
      .filter(
        (p) => Array.isArray(p.courseIds) && p.courseIds.includes(courseId)
      );
    if (candidates.length === 0) {
      return { success: true, packages: [] };
    }

    // Batch-load every course + enrollment referenced across all candidates.
    const allCourseIds = [...new Set(candidates.flatMap((p) => p.courseIds))];
    const [courseSnaps, enrollmentSnaps] = await Promise.all([
      Promise.all(
        allCourseIds.map((id) => db.collection("courses").doc(id).get())
      ),
      Promise.all(
        allCourseIds.map((id) =>
          db.collection("enrollments").doc(`${buyerId}_${id}`).get()
        )
      ),
    ]);
    const courseMap = new Map<string, Course>();
    const enrollmentMap = new Map<string, Enrollment | undefined>();
    allCourseIds.forEach((id, i) => {
      if (courseSnaps[i].exists) {
        courseMap.set(id, { id, ...courseSnaps[i].data() } as Course);
      }
      enrollmentMap.set(
        id,
        enrollmentSnaps[i].exists
          ? (enrollmentSnaps[i].data() as Enrollment)
          : undefined
      );
    });

    const packages: CoursePackageSummary[] = [];
    for (const p of candidates) {
      const eligible = p.courseIds.every((cid) => {
        const c = courseMap.get(cid);
        if (!isCourseAvailable(c)) return false;
        if (c!.createdBy === buyerId) return false;
        return !hasFullAccess(c!, enrollmentMap.get(cid));
      });
      if (eligible) {
        packages.push({
          id: p.id,
          title: p.title,
          price: p.price,
          courseCount: p.courseIds.length,
        });
      }
    }
    return { success: true, packages };
  } catch (e) {
    console.error("getPackagesForCourse error", e);
    return { success: false };
  }
}
