import { syncAllCourseEnrollmentCounts } from "@/app/actions/enrollment_action";
import { getCurrentUser } from "@/data/auth-server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    // Check admin auth
    const cookieStore = await cookies();
    const token = cookieStore.get("firebaseAuthToken")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authResult = await getCurrentUser({ token });
    if (!authResult.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Sync enrollments
    const result = await syncAllCourseEnrollmentCounts();

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
