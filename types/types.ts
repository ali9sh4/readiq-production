// types/course.ts

// ===== UTILITY TYPES =====
export type FirestoreTimestamp = {
  toDate: () => Date;
  seconds: number;
  nanoseconds: number;
};

export type CourseStatus = "draft" | "published" | "archived";
export type CourseLevel =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "all_levels";
export type CourseLanguage = "arabic" | "english" | "french" | "spanish";

export type CoursePurchaseMode = "full" | "sectional";
export type EnrollmentAccessScope = "full" | "sectional";
export type EnrollmentStatus = "pending" | "completed" | "failed" | "refunded";
export type EnrollmentType = "free" | "paid";
export type EnrollmentPaymentMethod = "wallet" | "zaincash";

// ===== ENTITY TYPES =====

export interface CourseVideo {
  videoId: string;
  courseId: string;
  assetId: string;
  playbackId: string;
  duration?: number;
  title: string;
  uploadedAt: string;
  order?: number;
  originalFilename?: string;
  description?: string;
  section?: string;
  sectionId?: string;
  isVisible?: boolean;
  isFreePreview?: boolean;
}

export interface CourseSection {
  sectionId: string;
  title: string;
  order: number;
  price?: number;
  salePrice?: number;
  isLocked?: boolean;
}

export interface CourseFile {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  type: string;
  uploadedAt: string;
  order?: number;
  relatedVideoId?: string;
}

export interface Course {
  // ===== Required Fields =====
  id: string;
  title: string;
  category: string;
  createdAt: string | null;
  updatedAt: string | null;

  // ===== Basic Info (Optional) =====
  subtitle?: string;
  description?: string;
  level?: CourseLevel;
  language?: CourseLanguage;
  price?: number;
  salePrice?: number;
  duration?: number;

  // ===== Purchase Mode (Sectional Purchasing) =====
  // Missing or 'full' = whole-course purchase (legacy behavior).
  // 'sectional' = sections are individually purchasable; `fullCoursePrice`
  // is the optional bundle price for buying everything at once.
  purchaseMode?: CoursePurchaseMode;
  fullCoursePrice?: number;
  sections?: CourseSection[];

  // ===== Status & Approval =====
  status?: CourseStatus;
  isApproved?: boolean;
  isRejected?: boolean;
  rejectionReason?: string | null;

  // ===== Content =====
  thumbnailUrl?: string;
  images?: string[];
  videos?: CourseVideo[];
  files?: CourseFile[]; // Using the more detailed CourseFile
  learningPoints?: string[];
  requirements?: string[];

  // ===== Metadata =====
  instructorName?: string;
  createdBy?: string;
  rating?: number;
  ratingCount?: number;
  enrollmentCount?: number;
  studentsCount?: number;
  // ===== Deletion Fields =====
  deletionStatus?: "none" | "requested" | "approved" | "rejected";
  deletionRequestedAt?: string | null;
  deletionRequestedBy?: string; // instructor userId
  deletionRejectedAt?: string | null;
  deletionRejectionReason?: string | null;
  deletedAt?: string | null;
  deletedBy?: string; // admin userId
  isDeleted?: boolean; // Quick check flag
  restoredAt?: string | null;
  restoredBy?: string;
}

// Enrollment doc shape. Stored at `enrollments/{userId}_{courseId}`.
// Legacy docs predate `accessScope` / `ownedSectionIds` — missing
// `accessScope` means full-course access (the only mode that existed before
// sectional). Bundle buyers on a sectional course get `accessScope: 'full'`
// explicitly; per-section buyers get `accessScope: 'sectional'` and a
// populated `ownedSectionIds`. The gate distinguishes unset vs explicit
// `'full'` for log diagnostics only — both grant.
export interface Enrollment {
  userId: string;
  courseId: string;
  status: EnrollmentStatus;
  enrollmentType?: EnrollmentType;
  paymentMethod?: EnrollmentPaymentMethod;
  amount?: number;
  paymentId?: string;
  transactionId?: string;
  enrolledAt?: string;
  createdAt?: string;
  updatedAt?: string;
  accessScope?: EnrollmentAccessScope;
  ownedSectionIds?: string[];
  // Cumulative IQD this user has paid into this enrollment. Set by the
  // sectional wallet actions (Phase 3); used by bundle break-even math.
  totalSpent?: number;
  // Set when this enrollment was granted by a course-package purchase
  // (traceability only — access is still decided by `accessScope`).
  sourcePackageId?: string;
}

// ===== COURSE PACKAGES =====
//
// A package is a curated bundle of existing courses sold together at one
// discounted price (admin-created only in v1). It is NOT a course
// `purchaseMode` — packages are a third, parallel purchase model that only
// references existing courses. A package buyer gets a normal
// `accessScope: 'full'` enrollment for every included course.

export type PackageStatus = "draft" | "active" | "archived";

// Stored at `packages/{packageId}`.
export interface CoursePackage {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  // Member course ids. Frozen once `coursesLocked` is true (set at first
  // sale) — mirrors the sectional "sold section is immutable" invariant.
  courseIds: string[];
  // Absolute discounted price in IQD, admin-edited. Stays editable for
  // future buyers even after the course list locks. Deliberately NOT a
  // percentage-of-sum, to avoid drift when a member course reprices.
  price: number;
  // Agreed manual payout per instructor (`course.createdBy` uid), in IQD.
  // Editable; each sale snapshots this map into the `PackageSale` doc, so
  // the owed tally reflects what was agreed at sale time.
  payouts: Record<string, number>;
  // Denormalized instructor display names, keyed by the same uids as
  // `payouts` — lets the admin UI render without extra reads.
  payoutInstructorNames?: Record<string, string>;
  status: PackageStatus;
  // Set true at first sale; the course list is immutable from then on.
  coursesLocked?: boolean;
  saleCount?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// One doc per completed package sale, at `package_sales/{saleId}`.
// The audit trail AND the source of the per-instructor owed tally.
export interface PackageSale {
  id: string;
  packageId: string;
  buyerId: string;
  // Snapshot of the package's course list at sale time.
  courseIds: string[];
  pricePaid: number;
  // Snapshot of the payout map at sale time — the tally sums these, not
  // the live (still-editable) `CoursePackage.payouts`.
  payouts: Record<string, number>;
  // Idempotency marker. Namespaced `package_purchase_*` so it can never
  // collide with a standalone/sectional `purchase_*` key.
  protectionKey: string;
  // Buyer-side `wallet_transactions` row id.
  txId: string;
  enrollmentIds: string[];
  createdAt: string;
}

// A manual settlement payment the admin records after paying an instructor
// out of band, at `instructor_payouts/{payoutId}`. Outstanding owed per
// instructor = Σ package_sales.payouts[id] − Σ instructor_payouts.amount.
export interface InstructorPayout {
  id: string;
  instructorId: string;
  amount: number;
  note?: string;
  recordedBy: string;
  createdAt: string;
}

// ===== INSTRUCTOR EARNINGS & PAYOUTS =====
//
// Instructor earnings are a real-world cash payable the platform owes the
// instructor — NOT spendable platform credit. A course sale no longer
// credits the instructor's spend wallet (`wallets/{uid}`); instead it
// appends an immutable `earning` entry to the instructor's earnings ledger
// and increments a denormalized `earningsTotal` on their user doc.
// See `docs/INSTRUCTOR_PAYOUTS.md`.
//
// This deliberately mirrors the course-packages owed/paid tally, but is a
// SEPARATE system — do not conflate the two.

export type PayoutMethod = "bank_transfer" | "zaincash" | "cash";

// One immutable entry in `users/{uid}/earningsLedger/{entryId}`. Entries are
// the audit trail — never edited or deleted once written.
export interface EarningLedgerEntry {
  id: string;
  kind: "earning" | "payout";
  // Always positive. For an 'earning' this is the instructor's share; for a
  // 'payout' it is the amount the admin recorded as paid out of band.
  amount: number;
  // FieldValue.serverTimestamp() at write time — a Firestore Timestamp when
  // read back, never an ISO string.
  createdAt: unknown;
  // uid that caused the entry: the buyer for an 'earning', the admin for a
  // 'payout'.
  createdBy: string;

  // ===== 'earning' fields — the split is SNAPSHOTTED at sale time so a
  // later renegotiation of the instructor's rate never rewrites history.
  grossAmount?: number;
  // The instructor's % share used for THIS sale (e.g. 70). Copied from the
  // instructor's user doc inside the purchase transaction.
  revenueSharePercent?: number;
  instructorShareAmount?: number; // = round(gross * pct / 100) — equals `amount`
  platformShareAmount?: number; // = gross − instructorShareAmount
  courseId?: string;
  enrollmentId?: string;
  // Present for per-section purchases; one earning entry covers the whole
  // purchase event, which may span several sections.
  sectionIds?: string[];
  // How the sale was paid — for traceability only.
  source?: "wallet" | "zaincash" | "backfill";

  // ===== 'payout' fields =====
  method?: PayoutMethod;
  note?: string;
  settledBy?: string; // admin uid that recorded the payout
}

// Instructor-earnings fields denormalized onto `users/{uid}`.
// `outstanding` is ALWAYS derived (earningsTotal − payoutsTotal) and is
// never stored. `revenueSharePercent` is per-instructor and editable; it
// affects FUTURE sales only — past ledger entries keep their snapshot.
export interface UserEarningsFields {
  revenueSharePercent?: number; // instructor's share, default 70
  earningsTotal?: number; // Σ earning-entry amounts, default 0
  payoutsTotal?: number; // Σ payout-entry amounts, default 0
  // Denormalized convenience for the admin list — the ledger remains
  // authoritative. Firestore Timestamp once read back.
  lastPayoutAt?: unknown;
}

// ===== API RESPONSE TYPES =====

export interface CourseResponse {
  success: boolean;
  courses: Course[];
  hasMore: boolean;
  nextCursor: string | null;
  totalPages?: number;
  error?: string;
}

export interface GetCourseOptions {
  filters?: {
    category?: string;
    level?: CourseLevel;
    language?: CourseLanguage;
    isApproved?: boolean;
    isRejected?: boolean;
    userId?: string;
    status?: CourseStatus;
    enrolledUserId?: string;
    isDeleted?: boolean;
  };
  pagination?: {
    pageSize?: number;
    lastDocId?: string;
  };
}
