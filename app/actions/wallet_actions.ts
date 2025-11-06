// app/actions/wallet_actions.ts
"use server";

import { adminAuth, db } from "@/firebase/service";
import { FieldValue } from "firebase-admin/firestore";
import type { Wallet, WalletTransaction } from "@/types/wallets";

// ===== GET WALLET BALANCE =====
export async function getWalletBalance(token: string) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    const userId = verifiedToken.uid;

    const walletRef = db.collection("wallets").doc(userId);
    const walletDoc = await walletRef.get();

    if (walletDoc.exists) {
      return {
        success: true,
        balance: walletDoc.data()?.balance || 0,
        wallet: walletDoc.data() as Wallet,
      };
    }

    // Create new wallet if doesn't exist
    const newWallet: Wallet = {
      userId,
      balance: 0,
      totalTopups: 0,
      totalSpent: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
      dailyLimit: 10000000000, // 🔧 CHANGE THIS: Daily limit for new users
      isVerified: false,
    };

    await walletRef.set(newWallet);

    return { success: true, balance: 0, wallet: newWallet };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

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

    // 🔧 CHANGE THESE: Min/max amounts
    if (data.amount < 1000) {
      return { success: false, error: "الحد الأدنى للإيداع 1,000 د.ع" };
    }

    if (data.amount > 5000000) {
      return { success: false, error: "الحد الأقصى للإيداع 5,000,000 د.ع" };
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
      method: data.method,
      status: "pending",
      receiptUrl: data.receiptUrl,
      transactionId: data.transactionId,
      senderName: data.senderName,
      senderAccount: data.senderAccount,
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

// ===== PURCHASE COURSE WITH WALLET =====
export async function purchaseCourseWithWallet(
  token: string,
  courseId: string
) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    const userId = verifiedToken.uid;

    // Get course details
    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return { success: false, error: "الدورة غير موجودة" };
    }

    const courseData = courseDoc.data();
    const coursePrice = courseData?.price || 0;

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

    // ATOMIC TRANSACTION: Deduct wallet + create enrollment
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

      // Create enrollment
      const enrollmentRef = db.collection("enrollments").doc(enrollmentId);
      transaction.set(enrollmentRef, {
        userId,
        courseId,
        paymentMethod: "wallet",
        amount: coursePrice,
        status: "completed",
        enrolledAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Log transaction
      const txnRef = db.collection("wallet_transactions").doc();
      transaction.set(txnRef, {
        userId,
        type: "purchase",
        amount: -coursePrice,
        balanceBefore: wallet.balance,
        balanceAfter: newBalance,
        description: `شراء دورة: ${courseData?.title || courseId}`,
        metadata: { courseId, courseTitle: courseData?.title },
        createdAt: new Date().toISOString(),
      });

      // Update course enrollment count
      const courseRef = db.collection("courses").doc(courseId);
      transaction.update(courseRef, {
        studentsEnrolled: FieldValue.increment(1),
        updatedAt: new Date().toISOString(),
      });

      return { newBalance, enrollmentId };
    });

    return {
      success: true,
      enrollmentId: result.enrollmentId,
      newBalance: result.newBalance,
      message: "تم الشراء بنجاح!",
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
    const topupDoc = await topupRef.get();

    if (!topupDoc.exists) {
      return { success: false, error: "الطلب غير موجود" };
    }

    const topupData = topupDoc.data();

    if (topupData?.status !== "pending") {
      return { success: false, error: "الطلب تمت معالجته مسبقاً" };
    }

    // ATOMIC: Update wallet + update request + log transaction
    await db.runTransaction(async (transaction) => {
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
        description: `إيداع - ${topupData.method}`,
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
export async function getPendingTopupRequests(token: string) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    const userRecord = await adminAuth.getUser(verifiedToken.uid);

    const isAdmin =
      userRecord.customClaims?.admin ||
      process.env.FIREBASE_ADMIN_EMAIL === userRecord.email;

    if (!isAdmin) {
      return { success: false, error: "غير مصرح" };
    }

    const snapshot = await db
      .collection("topup_requests")
      .where("status", "==", "pending")
      .orderBy("createdAt", "asc")
      .limit(50)
      .get();

    const requests = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return { success: true, requests };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
// Add this to app/actions/wallet_actions.ts

export async function getWalletTransactions(token: string, limit: number = 20) {
  try {
    const verifiedToken = await adminAuth.verifyIdToken(token);
    const userId = verifiedToken.uid;

    const transactionsSnapshot = await db
      .collection("wallet_transactions")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const transactions: WalletTransaction[] = transactionsSnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        } as WalletTransaction)
    );

    return {
      success: true,
      transactions,
      hasMore: transactionsSnapshot.size === limit,
    };
  } catch (error: any) {
    console.error("getWalletTransactions error:", error);
    return {
      success: false,
      error: error.message || "فشل في جلب العمليات",
      transactions: [],
    };
  }
}
