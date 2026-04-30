import { NextRequest, NextResponse } from "next/server";
import { db } from "@/firebase/service";
import { verifyBearerToken } from "@/lib/auth/verifyBearerToken";
import { fail, handleApiError, ok } from "@/lib/api/response";
import { isCoursePubliclyVisible } from "@/lib/courses/visibility";
import { generateProtectionKey } from "@/lib/purchaseProtection/protectionKey";
import { purchaseCourseWithWallet } from "@/app/actions/wallet_actions";
import { enrollInFreeCourse } from "@/app/actions/enrollment_action";
import { createEnrollmentBody } from "@/lib/validation/api/enrollments";
import type { Wallet } from "@/types/wallets";

// Mobile enrollment endpoint. Thin wrapper around the existing
// `purchaseCourseWithWallet` (paid) and `enrollInFreeCourse` (free) server
// actions. The transaction semantics in those actions are the source of
// truth for both web and mobile — this route does pre-flight checks for
// clean error codes, then delegates.
//
// Pre-flight (404/409/402 short-circuits) covers the common cases without
// any race-prone behavior; the underlying transaction still re-validates
// inside Firestore. The post-call error mapping handles the residual race
// window where state changed between our reads and the transaction.
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyBearerToken(req);
    const { courseId } = createEnrollmentBody.parse(await req.json());

    // 1. Course must exist and be publicly visible.
    const courseSnap = await db.collection("courses").doc(courseId).get();
    if (!courseSnap.exists) {
      return fail("COURSE_NOT_FOUND", "Course not found", 404);
    }
    const course = courseSnap.data()!;
    if (!isCoursePubliclyVisible(course)) {
      return fail("COURSE_NOT_FOUND", "Course not found", 404);
    }

    const enrollmentId = `${auth.userId}_${courseId}`;

    // 2. Already enrolled? Return the existing enrollment shape so mobile
    //    can navigate to the player without re-purchasing.
    const existingEnrollment = await db
      .collection("enrollments")
      .doc(enrollmentId)
      .get();
    if (
      existingEnrollment.exists &&
      existingEnrollment.data()?.status === "completed"
    ) {
      console.error(
        `enrollment-purchase userId=${auth.userId} courseId=${courseId} ALREADY_ENROLLED`
      );
      return alreadyEnrolledResponse(enrollmentId, courseId, existingEnrollment.data()!);
    }

    // 3. Effective price — sale only when set, > 0, and strictly cheaper.
    const rawPrice = Number(course.price ?? 0);
    const rawSale = Number(course.salePrice ?? 0);
    const effectivePrice =
      rawSale > 0 && rawSale < rawPrice ? rawSale : rawPrice;
    const isFree = course.isFree === true || effectivePrice === 0;

    // 4. Free path — delegate to enrollInFreeCourse.
    if (isFree) {
      const result = await enrollInFreeCourse(courseId, auth.token);
      if (!result.success) {
        const msg = result.message ?? "";
        if (msg.includes("Course not found")) {
          return fail("COURSE_NOT_FOUND", "Course not found", 404);
        }
        if (msg.includes("لا يمكنك التسجيل")) {
          return fail(
            "CANNOT_BUY_OWN_COURSE",
            "Cannot enroll in your own course",
            403
          );
        }
        if (msg.includes("This course is not free")) {
          // Pricing inconsistency between our effective-price calc and the
          // free-action's stricter price === 0 check. Surface as 500 since
          // it indicates a data shape we don't expect.
          console.error(
            `[api/enrollments POST] free dispatch but enrollInFreeCourse rejects: courseId=${courseId} price=${rawPrice} salePrice=${rawSale}`
          );
          return fail("INTERNAL_ERROR", "Course pricing inconsistency", 500);
        }
        console.error(
          "[api/enrollments POST] enrollInFreeCourse failed:",
          msg
        );
        return fail("INTERNAL_ERROR", "Enrollment failed", 500);
      }

      // Race: alreadyEnrolled flag from the action means the doc existed
      // when the action ran (between our pre-check and its read).
      if (result.alreadyEnrolled) {
        const e = (
          await db.collection("enrollments").doc(enrollmentId).get()
        ).data() ?? {};
        console.error(
          `enrollment-purchase userId=${auth.userId} courseId=${courseId} ALREADY_ENROLLED (race, free)`
        );
        return alreadyEnrolledResponse(enrollmentId, courseId, e);
      }

      const created = await db
        .collection("enrollments")
        .doc(enrollmentId)
        .get();
      const e = created.data() ?? {};
      const walletSnap = await db
        .collection("wallets")
        .doc(auth.userId)
        .get();
      const walletBalance = walletSnap.exists
        ? Number((walletSnap.data() as Wallet).balance ?? 0)
        : 0;

      console.log(
        `enrollment-purchase userId=${auth.userId} courseId=${courseId} price=0 newBalance=${walletBalance} transactionId=null`
      );

      return ok({
        enrollmentId,
        courseId,
        status: "completed" as const,
        enrolledAt:
          (e.enrolledAt as string | undefined) ??
          (e.createdAt as string | undefined) ??
          new Date().toISOString(),
        walletBalance,
        transactionId: null,
      });
    }

    // 5. Paid path — pre-check wallet for clean WALLET_NOT_FOUND /
    //    INSUFFICIENT_BALANCE error codes (the underlying transaction
    //    returns string-only errors).
    const walletRef = db.collection("wallets").doc(auth.userId);
    const walletSnap = await walletRef.get();
    if (!walletSnap.exists) {
      console.error(
        `enrollment-purchase userId=${auth.userId} courseId=${courseId} WALLET_NOT_FOUND`
      );
      return fail("WALLET_NOT_FOUND", "Wallet not found", 404);
    }
    const wallet = walletSnap.data() as Wallet;
    if (wallet.balance < effectivePrice) {
      console.error(
        `enrollment-purchase userId=${auth.userId} courseId=${courseId} INSUFFICIENT_BALANCE balance=${wallet.balance} required=${effectivePrice}`
      );
      return insufficientBalanceResponse(wallet.balance, effectivePrice);
    }

    // 6. Generate protection key and call the existing transaction.
    const protectionKey = generateProtectionKey(
      auth.userId,
      courseId,
      "enroll"
    );

    const result = await purchaseCourseWithWallet(
      auth.token,
      courseId,
      protectionKey
    );

    if (!result.success) {
      const msg = result.error ?? "";

      if (msg.includes("رصيد غير كافٍ")) {
        // Race: someone spent between our pre-check and the transaction.
        const fresh = await walletRef.get();
        const freshBalance = fresh.exists
          ? Number((fresh.data() as Wallet).balance ?? 0)
          : 0;
        console.error(
          `enrollment-purchase userId=${auth.userId} courseId=${courseId} INSUFFICIENT_BALANCE (race) balance=${freshBalance} required=${effectivePrice}`
        );
        return insufficientBalanceResponse(freshBalance, effectivePrice);
      }
      if (msg.includes("أنت مسجل بالفعل")) {
        const e = (
          await db.collection("enrollments").doc(enrollmentId).get()
        ).data() ?? {};
        console.error(
          `enrollment-purchase userId=${auth.userId} courseId=${courseId} ALREADY_ENROLLED (race)`
        );
        return alreadyEnrolledResponse(enrollmentId, courseId, e);
      }
      if (msg.includes("المحفظة غير موجودة")) {
        return fail("WALLET_NOT_FOUND", "Wallet not found", 404);
      }
      if (msg.includes("الدورة غير موجودة")) {
        return fail("COURSE_NOT_FOUND", "Course not found", 404);
      }
      if (msg.includes("لا يمكنك شراء دورتك")) {
        return fail(
          "CANNOT_BUY_OWN_COURSE",
          "Cannot purchase your own course",
          403
        );
      }
      if (msg.includes("معلومات المدرب")) {
        return fail(
          "INTERNAL_ERROR",
          "Course is missing instructor information",
          500
        );
      }
      if (msg.includes("هذه دورة مجانية")) {
        // Unreachable given our free dispatch above, but defensive.
        return fail("INTERNAL_ERROR", "Course pricing inconsistency", 500);
      }

      console.error(
        "[api/enrollments POST] purchaseCourseWithWallet failed:",
        new Error(msg).stack ?? msg
      );
      return fail("INTERNAL_ERROR", "Enrollment failed", 500);
    }

    // Defensive: protection-key collision means another in-flight call
    // already committed the transaction with the same key. Cannot happen
    // with the timestamp-based generator unless callers are racing within
    // the same millisecond, but the underlying function supports it.
    if (result.isDuplicate) {
      console.error(
        `enrollment-purchase userId=${auth.userId} courseId=${courseId} IDEMPOTENCY_CONFLICT protectionKey=${protectionKey}`
      );
      return NextResponse.json(
        {
          success: false as const,
          error: {
            code: "IDEMPOTENCY_CONFLICT",
            message:
              "A duplicate enrollment request is in flight. Refresh GET /api/me/enrollments and retry only if missing.",
            details: { enrollmentId, courseId },
          },
        },
        { status: 409 }
      );
    }

    const created = await db
      .collection("enrollments")
      .doc(enrollmentId)
      .get();
    const e = created.data() ?? {};

    console.log(
      `enrollment-purchase userId=${auth.userId} courseId=${courseId} price=${effectivePrice} newBalance=${result.newBalance} transactionId=${protectionKey}`
    );

    return ok({
      enrollmentId,
      courseId,
      status: "completed" as const,
      enrolledAt:
        (e.enrolledAt as string | undefined) ??
        (e.createdAt as string | undefined) ??
        new Date().toISOString(),
      walletBalance: result.newBalance,
      transactionId: protectionKey,
    });
  } catch (err) {
    console.error(
      "[api/enrollments POST] unhandled:",
      err instanceof Error ? (err.stack ?? err.message) : err
    );
    return handleApiError(err);
  }
}

function alreadyEnrolledResponse(
  enrollmentId: string,
  courseId: string,
  e: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    {
      success: false as const,
      error: {
        code: "ALREADY_ENROLLED",
        message: "Already enrolled in this course",
        details: {
          enrollmentId,
          courseId,
          status: "completed" as const,
          enrolledAt:
            (e.enrolledAt as string | undefined) ??
            (e.createdAt as string | undefined) ??
            null,
          transactionId: (e.transactionId as string | undefined) ?? null,
        },
      },
    },
    { status: 409 }
  );
}

function insufficientBalanceResponse(
  currentBalance: number,
  requiredPrice: number
): NextResponse {
  return NextResponse.json(
    {
      success: false as const,
      error: {
        code: "INSUFFICIENT_BALANCE",
        message: "Insufficient wallet balance",
        details: {
          currentBalance,
          requiredPrice,
          shortfall: Math.max(0, requiredPrice - currentBalance),
        },
      },
    },
    { status: 402 }
  );
}
