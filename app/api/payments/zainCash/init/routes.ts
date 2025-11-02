import { NextRequest, NextResponse } from "next/server";
import { zaincash } from "@/lib/payments/zaincash";
import { adminAuth, db } from "@/firebase/service";

export async function POST(req: NextRequest) {
  try {
    const { courseId, courseTitle, amount, token } = await req.json();

    // Verify user authentication
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

    // Check if already enrolled
    const existingEnrollment = await db
      .collection("enrollments")
      .where("userId", "==", userId)
      .where("courseId", "==", courseId)
      .get();

    if (!existingEnrollment.empty) {
      return NextResponse.json(
        { error: "أنت مسجل بالفعل في هذه الدورة" },
        { status: 400 }
      );
    }

    // Generate unique order ID
    const orderId = `zc_${courseId}_${userId}_${Date.now()}`;

    // Create ZainCash transaction
    const zaincashResponse = await zaincash.createTransaction(amount, orderId);

    if (!zaincashResponse.id || !zaincashResponse.url) {
      return NextResponse.json(
        { error: "فشل في إنشاء معاملة ZainCash" },
        { status: 500 }
      );
    }

    // ✅ Create PENDING enrollment (webhook will complete it)
    await db.collection("enrollments").add({
      userId,
      courseId,
      paymentMethod: "zaincash",
      paymentId: zaincashResponse.id, // ← Webhook will find by this
      amount,
      status: "pending", // ← Key!
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      redirectUrl: zaincashResponse.url,
    });
  } catch (error: any) {
    console.error("ZainCash init error:", error);
    return NextResponse.json(
      { error: error.message || "حدث خطأ" },
      { status: 500 }
    );
  }
}
