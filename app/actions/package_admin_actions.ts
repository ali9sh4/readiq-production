// Course-package admin actions (Phase 3).
//
// Admin-only CRUD for packages plus the per-instructor payout ledger.
// Every function verifies admin rights server-side (Firebase custom claim
// `admin`, or the env-configured admin email) — the same check the topup
// approval actions use.
//
// All reads go through the firebase-admin SDK, which bypasses Firestore
// security rules. That keeps the feature self-contained: the admin UI
// needs no client-side `onSnapshot` and no new Firestore rules.
//
// Course-list immutability: once a package has a sale (`coursesLocked`),
// `updatePackage` rejects any change to `courseIds`. Price, payouts,
// status, and copy stay editable. The "payouts exceed price" condition is
// surfaced as a warning in the editor UI — it never blocks a save.
"use server";

import { adminAuth, db } from "@/firebase/service";
import { FieldValue } from "firebase-admin/firestore";
import type { Course, CoursePackage } from "@/types/types";
import {
  packageInputSchema,
  recordPayoutSchema,
} from "@/lib/packages/validation";

// ===== Result shapes =====

type Ok<T> = { success: true } & T;
type Err = { success: false; error: string; message: string };
type Result<T> = Ok<T> | Err;

function err(error: string, message: string): Err {
  return { success: false, error, message };
}

// ===== Admin gate =====

async function verifyAdmin(
  token: string
): Promise<{ ok: true; uid: string } | { ok: false }> {
  try {
    const verified = await adminAuth.verifyIdToken(token);
    const user = await adminAuth.getUser(verified.uid);
    const isAdmin =
      user.customClaims?.admin === true ||
      process.env.FIREBASE_ADMIN_EMAIL === user.email;
    return isAdmin ? { ok: true, uid: verified.uid } : { ok: false };
  } catch {
    return { ok: false };
  }
}

// ===== Picker course =====

export type PickerCourse = {
  id: string;
  title: string;
  createdBy: string;
  instructorName: string;
  purchaseMode: "full" | "sectional";
};

// Approved, non-deleted courses the admin can put in a package. Single
// `where` only — no composite index needed.
export async function listCoursesForPicker(
  token: string
): Promise<Result<{ courses: PickerCourse[] }>> {
  const admin = await verifyAdmin(token);
  if (!admin.ok) return err("NOT_ADMIN", "Admin access required");

  try {
    const snap = await db
      .collection("courses")
      .where("isApproved", "==", true)
      .get();
    const courses: PickerCourse[] = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Course))
      .filter((c) => c.isDeleted !== true && !!c.createdBy)
      .map((c) => ({
        id: c.id,
        title: c.title ?? c.id,
        createdBy: c.createdBy as string,
        instructorName: c.instructorName ?? "مدرب",
        purchaseMode: c.purchaseMode === "sectional" ? "sectional" : "full",
      }));
    return { success: true, courses };
  } catch (e) {
    console.error("listCoursesForPicker error", e);
    return err("INTERNAL_ERROR", "Failed to load courses");
  }
}

// ===== List packages =====

export async function listPackagesForAdmin(
  token: string
): Promise<Result<{ packages: CoursePackage[] }>> {
  const admin = await verifyAdmin(token);
  if (!admin.ok) return err("NOT_ADMIN", "Admin access required");

  try {
    const snap = await db.collection("packages").get();
    const packages = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as CoursePackage))
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    return { success: true, packages };
  } catch (e) {
    console.error("listPackagesForAdmin error", e);
    return err("INTERNAL_ERROR", "Failed to load packages");
  }
}

// ===== Shared: derive instructor set + names from a course list =====

async function deriveInstructors(
  courseIds: string[]
): Promise<
  | { ok: true; names: Record<string, string> }
  | { ok: false; message: string }
> {
  const snaps = await Promise.all(
    courseIds.map((id) => db.collection("courses").doc(id).get())
  );
  const names: Record<string, string> = {};
  for (let i = 0; i < snaps.length; i++) {
    const s = snaps[i];
    if (!s.exists) {
      return { ok: false, message: `الدورة ${courseIds[i]} غير موجودة` };
    }
    const c = s.data() as Course;
    if (c.isDeleted === true || c.isApproved !== true) {
      return {
        ok: false,
        message: `الدورة «${c.title ?? courseIds[i]}» غير متاحة`,
      };
    }
    if (!c.createdBy) {
      return {
        ok: false,
        message: `الدورة «${c.title ?? courseIds[i]}» بلا مدرب`,
      };
    }
    // Packages may not contain time-limited courses (locked decision):
    // a package grants lifetime `accessScope: 'full'` enrollments, which
    // would contradict the course's own duration. The pricing action
    // enforces the reverse (a packaged course cannot become time-limited).
    if (c.accessDurationDays !== undefined) {
      return {
        ok: false,
        message: `الدورة «${c.title ?? courseIds[i]}» محددة مدة الوصول — لا يمكن إضافتها إلى حزمة`,
      };
    }
    names[c.createdBy] = c.instructorName ?? "مدرب";
  }
  return { ok: true, names };
}

// Keep only payout entries for real instructors of the package; fill any
// missing instructor with 0 so the map always covers the full set.
function normalizePayouts(
  rawPayouts: Record<string, number>,
  instructorIds: string[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of instructorIds) {
    const v = rawPayouts[id];
    out[id] = typeof v === "number" && v >= 0 ? Math.round(v) : 0;
  }
  return out;
}

// ===== Create package =====

export async function createPackage(
  token: string,
  input: unknown
): Promise<Result<{ packageId: string }>> {
  const admin = await verifyAdmin(token);
  if (!admin.ok) return err("NOT_ADMIN", "Admin access required");

  const parsed = packageInputSchema.safeParse(input);
  if (!parsed.success) {
    return err("INVALID_INPUT", "بيانات الحزمة غير صحيحة");
  }
  const data = parsed.data;

  if (data.status === "active" && data.courseIds.length < 2) {
    return err(
      "INVALID_INPUT",
      "يجب أن تحتوي الحزمة على دورتين على الأقل لتفعيلها"
    );
  }

  const derived = await deriveInstructors(data.courseIds);
  if (!derived.ok) return err("INVALID_INPUT", derived.message);

  const instructorIds = Object.keys(derived.names);
  const payouts = normalizePayouts(data.payouts, instructorIds);
  const nowIso = new Date().toISOString();

  try {
    const ref = db.collection("packages").doc();
    await ref.set({
      title: data.title,
      description: data.description ?? null,
      thumbnailUrl: data.thumbnailUrl ?? null,
      courseIds: data.courseIds,
      price: data.price,
      payouts,
      payoutInstructorNames: derived.names,
      status: data.status,
      coursesLocked: false,
      saleCount: 0,
      createdBy: admin.uid,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    return { success: true, packageId: ref.id };
  } catch (e) {
    console.error("createPackage error", e);
    return err("INTERNAL_ERROR", "فشل إنشاء الحزمة");
  }
}

// ===== Update package =====

export async function updatePackage(
  token: string,
  packageId: string,
  input: unknown
): Promise<Result<{ packageId: string }>> {
  const admin = await verifyAdmin(token);
  if (!admin.ok) return err("NOT_ADMIN", "Admin access required");
  if (!packageId || typeof packageId !== "string") {
    return err("INVALID_INPUT", "packageId مطلوب");
  }

  const parsed = packageInputSchema.safeParse(input);
  if (!parsed.success) {
    return err("INVALID_INPUT", "بيانات الحزمة غير صحيحة");
  }
  const data = parsed.data;

  const ref = db.collection("packages").doc(packageId);
  const snap = await ref.get();
  if (!snap.exists) return err("PACKAGE_NOT_FOUND", "الحزمة غير موجودة");
  const existing = snap.data() as CoursePackage;
  const isLocked = existing.coursesLocked === true;

  // Course list is frozen after the first sale.
  if (isLocked) {
    const sameSet =
      data.courseIds.length === existing.courseIds.length &&
      [...data.courseIds].sort().join(",") ===
        [...existing.courseIds].sort().join(",");
    if (!sameSet) {
      return err(
        "PACKAGE_LOCKED",
        "قائمة الدورات مقفلة بعد أول عملية بيع — لا يمكن تعديلها"
      );
    }
  }

  if (data.status === "active" && data.courseIds.length < 2) {
    return err(
      "INVALID_INPUT",
      "يجب أن تحتوي الحزمة على دورتين على الأقل لتفعيلها"
    );
  }

  // When locked, the instructor set is frozen with the course list — reuse
  // the stored names and only re-key the payout amounts. When unlocked, the
  // list is freely editable, so re-derive instructors from the courses.
  let instructorNames: Record<string, string>;
  if (isLocked) {
    instructorNames = existing.payoutInstructorNames ?? {};
  } else {
    const derived = await deriveInstructors(data.courseIds);
    if (!derived.ok) return err("INVALID_INPUT", derived.message);
    instructorNames = derived.names;
  }
  const payouts = normalizePayouts(data.payouts, Object.keys(instructorNames));

  try {
    await ref.update({
      title: data.title,
      description: data.description ?? null,
      thumbnailUrl: data.thumbnailUrl ?? null,
      courseIds: isLocked ? existing.courseIds : data.courseIds,
      price: data.price,
      payouts,
      payoutInstructorNames: instructorNames,
      status: data.status,
      updatedAt: new Date().toISOString(),
    });
    return { success: true, packageId };
  } catch (e) {
    console.error("updatePackage error", e);
    return err("INTERNAL_ERROR", "فشل تحديث الحزمة");
  }
}

// ===== Payout ledger =====

export type PayoutLedgerRow = {
  instructorId: string;
  instructorName: string;
  owed: number; // Σ package_sales.payouts[id]
  paid: number; // Σ instructor_payouts.amount
  outstanding: number; // owed − paid
};

export type PayoutLedger = {
  rows: PayoutLedgerRow[];
  totalRevenue: number; // Σ package_sales.pricePaid
  totalSales: number;
};

// Aggregates the owed/paid/outstanding tally per instructor. Owed is summed
// from the payout SNAPSHOT on each sale, so editing a package's live payout
// map never rewrites history.
export async function getPayoutLedger(
  token: string
): Promise<Result<{ ledger: PayoutLedger }>> {
  const admin = await verifyAdmin(token);
  if (!admin.ok) return err("NOT_ADMIN", "Admin access required");

  try {
    const [salesSnap, payoutsSnap, packagesSnap] = await Promise.all([
      db.collection("package_sales").get(),
      db.collection("instructor_payouts").get(),
      db.collection("packages").get(),
    ]);

    // Name map — merged from every package's denormalized name map.
    const names: Record<string, string> = {};
    packagesSnap.docs.forEach((d) => {
      const p = d.data() as CoursePackage;
      Object.assign(names, p.payoutInstructorNames ?? {});
    });

    const owed: Record<string, number> = {};
    let totalRevenue = 0;
    salesSnap.docs.forEach((d) => {
      const s = d.data();
      totalRevenue += typeof s.pricePaid === "number" ? s.pricePaid : 0;
      const sp = (s.payouts ?? {}) as Record<string, number>;
      for (const [id, amt] of Object.entries(sp)) {
        owed[id] = (owed[id] ?? 0) + (typeof amt === "number" ? amt : 0);
      }
    });

    const paid: Record<string, number> = {};
    payoutsSnap.docs.forEach((d) => {
      const p = d.data();
      const id = p.instructorId as string;
      if (!id) return;
      paid[id] = (paid[id] ?? 0) + (typeof p.amount === "number" ? p.amount : 0);
    });

    const instructorIds = new Set([
      ...Object.keys(owed),
      ...Object.keys(paid),
    ]);
    const rows: PayoutLedgerRow[] = [...instructorIds]
      .map((id) => ({
        instructorId: id,
        instructorName: names[id] ?? id,
        owed: owed[id] ?? 0,
        paid: paid[id] ?? 0,
        outstanding: (owed[id] ?? 0) - (paid[id] ?? 0),
      }))
      .sort((a, b) => b.outstanding - a.outstanding);

    return {
      success: true,
      ledger: { rows, totalRevenue, totalSales: salesSnap.size },
    };
  } catch (e) {
    console.error("getPayoutLedger error", e);
    return err("INTERNAL_ERROR", "فشل تحميل سجل المستحقات");
  }
}

// ===== Record a manual payout =====

export async function recordInstructorPayout(
  token: string,
  input: unknown
): Promise<Result<{ payoutId: string }>> {
  const admin = await verifyAdmin(token);
  if (!admin.ok) return err("NOT_ADMIN", "Admin access required");

  const parsed = recordPayoutSchema.safeParse(input);
  if (!parsed.success) {
    return err("INVALID_INPUT", "بيانات الدفعة غير صحيحة");
  }

  try {
    const ref = db.collection("instructor_payouts").doc();
    await ref.set({
      instructorId: parsed.data.instructorId,
      amount: parsed.data.amount,
      note: parsed.data.note ?? null,
      recordedBy: admin.uid,
      createdAt: new Date().toISOString(),
    });
    return { success: true, payoutId: ref.id };
  } catch (e) {
    console.error("recordInstructorPayout error", e);
    return err("INTERNAL_ERROR", "فشل تسجيل الدفعة");
  }
}
