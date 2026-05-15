// Sectional wallet purchase actions (Phase 3).
//
// Two server-side entry points for buying a course in 'sectional' purchase
// mode: `purchaseSectionsWithWallet` (per-section) and
// `purchaseBundleWithWallet` (whole-course bundle on a sectional course).
// The legacy `purchaseCourseWithWallet` continues to handle full-mode
// courses; the two paths are mutually exclusive at the course level.
//
// The pure pricing helpers (`computeSmartSubtractPrice`,
// `computeBundleBreakEven`) live in `lib/sectional/pricing.ts` — this file
// carries "use server", so it can only export async server actions.
//
// Idempotency uses the same `protectionKey` pattern as
// `purchaseCourseWithWallet`: a row in `wallet_transactions` keyed by
// `(userId, protectionKey)` short-circuits replays. Phase 4's ZainCash
// webhook will replay through these same entry points and rely on this.
//
// Error envelope differs intentionally from `purchaseCourseWithWallet`'s
// `{ error: <localized string> }` shape: sectional code returns
// `{ success: false, error: <code>, message: <human>, details? }` so
// Phase 6's UI can switch on the code.
"use server";

import { adminAuth, db } from "@/firebase/service";
import { FieldValue } from "firebase-admin/firestore";
import type { Course, CourseSection } from "@/types/types";
import type { Wallet } from "@/types/wallets";

// ===== Result shape =====

export type PurchaseSuccess = {
  success: true;
  txId: string;
  charged: number;
  newBalance: number;
  ownedSectionIds?: string[];
  accessScope: "full" | "sectional";
  isDuplicate: boolean;
};

export type PurchaseFailure = {
  success: false;
  error: PurchaseErrorCode;
  message: string;
  details?: unknown;
};

export type PurchaseResult = PurchaseSuccess | PurchaseFailure;

export type PurchaseErrorCode =
  | "AUTH_FAILED"
  | "INVALID_INPUT"
  | "COURSE_NOT_FOUND"
  | "COURSE_NOT_SECTIONAL"
  | "INVALID_SECTION_ID"
  | "ALREADY_FULL_ACCESS"
  | "ALL_SECTIONS_ALREADY_OWNED"
  | "SECTION_NOT_PRICEABLE"
  | "BUNDLE_PRICE_NOT_SET"
  | "INSUFFICIENT_BALANCE"
  | "OWN_COURSE"
  | "MISSING_INSTRUCTOR"
  | "INTERNAL_ERROR";

function fail(
  error: PurchaseErrorCode,
  message: string,
  details?: unknown
): PurchaseFailure {
  return { success: false, error, message, details };
}

// ===== Idempotency helper =====
//
// Phase 3 stores the protectionKey on every wallet_transactions row written
// (buyer + instructor sides). To detect replays, we look for any row keyed
// to (userId, protectionKey). On hit, we reconstruct the original return
// shape from the stored metadata. We deliberately do not return wallet
// state from the cached row alone — we re-read the wallet to give the
// caller a fresh `newBalance`. (The original row's `balanceAfter` is
// correct as of that write, but the wallet may have moved since.)
async function findExistingTxn(
  userId: string,
  protectionKey: string
): Promise<{ id: string; data: FirebaseFirestore.DocumentData } | null> {
  const snap = await db
    .collection("wallet_transactions")
    .where("userId", "==", userId)
    .where("protectionKey", "==", protectionKey)
    .where("type", "==", "purchase")
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, data: doc.data() };
}

async function readWalletBalance(userId: string): Promise<number> {
  const snap = await db.collection("wallets").doc(userId).get();
  if (!snap.exists) return 0;
  const data = snap.data() as Wallet;
  return data.balance ?? 0;
}

// ===== purchaseSectionsWithWallet =====

export async function purchaseSectionsWithWallet(
  token: string,
  courseId: string,
  sectionIds: string[],
  protectionKey: string
): Promise<PurchaseResult> {
  let userId: string;
  try {
    const verified = await adminAuth.verifyIdToken(token);
    userId = verified.uid;
  } catch {
    return fail("AUTH_FAILED", "Authentication failed");
  }

  // Input validation.
  if (!Array.isArray(sectionIds) || sectionIds.length === 0) {
    return fail("INVALID_INPUT", "sectionIds must be a non-empty array");
  }
  if (sectionIds.some((id) => typeof id !== "string" || id.length === 0)) {
    return fail("INVALID_INPUT", "every sectionId must be a non-empty string");
  }
  const uniqueSectionIds = Array.from(new Set(sectionIds));
  if (uniqueSectionIds.length !== sectionIds.length) {
    return fail("INVALID_INPUT", "sectionIds contains duplicates");
  }
  if (!protectionKey || typeof protectionKey !== "string") {
    return fail("INVALID_INPUT", "protectionKey is required");
  }

  // Idempotency short-circuit.
  const existing = await findExistingTxn(userId, protectionKey);
  if (existing) {
    const meta = existing.data.metadata ?? {};
    const newBalance = await readWalletBalance(userId);
    return {
      success: true,
      txId: existing.id,
      charged: Math.abs(existing.data.amount ?? 0),
      newBalance,
      ownedSectionIds: Array.isArray(meta.ownedSectionIdsAfter)
        ? (meta.ownedSectionIdsAfter as string[])
        : undefined,
      accessScope: "sectional",
      isDuplicate: true,
    };
  }

  // Load course + early validation.
  const courseSnap = await db.collection("courses").doc(courseId).get();
  if (!courseSnap.exists) {
    return fail("COURSE_NOT_FOUND", "Course not found");
  }
  const courseData = courseSnap.data() as Course | undefined;

  if (courseData?.purchaseMode !== "sectional") {
    return fail(
      "COURSE_NOT_SECTIONAL",
      "This course is not in sectional purchase mode"
    );
  }

  const allSections = Array.isArray(courseData.sections)
    ? courseData.sections
    : [];
  const allSectionIds = new Set(allSections.map((s) => s.sectionId));
  const invalidIds = uniqueSectionIds.filter((id) => !allSectionIds.has(id));
  if (invalidIds.length > 0) {
    return fail("INVALID_SECTION_ID", "Unknown sectionId(s)", { invalidIds });
  }

  const instructorId = courseData.createdBy;
  if (!instructorId) {
    return fail("MISSING_INSTRUCTOR", "Course is missing instructor metadata");
  }
  if (instructorId === userId) {
    return fail("OWN_COURSE", "You cannot purchase your own course");
  }

  // Load enrollment + branch on access state.
  const enrollmentId = `${userId}_${courseId}`;
  const enrollmentRef = db.collection("enrollments").doc(enrollmentId);
  const enrollmentSnap = await enrollmentRef.get();
  const enrollmentData = enrollmentSnap.exists ? enrollmentSnap.data() : null;
  const hadPriorEnrollment = enrollmentSnap.exists;

  if (
    enrollmentData &&
    enrollmentData.status === "completed" &&
    enrollmentData.accessScope !== "sectional"
  ) {
    // accessScope is 'full' or unset (legacy full access) — refuse the
    // per-section purchase. Phase 6 will hide the CTA; this is the defensive
    // server-side gate.
    console.log(
      `wallet-purchase-sections REJECTED userId=${userId} courseId=${courseId} reason=ALREADY_FULL_ACCESS`
    );
    return fail(
      "ALREADY_FULL_ACCESS",
      "You already have full access to this course"
    );
  }

  const ownedBefore: string[] = Array.isArray(enrollmentData?.ownedSectionIds)
    ? (enrollmentData!.ownedSectionIds as string[])
    : [];
  const ownedSet = new Set(ownedBefore);

  // Smart-subtract at the API boundary.
  const toBuy = uniqueSectionIds.filter((id) => !ownedSet.has(id));
  if (toBuy.length === 0) {
    console.log(
      `wallet-purchase-sections REJECTED userId=${userId} courseId=${courseId} reason=ALL_SECTIONS_ALREADY_OWNED attemptedSectionIds=${uniqueSectionIds.join(",")}`
    );
    return fail(
      "ALL_SECTIONS_ALREADY_OWNED",
      "You already own every requested section"
    );
  }

  // Compute price from authoritative course sections.
  const sectionsById = new Map<string, CourseSection>(
    allSections.map((s) => [s.sectionId, s])
  );
  const unpriceableIds: string[] = [];
  let totalPrice = 0;
  for (const id of toBuy) {
    const s = sectionsById.get(id)!;
    const effective = s.salePrice ?? s.price;
    if (typeof effective !== "number" || effective <= 0) {
      unpriceableIds.push(id);
      continue;
    }
    totalPrice += effective;
  }
  if (unpriceableIds.length > 0) {
    return fail(
      "SECTION_NOT_PRICEABLE",
      "One or more sections have no usable price",
      { unpriceableIds }
    );
  }

  // Run the atomic transaction.
  try {
    const result = await db.runTransaction(async (transaction) => {
      const walletRef = db.collection("wallets").doc(userId);
      const instructorWalletRef = db.collection("wallets").doc(instructorId);
      const courseRef = db.collection("courses").doc(courseId);

      // Reads.
      const [walletDoc, instructorWalletDoc, courseDocTxn] = await Promise.all(
        [
          transaction.get(walletRef),
          transaction.get(instructorWalletRef),
          transaction.get(courseRef),
        ]
      );

      if (!walletDoc.exists) {
        throw new Error("WALLET_NOT_FOUND");
      }
      const wallet = walletDoc.data() as Wallet;
      if (wallet.balance < totalPrice) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const courseDataTxn = courseDocTxn.data() as Course | undefined;
      // Defensive re-check inside the transaction; the course could have
      // flipped out of sectional mode between the outer read and now.
      if (courseDataTxn?.purchaseMode !== "sectional") {
        throw new Error("COURSE_NOT_SECTIONAL");
      }
      const sectionsTxn = Array.isArray(courseDataTxn.sections)
        ? courseDataTxn.sections
        : [];

      const newBalance = wallet.balance - totalPrice;
      const nowIso = new Date().toISOString();

      // Writes — buyer wallet debit.
      transaction.update(walletRef, {
        balance: newBalance,
        totalSpent: FieldValue.increment(totalPrice),
        updatedAt: nowIso,
      });

      // Writes — instructor wallet credit (create on the fly if needed,
      // matching purchaseCourseWithWallet's pattern: no platform fee).
      const instructorBalanceBefore = instructorWalletDoc.exists
        ? (instructorWalletDoc.data() as Wallet).balance ?? 0
        : 0;
      if (instructorWalletDoc.exists) {
        transaction.update(instructorWalletRef, {
          balance: instructorBalanceBefore + totalPrice,
          totalEarnings:
            ((instructorWalletDoc.data() as Wallet).totalEarnings ?? 0) +
            totalPrice,
          updatedAt: nowIso,
        });
      } else {
        transaction.set(instructorWalletRef, {
          userId: instructorId,
          userName: courseDataTxn?.instructorName ?? "مدرب",
          balance: totalPrice,
          totalEarnings: totalPrice,
          totalTopups: 0,
          totalSpent: 0,
          dailyLimit: 5000000,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }

      const ownedAfter = Array.from(new Set([...ownedBefore, ...toBuy]));
      const txTitle =
        typeof courseDataTxn?.title === "string" && courseDataTxn.title.length
          ? courseDataTxn.title
          : courseId;

      // Writes — buyer transaction ledger row (carries protectionKey, the
      // idempotency marker).
      const buyerTxnRef = db.collection("wallet_transactions").doc();
      transaction.set(buyerTxnRef, {
        userId,
        type: "purchase",
        amount: -totalPrice,
        balanceBefore: wallet.balance,
        balanceAfter: newBalance,
        description: `شراء أقسام من دورة: ${txTitle}`,
        metadata: {
          courseId,
          courseTitle: courseDataTxn?.title ?? null,
          enrollmentId,
          sectionIds: toBuy,
          isSectionalPurchase: true,
          ownedSectionIdsAfter: ownedAfter,
        },
        protectionKey,
        createdAt: nowIso,
      });

      // Writes — instructor earning ledger row.
      const instructorTxnRef = db.collection("wallet_transactions").doc();
      transaction.set(instructorTxnRef, {
        userId: instructorId,
        type: "earning",
        amount: totalPrice,
        balanceBefore: instructorBalanceBefore,
        balanceAfter: instructorBalanceBefore + totalPrice,
        description: `إيراد من بيع أقسام دورة: ${txTitle}`,
        metadata: {
          courseId,
          courseTitle: courseDataTxn?.title ?? null,
          enrollmentId,
          studentId: userId,
          sectionIds: toBuy,
          isSectionalPurchase: true,
        },
        protectionKey,
        createdAt: nowIso,
      });

      // Writes — enrollment upsert.
      if (hadPriorEnrollment) {
        transaction.update(enrollmentRef, {
          ownedSectionIds: FieldValue.arrayUnion(...toBuy),
          totalSpent: FieldValue.increment(totalPrice),
          accessScope: "sectional",
          status: "completed",
          updatedAt: nowIso,
        });
      } else {
        transaction.set(enrollmentRef, {
          userId,
          courseId,
          status: "completed",
          enrollmentType: "paid",
          paymentMethod: "wallet",
          amount: totalPrice,
          totalSpent: totalPrice,
          accessScope: "sectional",
          ownedSectionIds: toBuy,
          transactionId: protectionKey,
          enrolledAt: nowIso,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }

      // Writes — course mutation: mark purchased sections isLocked + bump
      // enrollmentCount only on first access. Reads `sectionsTxn` we already
      // pulled inside the transaction, so concurrent edits to other parts
      // of the doc won't stomp us.
      const toBuySet = new Set(toBuy);
      const nextSections = sectionsTxn.map((s) =>
        toBuySet.has(s.sectionId) ? { ...s, isLocked: true } : s
      );
      const courseUpdate: Record<string, unknown> = {
        sections: nextSections,
        updatedAt: nowIso,
      };
      if (!hadPriorEnrollment) {
        courseUpdate.enrollmentCount = FieldValue.increment(1);
      }
      transaction.update(courseRef, courseUpdate);

      return {
        txId: buyerTxnRef.id,
        newBalance,
        ownedAfter,
      };
    });

    console.log(
      `wallet-purchase-sections issued userId=${userId} courseId=${courseId} sectionIds=${toBuy.join(",")} totalPrice=${totalPrice} txId=${result.txId}`
    );

    return {
      success: true,
      txId: result.txId,
      charged: totalPrice,
      newBalance: result.newBalance,
      ownedSectionIds: result.ownedAfter,
      accessScope: "sectional",
      isDuplicate: false,
    };
  } catch (err: any) {
    const code: PurchaseErrorCode =
      err?.message === "INSUFFICIENT_BALANCE"
        ? "INSUFFICIENT_BALANCE"
        : err?.message === "COURSE_NOT_SECTIONAL"
          ? "COURSE_NOT_SECTIONAL"
          : "INTERNAL_ERROR";
    const message =
      code === "INSUFFICIENT_BALANCE"
        ? "Insufficient wallet balance"
        : code === "COURSE_NOT_SECTIONAL"
          ? "Course is no longer in sectional purchase mode"
          : "Purchase failed";
    console.log(
      `wallet-purchase-sections REJECTED userId=${userId} courseId=${courseId} reason=${code} attemptedSectionIds=${toBuy.join(",")}`
    );
    return fail(code, message);
  }
}

// ===== purchaseBundleWithWallet =====

export async function purchaseBundleWithWallet(
  token: string,
  courseId: string,
  protectionKey: string
): Promise<PurchaseResult> {
  let userId: string;
  try {
    const verified = await adminAuth.verifyIdToken(token);
    userId = verified.uid;
  } catch {
    return fail("AUTH_FAILED", "Authentication failed");
  }

  if (!protectionKey || typeof protectionKey !== "string") {
    return fail("INVALID_INPUT", "protectionKey is required");
  }

  // Idempotency short-circuit.
  const existing = await findExistingTxn(userId, protectionKey);
  if (existing) {
    const newBalance = await readWalletBalance(userId);
    return {
      success: true,
      txId: existing.id,
      charged: Math.abs(existing.data.amount ?? 0),
      newBalance,
      accessScope: "full",
      isDuplicate: true,
    };
  }

  // Load course.
  const courseSnap = await db.collection("courses").doc(courseId).get();
  if (!courseSnap.exists) {
    return fail("COURSE_NOT_FOUND", "Course not found");
  }
  const courseData = courseSnap.data() as Course | undefined;

  if (courseData?.purchaseMode !== "sectional") {
    return fail(
      "COURSE_NOT_SECTIONAL",
      "Bundle purchase is only for sectional courses; use purchaseCourseWithWallet for full-mode courses"
    );
  }

  const fullPrice = courseData.fullCoursePrice;
  if (typeof fullPrice !== "number" || fullPrice <= 0) {
    return fail("BUNDLE_PRICE_NOT_SET", "Bundle price is not set");
  }

  const instructorId = courseData.createdBy;
  if (!instructorId) {
    return fail("MISSING_INSTRUCTOR", "Course is missing instructor metadata");
  }
  if (instructorId === userId) {
    return fail("OWN_COURSE", "You cannot purchase your own course");
  }

  // Load enrollment + branch.
  const enrollmentId = `${userId}_${courseId}`;
  const enrollmentRef = db.collection("enrollments").doc(enrollmentId);
  const enrollmentSnap = await enrollmentRef.get();
  const enrollmentData = enrollmentSnap.exists ? enrollmentSnap.data() : null;
  const hadPriorEnrollment = enrollmentSnap.exists;

  // Defensive double-charge prevention: already has full access in any
  // form (explicit bundle buyer, or legacy unset).
  if (
    enrollmentData &&
    enrollmentData.status === "completed" &&
    enrollmentData.accessScope !== "sectional"
  ) {
    console.log(
      `wallet-purchase-bundle REJECTED userId=${userId} courseId=${courseId} reason=ALREADY_FULL_ACCESS`
    );
    return fail(
      "ALREADY_FULL_ACCESS",
      "You already have full access to this course"
    );
  }

  const priorSpent: number =
    typeof enrollmentData?.totalSpent === "number"
      ? enrollmentData.totalSpent
      : 0;
  // Bundle break-even: charge the delta. Can be 0 (free upgrade) if the
  // user already spent enough on individual sections.
  const charge = Math.max(0, fullPrice - priorSpent);

  // Run the atomic transaction.
  try {
    const result = await db.runTransaction(async (transaction) => {
      const walletRef = db.collection("wallets").doc(userId);
      const instructorWalletRef = db.collection("wallets").doc(instructorId);
      const courseRef = db.collection("courses").doc(courseId);

      const [walletDoc, instructorWalletDoc, courseDocTxn] = await Promise.all(
        [
          transaction.get(walletRef),
          transaction.get(instructorWalletRef),
          transaction.get(courseRef),
        ]
      );

      const courseDataTxn = courseDocTxn.data() as Course | undefined;
      if (courseDataTxn?.purchaseMode !== "sectional") {
        throw new Error("COURSE_NOT_SECTIONAL");
      }

      let wallet: Wallet | null = null;
      if (charge > 0) {
        if (!walletDoc.exists) {
          throw new Error("WALLET_NOT_FOUND");
        }
        wallet = walletDoc.data() as Wallet;
        if (wallet.balance < charge) {
          throw new Error("INSUFFICIENT_BALANCE");
        }
      }

      const nowIso = new Date().toISOString();
      const newBalance = wallet !== null ? wallet.balance - charge : 0;

      // Buyer wallet debit (skip if charge === 0; nothing moves).
      if (charge > 0 && wallet) {
        transaction.update(walletRef, {
          balance: newBalance,
          totalSpent: FieldValue.increment(charge),
          updatedAt: nowIso,
        });
      }

      // Instructor wallet credit (skip if charge === 0).
      const instructorBalanceBefore = instructorWalletDoc.exists
        ? (instructorWalletDoc.data() as Wallet).balance ?? 0
        : 0;
      if (charge > 0) {
        if (instructorWalletDoc.exists) {
          transaction.update(instructorWalletRef, {
            balance: instructorBalanceBefore + charge,
            totalEarnings:
              ((instructorWalletDoc.data() as Wallet).totalEarnings ?? 0) +
              charge,
            updatedAt: nowIso,
          });
        } else {
          transaction.set(instructorWalletRef, {
            userId: instructorId,
            userName: courseDataTxn?.instructorName ?? "مدرب",
            balance: charge,
            totalEarnings: charge,
            totalTopups: 0,
            totalSpent: 0,
            dailyLimit: 5000000,
            createdAt: nowIso,
            updatedAt: nowIso,
          });
        }
      }

      const txTitle =
        typeof courseDataTxn?.title === "string" && courseDataTxn.title.length
          ? courseDataTxn.title
          : courseId;

      // Always write a buyer ledger row, even for amount: 0 — keeps the
      // protectionKey indexed and gives an audit trail for the upgrade.
      const buyerTxnRef = db.collection("wallet_transactions").doc();
      transaction.set(buyerTxnRef, {
        userId,
        type: "purchase",
        amount: -charge,
        balanceBefore: wallet?.balance ?? 0,
        balanceAfter: newBalance,
        description:
          charge > 0
            ? `شراء حزمة كاملة من دورة: ${txTitle}`
            : `ترقية مجانية إلى الحزمة الكاملة من دورة: ${txTitle}`,
        metadata: {
          courseId,
          courseTitle: courseDataTxn?.title ?? null,
          enrollmentId,
          isSectionalPurchase: false,
          isBundlePurchase: true,
          upgradeFromSectional: hadPriorEnrollment,
          fullCoursePrice: fullPrice,
        },
        protectionKey,
        createdAt: nowIso,
      });

      // Instructor ledger row only when there was actual money movement.
      if (charge > 0) {
        const instructorTxnRef = db.collection("wallet_transactions").doc();
        transaction.set(instructorTxnRef, {
          userId: instructorId,
          type: "earning",
          amount: charge,
          balanceBefore: instructorBalanceBefore,
          balanceAfter: instructorBalanceBefore + charge,
          description: `إيراد من بيع حزمة كاملة من دورة: ${txTitle}`,
          metadata: {
            courseId,
            courseTitle: courseDataTxn?.title ?? null,
            enrollmentId,
            studentId: userId,
            isBundlePurchase: true,
          },
          protectionKey,
          createdAt: nowIso,
        });
      }

      // Enrollment upsert — accessScope flips to 'full', ownedSectionIds
      // is deleted (full access supersedes the per-section list).
      if (hadPriorEnrollment) {
        transaction.update(enrollmentRef, {
          accessScope: "full",
          ownedSectionIds: FieldValue.delete(),
          totalSpent: FieldValue.increment(charge),
          status: "completed",
          updatedAt: nowIso,
        });
      } else {
        transaction.set(enrollmentRef, {
          userId,
          courseId,
          status: "completed",
          enrollmentType: "paid",
          paymentMethod: "wallet",
          amount: charge,
          totalSpent: charge,
          accessScope: "full",
          transactionId: protectionKey,
          enrolledAt: nowIso,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }

      // Lock every section on the course — the bundle counts as selling
      // each one. Also bump enrollmentCount on first access only.
      const sectionsTxn = Array.isArray(courseDataTxn.sections)
        ? courseDataTxn.sections
        : [];
      const lockedSections = sectionsTxn.map((s) => ({ ...s, isLocked: true }));
      const courseUpdate: Record<string, unknown> = {
        sections: lockedSections,
        updatedAt: nowIso,
      };
      if (!hadPriorEnrollment) {
        courseUpdate.enrollmentCount = FieldValue.increment(1);
      }
      transaction.update(courseRef, courseUpdate);

      return { txId: buyerTxnRef.id, newBalance };
    });

    console.log(
      `wallet-purchase-bundle issued userId=${userId} courseId=${courseId} charged=${charge} priorSpent=${priorSpent} fullPrice=${fullPrice} txId=${result.txId}`
    );

    return {
      success: true,
      txId: result.txId,
      charged: charge,
      newBalance: result.newBalance,
      accessScope: "full",
      isDuplicate: false,
    };
  } catch (err: any) {
    const code: PurchaseErrorCode =
      err?.message === "INSUFFICIENT_BALANCE"
        ? "INSUFFICIENT_BALANCE"
        : err?.message === "COURSE_NOT_SECTIONAL"
          ? "COURSE_NOT_SECTIONAL"
          : "INTERNAL_ERROR";
    const message =
      code === "INSUFFICIENT_BALANCE"
        ? "Insufficient wallet balance"
        : code === "COURSE_NOT_SECTIONAL"
          ? "Course is no longer in sectional purchase mode"
          : "Purchase failed";
    console.log(
      `wallet-purchase-bundle REJECTED userId=${userId} courseId=${courseId} reason=${code}`
    );
    return fail(code, message);
  }
}
