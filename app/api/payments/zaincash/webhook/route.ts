import { NextRequest, NextResponse } from "next/server";
import { zaincash } from "@/lib/payments/zaincash";
import { db } from "@/firebase/service";
import { recordEarningInTransaction } from "@/lib/earnings/recordEarning";
import {
  computeAccessExpiresAt,
  readAccessDurationDays,
} from "@/lib/courses/accessDuration";

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
        const courseRef = db.collection("courses").doc(courseId);
        const currentEnrollment = await transaction.get(enrollmentRef);
        const courseDoc = await transaction.get(courseRef);

        // Prevent duplicate processing — this also makes the earning write
        // below idempotent: a replayed callback returns here and records
        // nothing twice.
        if (currentEnrollment.data()?.status === "completed") {
          console.log("⚠️ Already processed:", transactionId);
          return;
        }
        const courseData = courseDoc.data();
        const enr = currentEnrollment.data() ?? enrollmentData;

        // Read the instructor's user doc (a transaction read) before any
        // write, so the revenue split can be snapshotted atomically with
        // the enrollment completing. A card sale is real cash into the
        // platform's account that it owes the instructor.
        const buyerId = (enr?.userId as string | undefined) ?? "";
        const instructorId = courseData?.createdBy as string | undefined;
        const grossAmount = Number(enr?.amount ?? 0);
        const shouldRecordEarning =
          !!instructorId && instructorId !== buyerId && grossAmount > 0;
        const instructorUserDoc = shouldRecordEarning
          ? await transaction.get(db.collection("users").doc(instructorId!))
          : null;

        // Time-limited access: snapshot the course's duration onto the
        // enrollment as it completes. Access starts now — the moment the
        // payment lands, not when the pending doc was created.
        const durationDays = readAccessDurationDays(courseData);

        transaction.update(enrollmentRef, {
          status: "completed",
          enrolledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          transactionId: transactionId,
          ...(durationDays
            ? { accessExpiresAt: computeAccessExpiresAt(durationDays) }
            : {}),
        });

        transaction.update(courseRef, {
          enrollmentCount: (courseData?.enrollmentCount || 0) + 1,
          updatedAt: new Date().toISOString(),
        });

        if (shouldRecordEarning && instructorUserDoc) {
          recordEarningInTransaction({
            transaction,
            instructorId: instructorId!,
            instructorDocSnap: instructorUserDoc,
            grossAmount,
            courseId,
            enrollmentId: enrollmentDoc.id,
            buyerId,
            source: "zaincash",
          });
        }
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
        new URL(`/course/${courseId}?payment=success`, req.url)
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
        new URL(`/course/${courseId}?payment=failed`, req.url)
      );
    } else if (finalStatus === "pending") {
      // ⏳ Still pending (rare)
      console.log(`⏳ Payment pending: ${transactionId}`);

      return NextResponse.redirect(
        new URL(`/course/${courseId}?payment=pending`, req.url)
      );
    } else {
      // ⚠️ Unknown status
      console.warn(`⚠️ Unknown status: ${finalStatus}`);

      return NextResponse.redirect(
        new URL(`/course/${courseId}?payment=unknown`, req.url)
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
