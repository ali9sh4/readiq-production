import { NextRequest, NextResponse } from "next/server";
import { zaincash } from "@/lib/payments/zaincash";
import { db } from "@/firebase/service";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(
        new URL("/payments/error?message=missing_token", req.url)
      );
    }

    // ✅ 1. Verify and decode token
    let verified;
    try {
      verified = zaincash.verifyToken(token);
    } catch (error) {
      console.error("Token verification failed:", error);
      return NextResponse.redirect(
        new URL("/payments/error?message=invalid_token", req.url)
      );
    }

    // ✅ 2. Extract data (handle both cases)
    const transactionId = verified.id;
    const orderId = verified.orderid || verified.orderId; // Handle both cases
    const callbackStatus = verified.status;

    console.log("ZainCash callback received:", {
      transactionId,
      orderId,
      callbackStatus,
    });

    // ✅ 3. Optional: Double-check with server (RECOMMENDED for production)
    let finalStatus = callbackStatus;
    try {
      const serverCheck = await zaincash.getTransactionStatus(transactionId);
      const serverStatus = serverCheck.status;

      console.log("Server verification:", { serverStatus });

      // If mismatch, trust server
      if (serverStatus !== callbackStatus) {
        console.warn(
          `⚠️ Status mismatch! Callback: ${callbackStatus}, Server: ${serverStatus}`
        );
        finalStatus = serverStatus; // Trust server
      }
    } catch (error) {
      console.error("Server verification failed:", error);
      // Continue with callback status
    }

    // ✅ 4. Find enrollment
    const enrollmentsSnapshot = await db
      .collection("enrollments")
      .where("paymentId", "==", transactionId)
      .where("status", "==", "pending")
      .get();

    if (enrollmentsSnapshot.empty) {
      console.error("No pending enrollment found for:", transactionId);
      return NextResponse.redirect(
        new URL("/payments/error?message=enrollment_not_found", req.url)
      );
    }

    const enrollmentDoc = enrollmentsSnapshot.docs[0];
    const enrollmentData = enrollmentDoc.data();
    const courseId = enrollmentData.courseId;

    // ✅ 5. Process payment based on status
    // ✅ 5. Process payment based on status
    if (finalStatus === "success" || finalStatus === "completed") {
      // ✅ Payment successful
      await db.runTransaction(async (transaction) => {
        const enrollmentRef = enrollmentDoc.ref;
        const currentEnrollment = await transaction.get(enrollmentRef);

        // Prevent duplicate processing
        if (currentEnrollment.data()?.status === "completed") {
          console.log("⚠️ Already processed:", transactionId);
          return;
        }

        // Update enrollment
        transaction.update(enrollmentRef, {
          status: "completed",
          enrolledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          transactionId: transactionId,
        });

        // ✅ FIX: Update course count with correct field name
        const courseRef = db.collection("courses").doc(courseId);
        const courseDoc = await transaction.get(courseRef);
        const courseData = courseDoc.data();

        transaction.update(courseRef, {
          enrollmentCount: (courseData?.enrollmentCount || 0) + 1, // ✅ Consistent field name
          updatedAt: new Date().toISOString(),
        });
      });

      // ✅ Update audit log
      await db
        .collection("payment_transactions")
        .where("paymentId", "==", transactionId)
        .get()
        .then((snapshot) => {
          if (!snapshot.empty) {
            snapshot.docs[0].ref.update({
              status: "completed",
              completedAt: new Date().toISOString(),
            });
          }
        });

      console.log(`✅ Payment completed: ${transactionId}`);

      return NextResponse.redirect(
        new URL(`/Course/${courseId}?payment=success`, req.url)
      );
    } else if (finalStatus === "failed") {
      // ❌ Payment failed
      await enrollmentDoc.ref.update({
        status: "failed",
        updatedAt: new Date().toISOString(),
        transactionId: transactionId,
      });

      // Update audit log
      await db
        .collection("payment_transactions")
        .where("paymentId", "==", transactionId)
        .get()
        .then((snapshot) => {
          if (!snapshot.empty) {
            snapshot.docs[0].ref.update({
              status: "failed",
              failedAt: new Date().toISOString(),
            });
          }
        });

      console.log(`❌ Payment failed: ${transactionId}`);

      return NextResponse.redirect(
        new URL(`/Course/${courseId}?payment=failed`, req.url)
      );
    } else if (finalStatus === "pending") {
      // ⏳ Still pending (rare)
      console.log(`⏳ Payment pending: ${transactionId}`);

      return NextResponse.redirect(
        new URL(`/Course/${courseId}?payment=pending`, req.url)
      );
    } else {
      // ⚠️ Unknown status
      console.warn(`⚠️ Unknown status: ${finalStatus}`);

      return NextResponse.redirect(
        new URL(`/Course/${courseId}?payment=unknown`, req.url)
      );
    }
  } catch (error: any) {
    console.error("ZainCash callback error:", {
      message: error.message,
      stack: error.stack,
    });

    return NextResponse.redirect(
      new URL("/payments/error?message=processing_error", req.url)
    );
  }
}
