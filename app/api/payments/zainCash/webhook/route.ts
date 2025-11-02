import { NextRequest, NextResponse } from "next/server";
import { zaincash } from "@/lib/payments/zaincash";
import { db } from "@/firebase/service";

// ✅ ZainCash sends GET request to webhook
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    const status = req.nextUrl.searchParams.get("status");

    if (!token) {
      return NextResponse.redirect(
        new URL("/payment/error?message=missing_token", req.url)
      );
    }

    // ✅ Verify token using library
    let verified;
    try {
      verified = zaincash.verifyToken(token);
    } catch (error) {
      console.error("Token verification failed:", error);
      return NextResponse.redirect(
        new URL("/payment/error?message=invalid_token", req.url)
      );
    }

    const operationId = verified.operationId || verified.id;

    // ✅ Find PENDING enrollment by paymentId
    const enrollmentsSnapshot = await db
      .collection("enrollments")
      .where("paymentId", "==", operationId)
      .where("status", "==", "pending")
      .get();

    if (enrollmentsSnapshot.empty) {
      console.error("No pending enrollment found for:", operationId);
      return NextResponse.redirect(
        new URL("/payment/error?message=enrollment_not_found", req.url)
      );
    }

    const enrollmentDoc = enrollmentsSnapshot.docs[0];
    const enrollmentData = enrollmentDoc.data();
    const courseId = enrollmentData.courseId;

    // ✅ Check payment status
    if (status === "success" || verified.status === "completed") {
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

      console.log(`✅ ZainCash payment completed: ${operationId}`);

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
    console.error("ZainCash webhook error:", error);
    return NextResponse.redirect(
      new URL("/payment/error?message=processing_error", req.url)
    );
  }
}
