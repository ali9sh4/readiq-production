import { NextRequest, NextResponse } from "next/server";
import { areeba } from "@/lib/payments/areeba";
import { adminAuth, db } from "@/firebase/firebaseAdmin";

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
      return NextResponse.json(
        { error: "جلسة غير صالحة" },
        { status: 401 }
      );
    }

    const userId = verifiedToken.uid;

    // Check if already enrolled
    const existingEnrollment = await db
      .collection("enrollments")
      .where("userId", "==", userId)
      .where("courseId", "==", courseId)
      .where("status", "in", ["completed", "free"])
      .get();

    if (!existingEnrollment.empty) {
      return NextResponse.json(
        { error: "أنت مسجل بالفعل في هذه الدورة" },
        { status: 400 }
      );
    }

    // Generate unique order ID
    const orderId = `ar_${courseId}_${userId}_${Date.now()}`;

    // Create Areeba session
    const areebaSession = await areeba.createSession(
      amount,
      orderId,
      courseTitle
    );

    if (!areebaSession.session || !areebaSession.session.id) {
      return NextResponse.json(
        { error: "فشل في إنشاء جلسة Areeba" },
        { status: 500 }
      );
    }

    const sessionId = areebaSession.session.id;

    // ✅ Create PENDING enrollment (webhook will complete it)
    await db.collection("enrollments").add({
      userId,
      courseId,
      paymentMethod: "areeba",
      paymentId: sessionId, // ← Webhook will find by this
      orderId, // Store orderId too for Areeba status check
      amount,
      status: "pending", // ← Key!
      createdAt: new Date().toISOString(),
    });

    // Build Areeba checkout URL (adjust based on Areeba's actual URL structure)
    const checkoutUrl = `https://areeba.iq/checkout?session=${sessionId}`;

    return NextResponse.json({
      success: true,
      redirectUrl: checkoutUrl,
    });
  } catch (error: any) {
    console.error("Areeba init error:", error);
    return NextResponse.json(
      { error: error.message || "حدث خطأ" },
      { status: 500 }
    );
  }
}