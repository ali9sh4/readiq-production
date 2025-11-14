import { NextRequest, NextResponse } from "next/server";
import { zaincash } from "@/lib/payments/zaincash";
import { adminAuth, db } from "@/firebase/service";

export async function POST(req: NextRequest) {
  try {
    const { courseId, courseTitle, amount, token } = await req.json();

    // 1️⃣ Verify user authentication
    if (!token) {
      return NextResponse.json(
        { error: "يرجى تسجيل الدخول أولاً" },
        { status: 401 }
      );
    }

    const verifiedToken = await adminAuth.verifyIdToken(token);
    if (!verifiedToken) {
      return NextResponse.json({ error: "جلسة غير صالحة" }, { status: 401 });
    }

    const userId = verifiedToken.uid;

    // 2️⃣ Verify course exists and price is correct
    const courseDoc = await db.collection("courses").doc(courseId).get();

    if (!courseDoc.exists) {
      return NextResponse.json({ error: "الدورة غير موجودة" }, { status: 404 });
    }
    const courseData = courseDoc.data();

    let coursePrice = courseData?.price || 0;
    const salePrice = courseData?.salePrice ?? 0;
    if (salePrice > 0 && salePrice < coursePrice) {
      coursePrice = salePrice;
    }

    if (coursePrice !== amount) {
      return NextResponse.json({ error: "سعر غير صحيح" }, { status: 400 });
    }

    if (courseDoc.data()?.isFree) {
      return NextResponse.json({ error: "هذه دورة مجانية" }, { status: 400 });
    }

    // 3️⃣ ✅ NEW: Check for existing enrollment BEFORE creating payment
    const enrollmentId = `${userId}_${courseId}`;
    const enrollmentRef = db.collection("enrollments").doc(enrollmentId);
    const existingEnrollment = await enrollmentRef.get();

    if (existingEnrollment.exists) {
      const data = existingEnrollment.data();

      if (data?.status === "completed") {
        return NextResponse.json(
          { error: "أنت مسجل بالفعل في هذه الدورة" },
          { status: 400 }
        );
      }

      if (data?.status === "pending") {
        const createdAt = new Date(data.createdAt);
        const minutesAge = (Date.now() - createdAt.getTime()) / 60000;

        if (minutesAge < 15) {
          return NextResponse.json(
            {
              error:
                "لديك عملية دفع قيد المعالجة. يرجى إكمال الدفع أو الانتظار 30 دقيقة",
            },
            { status: 400 }
          );
        }

        console.log(
          `🔄 Will replace expired pending enrollment (${Math.round(
            minutesAge
          )} min old)`
        );
      }
    }

    // 4️⃣ ✅ NOW create ZainCash transaction (only if checks passed)
    const orderId = `zc_${courseId}_${userId}_${Date.now()}`;
    const zaincashResponse = await zaincash.createTransaction(
      amount,
      orderId,
      courseTitle
    );

    if (!zaincashResponse.id || !zaincashResponse.url) {
      return NextResponse.json(
        { error: "فشل في إنشاء معاملة ZainCash" },
        { status: 500 }
      );
    }

    // 5️⃣ Create/update enrollment with transaction
    await db.runTransaction(async (transaction) => {
      // Double-check enrollment status hasn't changed
      const doc = await transaction.get(enrollmentRef);

      if (doc.exists) {
        const status = doc.data()?.status;
        if (status === "completed") {
          throw new Error("أنت مسجل بالفعل في هذه الدورة");
        }
      }

      transaction.set(enrollmentRef, {
        userId,
        courseId,
        paymentMethod: "zaincash",
        paymentId: zaincashResponse.id,
        amount,
        status: "pending",
        createdAt: new Date().toISOString(),
      });
    });

    // 6️⃣ Log transaction for audit trail
    await db.collection("payment_transactions").add({
      userId,
      courseId,
      paymentMethod: "zaincash",
      paymentId: zaincashResponse.id,
      amount,
      status: "initiated",
      createdAt: new Date().toISOString(),
    });

    console.log(`✅ Payment initiated: ${zaincashResponse.id}`);

    return NextResponse.json({
      success: true,
      redirectUrl: zaincashResponse.url,
    });
  } catch (error: any) {
    console.error("ZainCash init error:", {
      message: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      { error: error.message || "حدث خطأ" },
      { status: 500 }
    );
  }
}
