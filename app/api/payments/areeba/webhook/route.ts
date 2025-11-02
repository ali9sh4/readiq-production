import { NextRequest, NextResponse } from "next/server";
import { areeba } from "@/lib/payments/areeba";
import { db } from "@/firebase/firebaseAdmin";

// ✅ Areeba sends GET request to webhook after payment
export async function GET(req: NextRequest) {
  try {
    const orderId = req.nextUrl.searchParams.get("orderId");
    const sessionId = req.nextUrl.searchParams.get("sessionId");
    const resultIndicator = req.nextUrl.searchParams.get("resultIndicator");

    if (!orderId && !sessionId) {
      return NextResponse.redirect(
        new URL("/payment/error?message=missing_params", req.url)
      );
    }

    // ✅ Find PENDING enrollment by sessionId or orderId
    let enrollmentsSnapshot;

    if (sessionId) {
      enrollmentsSnapshot = await db
        .collection("enrollments")
        .where("paymentId", "==", sessionId)
        .where("status", "==", "pending")
        .get();
    } else if (orderId) {
      enrollmentsSnapshot = await db
        .collection("enrollments")
        .where("orderId", "==", orderId)
        .where("status", "==", "pending")
        .get();
    }

    if (!enrollmentsSnapshot || enrollmentsSnapshot.empty) {
      console.error("No pending enrollment found");
      return NextResponse.redirect(
        new URL("/payment/error?message=enrollment_not_found", req.url)
      );
    }

    const enrollmentDoc = enrollmentsSnapshot.docs[0];
    const enrollmentData = enrollmentDoc.data();
    const courseId = enrollmentData.courseId;

    // ✅ Check transaction status from Areeba
    let transactionStatus;
    try {
      transactionStatus = await areeba.getTransactionStatus(
        enrollmentData.orderId
      );
    } catch (error) {
      console.error("Failed to get Areeba status:", error);
      return NextResponse.redirect(
        new URL(`/Course/${courseId}?payment=error`, req.url)
      );
    }

    // ✅ Check if payment successful
    const isSuccess =
      transactionStatus.result === "SUCCESS" ||
      transactionStatus.status === "CAPTURED" ||
      resultIndicator === "SUCCESS";

    if (isSuccess) {
      // ✅ Update enrollment to COMPLETED
      await enrollmentDoc.ref.update({
        status: "completed",
        enrolledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // ✅ Increment course students count (optional)
      const courseRef = db.collection("courses").doc(courseId);
      const courseDoc = await courseRef.get();
      if (courseDoc.exists) {
        const currentCount = courseDoc.data()?.studentsEnrolled || 0;
        await courseRef.update({
          studentsEnrolled: currentCount + 1,
          updatedAt: new Date().toISOString(),
        });
      }

      console.log(`✅ Areeba payment completed: ${orderId}`);

      // ✅ Redirect to course page (your page will show CoursePlayer)
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
    console.error("Areeba webhook error:", error);
    return NextResponse.redirect(
      new URL("/payment/error?message=processing_error", req.url)
    );
  }
}
