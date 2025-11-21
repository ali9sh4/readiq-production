// app/actions/wallet_actions.ts
"use server";

import { adminAuth, db } from "@/firebase/service";
import { FieldValue } from "firebase-admin/firestore";
import type { TopupRequest, Wallet, WalletTransaction } from "@/types/wallets";
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

    // ✅ FIX: Check for sale price first, then regular price
    let coursePrice = courseData?.price || 0;
    const salePrice = courseData?.salePrice ?? 0;
    if (salePrice > 0 && salePrice < coursePrice) {
      coursePrice = salePrice;
    }

    if (courseData?.isFree) {
      return { success: false, error: "هذه دورة مجانية" };
    }

    // Check existing enrollment
    const enrollmentId = `${userId}_${courseId}`;
    const existingEnrollment = await db
      .collection("enrollments")
      .doc(enrollmentId)
      .get();

    if (
      existingEnrollment.exists &&
      existingEnrollment.data()?.status === "completed"
    ) {
      return { success: false, error: "أنت مسجل بالفعل في هذه الدورة" };
    }

    // ✅ ATOMIC TRANSACTION with idempotency key
    const result = await db.runTransaction(async (transaction) => {
      const walletRef = db.collection("wallets").doc(userId);
      const walletDoc = await transaction.get(walletRef);

      if (!walletDoc.exists) {
        throw new Error("المحفظة غير موجودة");
      }

      const wallet = walletDoc.data() as Wallet;

      if (wallet.balance < coursePrice) {
        throw new Error(
          `رصيد غير كافٍ. رصيدك: ${wallet.balance.toLocaleString()} د.ع`
        );
      }

      const newBalance = wallet.balance - coursePrice;

      // Update wallet
      transaction.update(walletRef, {
        balance: newBalance,
        totalSpent: FieldValue.increment(coursePrice),
        updatedAt: new Date().toISOString(),
      });
      // ===== TRANSFER TO INSTRUCTOR =====
      const instructorId = courseData?.createdBy;
      if (!instructorId) {
        throw new Error("معلومات المدرب غير موجودة");
      }

      // Prevent buying your own course
      if (instructorId === userId) {
        throw new Error("لا يمكنك شراء دورتك الخاصة");
      }

      // Get or create instructor wallet
      const instructorWalletRef = db.collection("wallets").doc(instructorId);
      const instructorWalletDoc = await transaction.get(instructorWalletRef);

      if (instructorWalletDoc.exists) {
        // Update existing wallet
        const instructorWallet = instructorWalletDoc.data() as Wallet;
        transaction.update(instructorWalletRef, {
          balance: instructorWallet.balance + coursePrice,
          totalEarnings: (instructorWallet.totalEarnings || 0) + coursePrice,
          updatedAt: new Date().toISOString(),
        });
      } else {
        // Create new wallet for instructor
        transaction.set(instructorWalletRef, {
          userId: instructorId,
          userName: courseData?.instructorName || "مدرب",
          balance: coursePrice,
          totalEarnings: coursePrice,
          totalTopups: 0,
          totalSpent: 0,
          dailyLimit: 5000000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // Log instructor earning transaction
      const instructorTxnRef = db.collection("wallet_transactions").doc();
      transaction.set(instructorTxnRef, {
        userId: instructorId,
        type: "earning",
        amount: coursePrice,
        balanceBefore: instructorWalletDoc.exists
          ? instructorWalletDoc.data()?.balance || 0
          : 0,
        balanceAfter:
          (instructorWalletDoc.exists
            ? instructorWalletDoc.data()?.balance || 0
            : 0) + coursePrice,
        description: `إيراد من بيع دورة: ${courseData?.title || courseId}`,
        metadata: {
          courseId,
          courseTitle: courseData?.title,
          enrollmentId,
          studentId: userId,
        },
        createdAt: new Date().toISOString(),
      });

      // Create enrollment
      const enrollmentRef = db.collection("enrollments").doc(enrollmentId);
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
        transactionId: protectionKey, // ← Store reference
      });

      // Log transaction WITH idempotency key
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

      // Update course enrollment count
      const courseRef = db.collection("courses").doc(courseId);
      transaction.update(courseRef, {
        enrollmentCount: FieldValue.increment(1),
        updatedAt: new Date().toISOString(),
      });

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
