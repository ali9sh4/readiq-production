import { NextRequest, NextResponse } from "next/server";
import { zaincash } from "@/lib/payments/zaincash";
import { db } from "@/firebase/service";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    const status = req.nextUrl.searchParams.get("status");

    if (!token) {
      return NextResponse.redirect(
        new URL("/payments/error?message=missing_token", req.url)
      );
    }

    // ✅ Verify token
    let verified;
    try {
      verified = zaincash.verifyToken(token);
    } catch (error) {
      console.error("Token verification failed:", error);
      return NextResponse.redirect(
        new URL("/payments/error?message=invalid_token", req.url)
      );
    }

    // ✅ NOW we can get operationId (after verification)
    const operationId = verified.operationId || verified.id;

    // ✅ Find PENDING enrollment
    const enrollmentsSnapshot = await db
      .collection("enrollments")
      .where("paymentId", "==", operationId)
      .where("status", "==", "pending")
      .get();

    if (enrollmentsSnapshot.empty) {
      console.error("No pending enrollment found for:", operationId);
      return NextResponse.redirect(
        new URL("/payments/error?message=enrollment_not_found", req.url)
      );
    }

    const enrollmentDoc = enrollmentsSnapshot.docs[0];
    const enrollmentData = enrollmentDoc.data();
    const courseId = enrollmentData.courseId;

    // ✅ Check payment status
    if (status === "success" || verified.status === "completed") {
      // ✅ Use transaction for atomic updates (MOVED HERE)
      await db.runTransaction(async (transaction) => {
        const enrollmentRef = enrollmentDoc.ref;
        const currentEnrollment = await transaction.get(enrollmentRef);

        // If already completed, don't process again
        if (currentEnrollment.data()?.status === "completed") {
          console.log("⚠️ Webhook already processed:", operationId);
          return;
        }

        // Update enrollment
        transaction.update(enrollmentRef, {
          status: "completed",
          enrolledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Update course count atomically
        const courseRef = db.collection("courses").doc(courseId);
        transaction.update(courseRef, {
          studentsEnrolled: FieldValue.increment(1),
          updatedAt: new Date().toISOString(),
        });
      });

      console.log(`✅ ZainCash payment completed: ${operationId}`);

      return NextResponse.redirect(
        new URL(`/Course/${courseId}?payment=success`, req.url)
      );
    } else {
      // ✅ Payment failed
      await enrollmentDoc.ref.update({
        status: "failed",
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.redirect(
        new URL(`/Course/${courseId}?payment=failed`, req.url)
      );
    }
  } catch (error: any) {
    console.error("ZainCash webhook error:", error);
    return NextResponse.redirect(
      new URL("/payments/error?message=processing_error", req.url)
    );
  }
}
