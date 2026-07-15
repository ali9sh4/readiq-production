// app/actions/wallet_actions.ts
"use server";

import { adminAuth, db } from "@/firebase/service";
import { FieldValue } from "firebase-admin/firestore";
import type { TopupRequest, Wallet, WalletTransaction } from "@/types/wallets";
import { recordEarningInTransaction } from "@/lib/earnings/recordEarning";
import {
  computeAccessExpiresAt,
  readAccessDurationDays,
} from "@/lib/courses/accessDuration";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 h"),
  analytics: true,
  prefix: "topup_request",
});

// ===== CREATE TOPUP REQUEST =====
export async function createTopupRequest(
  token: string,
  data: {
    amount: number;
    senderName?: string;
  }
) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    const userId = verifiedToken.uid;
    const userRecord = await adminAuth.getUser(userId);
    const { success: rateLimitOk } = await ratelimit.limit(userId);

    if (!rateLimitOk) {
      return {
        success: false,
        error: "لقد تجاوزت الحد المسموح. حاول مرة أخرى لاحقاً",
      };
    }
    if (data.amount < 1000) {
      return { success: false, error: "الحد الأدنى للإيداع 1,000 د.ع" };
    }

    if (data.amount > 5000000) {
      return { success: false, error: "الحد الأقصى للإيداع 5,000,000 د.ع" };
    }
    const walletRef = db.collection("wallets").doc(userId);
    const walletSnap = await walletRef.get();
    if (!walletSnap.exists) {
      const newWallet: Wallet = {
        userName: userRecord.displayName || "مستخدم",
        userId,
        balance: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dailyLimit: 5000000,
        totalTopups: 0,
        totalSpent: 0,
      };

      await walletRef.set(newWallet);
    }

    // Check for pending requests
    const pendingSnapshot = await db
      .collection("topup_requests")
      .where("userId", "==", userId)
      .where("status", "==", "pending")
      .get();

    if (!pendingSnapshot.empty) {
      return {
        success: false,
        error: "لديك طلب إيداع قيد المراجعة",
      };
    }

    // Create topup request
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

    const topupRequest = {
      userId,
      userEmail: userRecord.email || "",
      userName: userRecord.displayName || "مستخدم",
      amount: data.amount,
      status: "pending",
      source: "manual" as const,
      senderName: data.senderName,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await db.collection("topup_requests").add(topupRequest);

    return {
      success: true,
      topupRequest: { id: docRef.id, ...topupRequest },
      message: "تم إرسال طلب الإيداع",
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function purchaseCourseWithWallet(
  token: string,
  courseId: string,
  protectionKey: string // ← ADD THIS PARAMETER
) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    const userId = verifiedToken.uid;

    // ✅ STEP 1: Check if this idempotency key was already used
    const existingTxnSnapshot = await db
      .collection("wallet_transactions")
      .where("userId", "==", userId)
      .where("protectionKey", "==", protectionKey)
      .limit(1)
      .get();

    if (!existingTxnSnapshot.empty) {
      // This transaction was already processed!
      const existingTxn = existingTxnSnapshot.docs[0].data();

      // Return the original successful result
      return {
        success: true,
        enrollmentId: existingTxn.metadata?.enrollmentId,
        newBalance: existingTxn.balanceAfter,
        message: "تم الشراء بالفعل", // "Already purchased"
        isDuplicate: true, // ← Flag so client knows this was a duplicate
      };
    }

    // Get course details
    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return { success: false, error: "الدورة غير موجودة" };
    }

    const courseData = courseDoc.data();

    // M1 (docs/AUDIT_SYSTEM_HEALTH.md): sectional courses must never sell
    // through this legacy full-course path — `course.price` is not their
    // price, and the enrollment written below carries no `accessScope`,
    // which the video gate treats as full access. Same refusal code as
    // POST /api/enrollments.
    if (courseData?.purchaseMode === "sectional") {
      console.log(
        `wallet-purchase REJECTED userId=${userId} courseId=${courseId} reason=COURSE_NOT_SECTIONAL`
      );
      return { success: false, error: "هذه الدورة تُباع بالأقسام" };
    }

    // ✅ FIX: Check for sale price first, then regular price
    let coursePrice = courseData?.price || 0;
    const salePrice = courseData?.salePrice ?? 0;
    if (salePrice > 0 && salePrice < coursePrice) {
      coursePrice = salePrice;
    }

    if (courseData?.isFree) {
      return { success: false, error: "هذه دورة مجانية" };
    }

    // M1 (docs/AUDIT_SYSTEM_HEALTH.md): a course with no usable price must
    // never be purchasable for 0 IQD — the write boundary validates price
    // as min(0) and optional, so unpriced docs can exist.
    if (coursePrice <= 0) {
      console.log(
        `wallet-purchase REJECTED userId=${userId} courseId=${courseId} reason=COURSE_PRICE_NOT_SET`
      );
      return { success: false, error: "سعر الدورة غير محدد" };
    }

    // Check existing enrollment. Time-limited enrollments (accessExpiresAt
    // set) are re-purchasable — a renewal re-stamps the SAME doc inside the
    // transaction below (expired → now + duration; before expiry →
    // max(now, current expiry) + duration). Lifetime enrollments reject as
    // before: there is nothing to sell.
    const enrollmentId = `${userId}_${courseId}`;
    const existingEnrollment = await db
      .collection("enrollments")
      .doc(enrollmentId)
      .get();

    if (
      existingEnrollment.exists &&
      existingEnrollment.data()?.status === "completed" &&
      typeof existingEnrollment.data()?.accessExpiresAt !== "string"
    ) {
      return { success: false, error: "أنت مسجل بالفعل في هذه الدورة" };
    }

    // ✅ ATOMIC TRANSACTION with idempotency key
    // ✅ ATOMIC TRANSACTION with idempotency key
    const result = await db.runTransaction(async (transaction) => {
      // ===== STEP 1: DO ALL READS FIRST =====
      const walletRef = db.collection("wallets").doc(userId);
      const walletDoc = await transaction.get(walletRef);

      const instructorId = courseData?.createdBy;
      if (!instructorId) {
        throw new Error("معلومات المدرب غير موجودة");
      }

      // Prevent buying your own course
      if (instructorId === userId) {
        throw new Error("لا يمكنك شراء دورتك الخاصة");
      }

      // Read the instructor's user doc — needed to snapshot the revenue
      // split at sale time. Read here, before any write, per Firestore's
      // reads-before-writes rule.
      const instructorUserRef = db.collection("users").doc(instructorId);
      const instructorUserDoc = await transaction.get(instructorUserRef);

      // Re-read the enrollment inside the transaction so the renewal
      // branch (time-limited access) is decided against current state,
      // not the pre-check read.
      const enrollmentRef = db.collection("enrollments").doc(enrollmentId);
      const enrollmentTxnDoc = await transaction.get(enrollmentRef);
      const enrollmentTxnData = enrollmentTxnDoc.exists
        ? enrollmentTxnDoc.data()
        : null;
      const currentExpiresAt =
        typeof enrollmentTxnData?.accessExpiresAt === "string"
          ? (enrollmentTxnData.accessExpiresAt as string)
          : null;
      const isRenewal =
        enrollmentTxnData?.status === "completed" && currentExpiresAt !== null;

      if (enrollmentTxnData?.status === "completed" && !isRenewal) {
        // Race: a lifetime enrollment completed between the pre-check and
        // this transaction. Nothing to sell.
        throw new Error("أنت مسجل بالفعل في هذه الدورة");
      }

      // ===== STEP 2: VALIDATE DATA =====
      if (!walletDoc.exists) {
        throw new Error("المحفظة غير موجودة");
      }

      const wallet = walletDoc.data() as Wallet;

      if (wallet.balance < coursePrice) {
        throw new Error(
          `رصيد غير كافٍ. رصيدك: ${wallet.balance.toLocaleString("en-US")} د.ع`
        );
      }

      const newBalance = wallet.balance - coursePrice;

      // ===== STEP 3: NOW DO ALL WRITES =====

      // Update buyer's wallet
      transaction.update(walletRef, {
        balance: newBalance,
        totalSpent: FieldValue.increment(coursePrice),
        updatedAt: new Date().toISOString(),
      });

      // Instructor earning. A sale is a cash payable the platform owes the
      // instructor, NOT spendable platform credit — so this appends an
      // immutable entry to the instructor's earnings ledger and bumps
      // `earningsTotal`, instead of crediting their spend wallet. (The old
      // code credited `wallets/{instructorId}` and wrote a `type:"earning"`
      // wallet_transactions row; both were removed here.)
      recordEarningInTransaction({
        transaction,
        instructorId,
        instructorDocSnap: instructorUserDoc,
        grossAmount: coursePrice,
        courseId,
        enrollmentId,
        buyerId: userId,
        source: "wallet",
      });

      // Time-limited access stamp, snapshotted from the course at THIS
      // purchase (instructor edits never touch existing stamps).
      const durationDays = readAccessDurationDays(courseData);

      if (isRenewal) {
        // Renewal: re-stamp the SAME enrollment doc — never a duplicate,
        // never a full overwrite (keeps enrolledAt/createdAt history).
        // Course cleared back to lifetime since they bought → remove the
        // stamp; otherwise extend from max(now, current expiry).
        transaction.update(enrollmentRef, {
          accessExpiresAt: durationDays
            ? computeAccessExpiresAt(durationDays, currentExpiresAt)
            : FieldValue.delete(),
          totalSpent: FieldValue.increment(coursePrice),
          transactionId: protectionKey,
          updatedAt: new Date().toISOString(),
        });
      } else {
        // Create enrollment
        transaction.set(enrollmentRef, {
          userId,
          courseId,
          paymentMethod: "wallet",
          enrollmentType: "paid",
          amount: coursePrice,
          status: "completed",
          enrolledAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          transactionId: protectionKey,
          ...(durationDays
            ? { accessExpiresAt: computeAccessExpiresAt(durationDays) }
            : {}),
        });
      }

      // Log buyer's transaction
      const txnRef = db.collection("wallet_transactions").doc();
      transaction.set(txnRef, {
        userId,
        type: "purchase",
        amount: -coursePrice,
        balanceBefore: wallet.balance,
        balanceAfter: newBalance,
        description: `شراء دورة: ${courseData?.title || courseId}`,
        metadata: {
          courseId,
          courseTitle: courseData?.title,
          enrollmentId,
        },
        protectionKey: protectionKey,
        createdAt: new Date().toISOString(),
      });

      // Update course enrollment count — a renewal is the same student,
      // not a new enrollment; don't double-count.
      if (!isRenewal) {
        const courseRef = db.collection("courses").doc(courseId);
        transaction.update(courseRef, {
          enrollmentCount: FieldValue.increment(1),
          updatedAt: new Date().toISOString(),
        });
      }

      return { newBalance, enrollmentId };
    });

    return {
      success: true,
      enrollmentId: result.enrollmentId,
      newBalance: result.newBalance,
      message: "تم الشراء بنجاح!",
      isDuplicate: false,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
// ===== APPROVE TOPUP (ADMIN ONLY) =====
export async function approveTopupRequest(
  token: string,
  topupRequestId: string,
  adminNotes?: string
) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    const adminUser = await adminAuth.getUser(verifiedToken.uid);

    const isAdmin =
      adminUser.customClaims?.admin ||
      process.env.FIREBASE_ADMIN_EMAIL === adminUser.email;

    if (!isAdmin) {
      return { success: false, error: "غير مصرح" };
    }

    const topupRef = db.collection("topup_requests").doc(topupRequestId);

    // ATOMIC: Update wallet + update request + log transaction
    await db.runTransaction(async (transaction) => {
      const topupDoc = await transaction.get(topupRef);

      if (!topupDoc.exists) {
        throw new Error("الطلب غير موجود");
      }

      const topupData = topupDoc.data();

      // ✅ Check status INSIDE transaction (prevents race condition)
      if (topupData?.status !== "pending") {
        throw new Error("الطلب تمت معالجته مسبقاً");
      }
      const walletRef = db.collection("wallets").doc(topupData.userId);
      const walletDoc = await transaction.get(walletRef);

      if (!walletDoc.exists) {
        throw new Error("المحفظة غير موجودة");
      }

      const wallet = walletDoc.data() as Wallet;
      const newBalance = wallet.balance + topupData.amount;

      // Update wallet
      transaction.update(walletRef, {
        balance: newBalance,
        totalTopups: FieldValue.increment(topupData.amount),
        updatedAt: new Date().toISOString(),
      });

      // Update request
      transaction.update(topupRef, {
        status: "approved",
        processedBy: adminUser.uid,
        processedAt: new Date().toISOString(),
        adminNotes: adminNotes || "",
        updatedAt: new Date().toISOString(),
      });

      // Log transaction
      const txnRef = db.collection("wallet_transactions").doc();
      transaction.set(txnRef, {
        userId: topupData.userId,
        type: "topup",
        amount: topupData.amount,
        balanceBefore: wallet.balance,
        balanceAfter: newBalance,
        description: `إيداع `,
        metadata: { topupRequestId },
        createdAt: new Date().toISOString(),
      });
    });

    return { success: true, message: "تمت الموافقة" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ===== MANUAL DIRECT TOP-UP (ADMIN ONLY) =====
// Credits a user's wallet immediately by email — no receipt, no review queue.
// Separate from the receipt-approval flow (approveTopupRequest), which stays
// as-is. Mirrors approveTopupRequest's atomic credit block; the difference is
// it resolves the user by email and has no topup_requests doc to gate on.
export async function adminManualTopup(
  token: string,
  data: { email: string; amount: number; reason?: string }
): Promise<
  | { success: true; userId: string; newBalance: number; message: string }
  | { success: false; error: string }
> {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    const adminUser = await adminAuth.getUser(verifiedToken.uid);

    const isAdmin =
      adminUser.customClaims?.admin ||
      process.env.FIREBASE_ADMIN_EMAIL === adminUser.email;

    if (!isAdmin) {
      return { success: false, error: "غير مصرح" };
    }

    // Validate amount: positive whole-dinar number. Rejects 0, negatives,
    // NaN, Infinity, and non-numeric input.
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, error: "المبلغ غير صالح" };
    }
    if (!Number.isInteger(amount)) {
      return { success: false, error: "المبلغ يجب أن يكون رقماً صحيحاً" };
    }
    if (amount > 5000000) {
      return { success: false, error: "الحد الأقصى للإيداع 5,000,000 د.ع" };
    }

    const normalizedEmail = (data.email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      return { success: false, error: "يرجى إدخال البريد الإلكتروني" };
    }

    // Resolve email -> uid via Firebase Auth (source of truth; Google-only).
    let targetUser;
    try {
      targetUser = await adminAuth.getUserByEmail(normalizedEmail);
    } catch (err: any) {
      if (err?.code === "auth/user-not-found") {
        return { success: false, error: "لا يوجد حساب بهذا البريد الإلكتروني" };
      }
      if (err?.code === "auth/invalid-email") {
        return { success: false, error: "البريد الإلكتروني غير صالح" };
      }
      throw err;
    }

    const targetUserId = targetUser.uid;
    const reason = (data.reason || "").trim();

    // ATOMIC: credit wallet + log transaction. Same shape as approveTopupRequest;
    // provisions the wallet if it doesn't exist yet (mirrors the ZainCash callback).
    const newBalance = await db.runTransaction(async (transaction) => {
      const walletRef = db.collection("wallets").doc(targetUserId);
      const walletDoc = await transaction.get(walletRef);
      const nowIso = new Date().toISOString();

      const balanceBefore = walletDoc.exists
        ? (walletDoc.data() as Wallet).balance ?? 0
        : 0;
      const updatedBalance = balanceBefore + amount;

      if (walletDoc.exists) {
        transaction.update(walletRef, {
          balance: updatedBalance,
          totalTopups: FieldValue.increment(amount),
          updatedAt: nowIso,
        });
      } else {
        const newWallet: Wallet = {
          userId: targetUserId,
          userName: targetUser.displayName || "مستخدم",
          balance: updatedBalance,
          totalTopups: amount,
          totalSpent: 0,
          dailyLimit: 5000000,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        transaction.set(walletRef, newWallet);
      }

      const txnRef = db.collection("wallet_transactions").doc();
      transaction.set(txnRef, {
        userId: targetUserId,
        type: "topup",
        amount,
        balanceBefore,
        balanceAfter: updatedBalance,
        description: "إيداع يدوي من الإدارة",
        metadata: {
          source: "manual_admin",
          adminId: adminUser.uid,
          ...(reason ? { reason } : {}),
        },
        createdAt: nowIso,
      });

      return updatedBalance;
    });

    return {
      success: true,
      userId: targetUserId,
      newBalance,
      message: "تم شحن المحفظة",
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ===== REJECT TOPUP (ADMIN ONLY) =====
export async function rejectTopupRequest(
  token: string,
  topupRequestId: string,
  rejectionReason: string
) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    const adminUser = await adminAuth.getUser(verifiedToken.uid);

    const isAdmin =
      adminUser.customClaims?.admin ||
      process.env.FIREBASE_ADMIN_EMAIL === adminUser.email;

    if (!isAdmin) {
      return { success: false, error: "غير مصرح" };
    }

    const topupRef = db.collection("topup_requests").doc(topupRequestId);
    const topupDoc = await topupRef.get();

    if (!topupDoc.exists) {
      return { success: false, error: "الطلب غير موجود" };
    }
    const topupData = topupDoc.data();
    if (topupData?.status !== "pending") {
      return { success: false, error: "الطلب تمت معالجته مسبقاً" };
    }

    await topupRef.update({
      status: "rejected",
      rejectionReason,
      processedBy: adminUser.uid,
      processedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return { success: true, message: "تم رفض الطلب" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ===== GET PENDING REQUESTS (ADMIN) =====
export async function getPendingTopupRequests(
  token: string,
  limit: number = 50,
  lastDocId?: string
) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    const userRecord = await adminAuth.getUser(verifiedToken.uid);

    const isAdmin =
      userRecord.customClaims?.admin ||
      process.env.FIREBASE_ADMIN_EMAIL === userRecord.email;

    if (!isAdmin) {
      return { success: false, error: "غير مصرح" };
    }

    let topupsQuery = db
      .collection("topup_requests")
      .where("status", "==", "pending")
      .orderBy("createdAt", "asc")
      .limit(limit);

    if (lastDocId) {
      const lastDoc = await db
        .collection("topup_requests")
        .doc(lastDocId)
        .get();

      if (lastDoc.exists) {
        topupsQuery = topupsQuery.startAfter(lastDoc);
      }
    }

    const snapshot = await topupsQuery.get();

    const requests: TopupRequest[] = snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        } as TopupRequest)
    );

    const lastVisible = snapshot.docs[snapshot.docs.length - 1];

    return {
      success: true,
      requests,
      hasMore: snapshot.size === limit,
      lastDocId: lastVisible?.id || null,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
export async function getPendingTopupRequestsUSER(token: string) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    const userId = verifiedToken.uid;
    const snapshot = await db
      .collection("topup_requests")
      .where("userId", "==", userId)
      .where("status", "==", "pending")
      .limit(20)
      .get();

    const PendingTransactions: TopupRequest[] = snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        } as TopupRequest)
    );

    return { success: true, PendingTransactions };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
// Add this to app/actions/wallet_actions.ts

export async function getWalletTransactions(
  token: string,
  limit: number = 20,
  lastDocId?: string // ← Cursor for pagination
) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    const userId = verifiedToken.uid;

    let transactionsQuery = db
      .collection("wallet_transactions")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(limit);

    // If cursor provided, start after that document
    if (lastDocId) {
      const lastDoc = await db
        .collection("wallet_transactions")
        .doc(lastDocId)
        .get();

      if (lastDoc.exists) {
        transactionsQuery = transactionsQuery.startAfter(lastDoc);
      }
    }

    const transactionsSnapshot = await transactionsQuery.get();

    const transactions: WalletTransaction[] = transactionsSnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        } as WalletTransaction)
    );

    // Get last document ID for next page
    const lastVisible =
      transactionsSnapshot.docs[transactionsSnapshot.docs.length - 1];

    return {
      success: true,
      transactions,
      hasMore: transactionsSnapshot.size === limit,
      lastDocId: lastVisible?.id || null,
    };
  } catch (error: any) {
    console.error("getWalletTransactions error:", error);
    return {
      success: false,
      error: error.message || "فشل في جلب العمليات",
      transactions: [],
      hasMore: false,
      lastDocId: null,
    };
  }
}
