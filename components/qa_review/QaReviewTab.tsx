"use client";

// Phase 2 — instructor Q&A review tab (docs/RUBIK_STUDY_FEATURES.md §5,
// publishing model C). Third tab of CourseDashboard, mounted on both
// dashboard routes. Self-contained: loads via listQaForReview (fully gated
// server action), mirrors every mutation into local state, and NEVER calls
// router.refresh() (the 2026-06-30 middleware-bounce rule).
//
// 2026-07-14 (owner decision): approval is ONE-TAP — the clip-attestation
// gate and the numeric "الرقم مطابق" checkbox were removed from this UI and
// from the server action. The numeric quarantine class remains as a visible
// badge (and still bars bulk approval server-side); معاينة المقطع stays as
// an optional preview. Sentinel pairs (0/0/null citation failure) still get
// no preview and cannot be approved — edit or reject only. Edits still bar
// the pair from bulk server-side.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import MuxPlayer from "@mux/mux-player-react";
import {
  AlertTriangle,
  Check,
  Loader2,
  Pencil,
  Play,
  RefreshCw,
  ShieldCheck,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/authContext";
import SignedMuxPlayer from "@/components/SignedMuxPlayer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  approvePair,
  bulkApproveVideo,
  editPair,
  listQaForReview,
  rejectPair,
  revokeApproval,
  type QaReviewFailure,
  type QaReviewPair,
} from "@/app/actions/qa_review_actions";
import { localizeQaReviewError } from "@/lib/qa/localizeError";
import McqReviewSection from "@/components/qa_review/McqReviewSection";
import type { CourseVideo } from "@/types/types";

type MuxPlayerRef = ComponentRef<typeof MuxPlayer>;

interface Props {
  courseId: string;
  videos: CourseVideo[];
  disabled?: boolean;
}

const WIDE_SPAN_SEC = 300; // §8.2 — one tick in a >5min window is weak attestation

// Display-only formatting: Arabic-Indic numerals for every count/timestamp
// shown in the review UI. Never applied to state, payloads, or comparisons —
// the underlying data stays ASCII. Deterministic character mapping (not
// locale-dependent), so it cannot cause SSR/client digit mismatches (the
// React #418 class this repo pins en-US against).
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
function toArabicNumerals(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => ARABIC_DIGITS[Number(d)]);
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return toArabicNumerals(`${m}:${String(s).padStart(2, "0")}`);
}

function isSentinel(p: QaReviewPair): boolean {
  return (
    p.quarantine === "sentinel" ||
    (p.sourceStartSec === 0 && p.sourceEndSec === 0 && p.avgLogprob === null)
  );
}

function quarantineBadge(q: QaReviewPair["quarantine"]) {
  switch (q) {
    case "numeric":
      return { label: "رقم / قياس", cls: "bg-amber-100 text-amber-800 border border-amber-300" };
    case "sentinel":
      return { label: "بدون اقتباس زمني", cls: "bg-gray-200 text-gray-700 border border-gray-300" };
    case "flagged":
      return { label: "جودة صوت منخفضة", cls: "bg-red-100 text-red-800 border border-red-300" };
    default:
      return null;
  }
}

function statusBadge(p: QaReviewPair) {
  if (p.stale) return { label: "قديم (غير موجود في آخر توليد)", cls: "bg-gray-100 text-gray-500 border border-gray-300" };
  switch (p.status) {
    case "approved":
      return { label: p.approvalMode === "bulk" ? "معتمد (جماعي)" : "معتمد", cls: "bg-green-100 text-green-800 border border-green-300" };
    case "rejected":
      return { label: "مرفوض", cls: "bg-red-50 text-red-700 border border-red-200" };
    default:
      return { label: "بانتظار المراجعة", cls: "bg-blue-50 text-blue-700 border border-blue-200" };
  }
}

export default function QaReviewTab({ courseId, videos, disabled }: Props) {
  const auth = useAuth();

  // E1: this tab hosts BOTH reviews behind a segmented toggle (قرارات
  // المالك decision 5 — no fourth CourseDashboard tab). "pairs" = the
  // Phase 2 practice-pair review below; "mcq" = McqReviewSection.
  const [view, setView] = useState<"pairs" | "mcq">("pairs");

  const [pairs, setPairs] = useState<QaReviewPair[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);
  const [activePairId, setActivePairId] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [bulkBusyVideoId, setBulkBusyVideoId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ question: "", answer: "" });
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const playerRef = useRef<MuxPlayerRef>(null);
  // Mirror of the active pair for the timeupdate closure (fake-stop UX).
  const activePairRef = useRef<QaReviewPair | null>(null);

  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      return (await auth?.user?.getIdToken()) ?? null;
    } catch {
      return null;
    }
  }, [auth?.user]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const token = await getToken();
    if (!token) {
      setLoadError("انتهت الجلسة — يرجى تسجيل الدخول من جديد.");
      setLoading(false);
      return;
    }
    try {
      const res = await listQaForReview(token, courseId);
      if (!res.success) {
        // Unlike loadPreviousVideos, failures are VISIBLE and retriable.
        setLoadError(localizeQaReviewError(res));
      } else {
        setPairs(res.pairs);
      }
    } catch {
      setLoadError("تعذّر تحميل الأسئلة — تحقق من الاتصال وأعد المحاولة.");
    } finally {
      setLoading(false);
    }
  }, [courseId, getToken]);

  useEffect(() => {
    load();
  }, [load]);

  // ----- derived grouping / ordering (§5.1, in-memory by design) -----------
  const videosWithPairs = useMemo(() => {
    if (!pairs) return [];
    const byVideo = new Map<string, QaReviewPair[]>();
    for (const p of pairs) {
      const list = byVideo.get(p.videoId) ?? [];
      list.push(p);
      byVideo.set(p.videoId, list);
    }
    const ordered = [...videos]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .filter((v) => byVideo.has(v.videoId));
    return ordered.map((v) => {
      const list = byVideo.get(v.videoId)!;
      const sorted = [...list].sort((a, b) => {
        const aq = a.quarantine !== null ? 0 : 1;
        const bq = b.quarantine !== null ? 0 : 1;
        if (aq !== bq) return aq - bq; // quarantined first
        if (aq === 0) {
          // worst avgLogprob first; nulls (sentinel) worst of all
          const av = a.avgLogprob ?? -Infinity;
          const bv = b.avgLogprob ?? -Infinity;
          if (av !== bv) return av - bv;
        }
        return a.sourceStartSec - b.sourceStartSec; // lecture order
      });
      const flaggedCount = list.filter((p) => p.needsReview).length;
      const pendingClean = list.filter(
        (p) => p.status === "pending" && p.quarantine === null && !p.stale && !p.editedAt
      ).length;
      return { video: v, pairs: sorted, flaggedCount, pendingClean };
    });
  }, [pairs, videos]);

  const totals = useMemo(() => {
    const t = { pending: 0, approved: 0, rejected: 0, quarantinedPending: 0 };
    for (const p of pairs ?? []) {
      if (p.status === "pending") {
        t.pending++;
        if (p.quarantine !== null) t.quarantinedPending++;
      } else if (p.status === "approved") t.approved++;
      else t.rejected++;
    }
    return t;
  }, [pairs]);

  // Pairs whose video no longer exists on the course doc — invisible in the
  // grouped list; surfaced here so the summary totals can't silently
  // disagree with what's reviewable.
  const orphanCount = useMemo(() => {
    if (!pairs) return 0;
    const known = new Set(videos.map((v) => v.videoId));
    return pairs.filter((p) => !known.has(p.videoId)).length;
  }, [pairs, videos]);

  // ----- attestation ---------------------------------------------------------
  const clearActivePair = () => {
    activePairRef.current = null;
    setActivePairId(null);
  };

  const previewPair = (p: QaReviewPair) => {
    const player = playerRef.current;
    if (!player) {
      // Placeholder branch of SignedMuxPlayer — the ref isn't attached yet.
      toast.info("الفيديو قيد التحميل — انتظر لحظة ثم أعد المحاولة");
      return;
    }
    activePairRef.current = p;
    setActivePairId(p.id);
    player.currentTime = p.sourceStartSec;
    void player.play()?.catch(() => {});
  };

  const onTimeUpdate = () => {
    const active = activePairRef.current;
    const player = playerRef.current;
    if (!active || !player) return;
    const t = player.currentTime;
    if (typeof t !== "number") return;
    if (t >= active.sourceEndSec) {
      // Client-side fake-stop (§8.3 — UX, not enforcement). One-shot: clear
      // the active pair so the reviewer can free-play past the window
      // without being re-paused on every tick.
      player.pause();
      clearActivePair();
    }
  };

  // ----- mutations (local-state mirror, no router.refresh) -------------------
  const patchPair = (updated: QaReviewPair) =>
    setPairs((prev) => prev?.map((p) => (p.id === updated.id ? updated : p)) ?? prev);

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      await fn();
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const runAction = async <T extends { success: true } | QaReviewFailure>(
    call: (token: string) => Promise<T>,
    onSuccess: (res: Extract<T, { success: true }>) => void
  ) => {
    const token = await getToken();
    if (!token) {
      toast.error("انتهت الجلسة — يرجى تسجيل الدخول من جديد.");
      return;
    }
    try {
      const res = await call(token);
      if (!res.success) toast.error(localizeQaReviewError(res as QaReviewFailure));
      else onSuccess(res as Extract<T, { success: true }>);
    } catch {
      toast.error("حدث خطأ غير متوقع. حاول مرة أخرى.");
    }
  };

  const handleApprove = (p: QaReviewPair) =>
    withBusy(p.id, () =>
      runAction(
        (token) => approvePair(token, courseId, { qaDocId: p.id }),
        (res) => {
          patchPair(res.pair);
          toast.success("تم اعتماد السؤال");
        }
      )
    );

  const handleBulkApprove = async (videoId: string) => {
    setBulkBusyVideoId(videoId);
    try {
      await runAction(
        (token) => bulkApproveVideo(token, courseId, { videoId }),
        (res) => {
          setPairs((prev) => {
            if (!prev) return prev;
            const byId = new Map(res.approved.map((p) => [p.id, p]));
            return prev.map((p) => byId.get(p.id) ?? p);
          });
          toast.success(
            `تم اعتماد ${toArabicNumerals(res.approved.length)} سؤال${
              res.skipped.length ? ` — تخطّي ${toArabicNumerals(res.skipped.length)} (تحتاج مراجعة فردية)` : ""
            }`
          );
        }
      );
    } finally {
      setBulkBusyVideoId(null);
    }
  };

  const handleReject = (p: QaReviewPair) =>
    withBusy(p.id, () =>
      runAction(
        (token) => rejectPair(token, courseId, { qaDocId: p.id, rejectReason: rejectReason.trim() }),
        (res) => {
          patchPair(res.pair);
          setRejectingId(null);
          setRejectReason("");
          toast.success("تم رفض السؤال (محفوظ للسجل — لا يُحذف)");
        }
      )
    );

  const startEdit = (p: QaReviewPair) => {
    // Stop the clip while editing — keeps the preview state coherent.
    if (activePairRef.current?.id === p.id) {
      playerRef.current?.pause();
      clearActivePair();
    }
    setEditingId(p.id);
    setEditForm({ question: p.question, answer: p.answer });
  };

  const handleEditSave = (p: QaReviewPair) =>
    withBusy(p.id, () =>
      runAction(
        (token) =>
          editPair(token, courseId, {
            qaDocId: p.id,
            question: editForm.question.trim(),
            answer: editForm.answer.trim(),
          }),
        (res) => {
          patchPair(res.pair);
          setEditingId(null);
          // Belt to startEdit's suspenders: never leave the edited pair
          // active after the save.
          if (activePairRef.current?.id === p.id) {
            playerRef.current?.pause();
            clearActivePair();
          }
          toast.success("تم حفظ التعديل");
        }
      )
    );

  const handleRevoke = (p: QaReviewPair) =>
    withBusy(p.id, () =>
      runAction(
        (token) => revokeApproval(token, courseId, { qaDocId: p.id }),
        (res) => {
          patchPair(res.pair);
          toast.success("أُلغي الاعتماد — عاد السؤال إلى قائمة المراجعة");
        }
      )
    );

  // ----- render ---------------------------------------------------------------
  // The pairs view keeps its loading/error/empty states, expressed as one
  // value so the E1 view toggle below stays visible in every state.
  const pairsView = loading ? (
    <div dir="rtl" className="flex items-center justify-center gap-3 rounded-xl border bg-white p-10 text-gray-600">
      <Loader2 className="h-5 w-5 animate-spin" />
      جارٍ تحميل الأسئلة…
    </div>
  ) : loadError ? (
    <div dir="rtl" role="alert" className="flex flex-col items-center gap-4 rounded-xl border border-red-200 bg-red-50 p-8 text-red-800">
      <span>{loadError}</span>
      <Button variant="outline" onClick={load}>
        <RefreshCw className="ml-2 h-4 w-4" /> إعادة المحاولة
      </Button>
    </div>
  ) : !pairs?.length ? (
    <div dir="rtl" className="rounded-xl border bg-white p-10 text-center text-gray-600">
      لا توجد أسئلة مولّدة لهذا الكورس بعد.
    </div>
  ) : (
    <div dir="rtl" className="space-y-4">
      {/* Course-level summary */}
      <Card>
        <CardContent dir="rtl" className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="font-semibold text-blue-700">بانتظار المراجعة: {toArabicNumerals(totals.pending)}</span>
            <span className="font-semibold text-amber-700">منها معزولة (مراجعة فردية): {toArabicNumerals(totals.quarantinedPending)}</span>
            <span className="font-semibold text-green-700">معتمدة: {toArabicNumerals(totals.approved)}</span>
            <span className="font-semibold text-red-700">مرفوضة: {toArabicNumerals(totals.rejected)}</span>
            {orphanCount > 0 && (
              <span className="text-gray-500">
                {toArabicNumerals(orphanCount)} لفيديوهات لم تعد في الكورس (غير قابلة للمراجعة هنا)
              </span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="ml-2 h-4 w-4" /> تحديث
          </Button>
        </CardContent>
      </Card>

      {videosWithPairs.map(({ video, pairs: vPairs, flaggedCount, pendingClean }) => {
        const expanded = expandedVideoId === video.videoId;
        const flagRate = vPairs.length ? flaggedCount / vPairs.length : 0;
        return (
          <Card key={video.videoId} className="overflow-hidden">
            {/* Group header */}
            <button
              type="button"
              className="flex w-full flex-wrap items-center justify-between gap-3 bg-gray-50 px-4 py-3 text-right hover:bg-gray-100"
              onClick={() => {
                setExpandedVideoId(expanded ? null : video.videoId);
                setActivePairId(null);
                activePairRef.current = null;
              }}
            >
              <span className="font-semibold text-gray-800">
                {video.title}{" "}
                <span className="text-sm font-normal text-gray-500">({toArabicNumerals(vPairs.length)} سؤال)</span>
              </span>
              <span className="flex items-center gap-2">
                {pendingClean > 0 && (
                  <Button
                    size="sm"
                    disabled={disabled || bulkBusyVideoId === video.videoId}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBulkApprove(video.videoId);
                    }}
                  >
                    {bulkBusyVideoId === video.videoId ? (
                      <Loader2 className="ml-1 h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="ml-1 h-4 w-4" />
                    )}
                    اعتماد الأسئلة النظيفة ({toArabicNumerals(pendingClean)})
                  </Button>
                )}
              </span>
            </button>

            {flagRate > 0.2 && (
              <div className="flex items-center gap-2 border-y border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                جودة الصوت أثّرت على {toArabicNumerals(flaggedCount)} من {toArabicNumerals(vPairs.length)} سؤال في هذه المحاضرة — قد يستحق المقطع إعادة تسجيل.
              </div>
            )}

            {expanded && (
              <CardContent dir="rtl" className="space-y-4 p-4">
                {/* ONE player per expanded group — token thrift (§8.3). */}
                <SignedMuxPlayer
                  ref={playerRef}
                  courseId={courseId}
                  videoId={video.videoId}
                  playbackId={video.playbackId}
                  streamType="on-demand"
                  onTimeUpdate={onTimeUpdate}
                  className="w-full overflow-hidden rounded-lg"
                />

                {vPairs.map((p) => {
                  const badge = statusBadge(p);
                  const qBadge = quarantineBadge(p.quarantine);
                  const sentinel = isSentinel(p);
                  const wideSpan = !sentinel && p.sourceEndSec - p.sourceStartSec > WIDE_SPAN_SEC;
                  const busy = busyIds.has(p.id);
                  // 2026-07-14 (owner decision): one-tap approval — no
                  // attestation or numeric-confirmation gating. Sentinel
                  // stays blocked (no valid citation; server-refused too).
                  const canApprove = p.status === "pending" && !p.stale && !sentinel;

                  return (
                    <div
                      key={p.id}
                      className={`rounded-lg border p-4 ${
                        activePairId === p.id ? "border-blue-400 ring-1 ring-blue-200" : "border-gray-200"
                      }`}
                    >
                      {/* Badges + evidence line */}
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className={`rounded-full px-2 py-0.5 ${badge.cls}`}>{badge.label}</span>
                        {qBadge && <span className={`rounded-full px-2 py-0.5 ${qBadge.cls}`}>{qBadge.label}</span>}
                        {p.editedAt && (
                          <span className="rounded-full border border-purple-300 bg-purple-50 px-2 py-0.5 text-purple-700">
                            معدّل — يتطلب مراجعة فردية
                          </span>
                        )}
                        {!sentinel && (
                          <span className="text-gray-500" dir="ltr">
                            {fmtTime(p.sourceStartSec)} – {fmtTime(p.sourceEndSec)}
                          </span>
                        )}
                      </div>

                      {wideSpan && (
                        <div className="mb-2 flex items-center gap-2 rounded bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          نطاق زمني واسع (أكثر من ٥ دقائق) — تحقق بعناية قبل الاعتماد.
                        </div>
                      )}

                      {/* Q & A — read or edit */}
                      {editingId === p.id ? (
                        <div className="space-y-2">
                          <Textarea
                            dir="auto"
                            className="resize-none text-right text-base"
                            rows={2}
                            value={editForm.question}
                            onChange={(e) => setEditForm((f) => ({ ...f, question: e.target.value }))}
                          />
                          <Textarea
                            dir="auto"
                            className="resize-none text-right text-base"
                            rows={4}
                            value={editForm.answer}
                            onChange={(e) => setEditForm((f) => ({ ...f, answer: e.target.value }))}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" disabled={busy || disabled} onClick={() => handleEditSave(p)}>
                              {busy ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <Check className="ml-1 h-4 w-4" />}
                              حفظ التعديل
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                              إلغاء
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="font-semibold text-gray-900">{p.question}</p>
                          <p className="mt-1 whitespace-pre-wrap text-gray-700">{p.answer}</p>
                        </>
                      )}

                      {p.status === "rejected" && p.rejectReason && (
                        <p className="mt-2 text-sm text-red-700">سبب الرفض: {p.rejectReason}</p>
                      )}

                      {/* Reject reason input */}
                      {rejectingId === p.id && (
                        <div className="mt-3 space-y-2">
                          <Textarea
                            dir="auto"
                            className="resize-none text-right text-sm"
                            rows={2}
                            placeholder="سبب الرفض (إلزامي — السؤال يبقى محفوظاً في السجل)"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={busy || disabled || !rejectReason.trim()}
                              onClick={() => handleReject(p)}
                            >
                              {busy ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <X className="ml-1 h-4 w-4" />}
                              تأكيد الرفض
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setRejectingId(null); setRejectReason(""); }}>
                              إلغاء
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Action row */}
                      {editingId !== p.id && rejectingId !== p.id && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {!sentinel && p.status !== "rejected" && (
                            <Button size="sm" variant="outline" onClick={() => previewPair(p)}>
                              <Play className="ml-1 h-4 w-4" /> معاينة المقطع
                            </Button>
                          )}
                          {p.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                disabled={disabled || busy || !canApprove}
                                title={
                                  sentinel
                                    ? "بدون اقتباس زمني — عدّل أو ارفض"
                                    : p.stale
                                      ? "سؤال قديم — لا يمكن اعتماده"
                                      : undefined
                                }
                                onClick={() => handleApprove(p)}
                              >
                                {busy ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <Check className="ml-1 h-4 w-4" />}
                                اعتماد
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={disabled || busy}
                                onClick={() => startEdit(p)}
                              >
                                <Pencil className="ml-1 h-4 w-4" /> تعديل
                              </Button>
                            </>
                          )}
                          {p.status === "rejected" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={disabled || busy}
                              onClick={() => startEdit(p)}
                            >
                              <Pencil className="ml-1 h-4 w-4" /> تعديل وإعادة للمراجعة
                            </Button>
                          )}
                          {p.status !== "rejected" && (
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={disabled || busy}
                              onClick={() => { setRejectingId(p.id); setRejectReason(""); }}
                            >
                              <X className="ml-1 h-4 w-4" /> رفض
                            </Button>
                          )}
                          {p.status === "approved" && (
                            <Button size="sm" variant="outline" disabled={disabled || busy} onClick={() => handleRevoke(p)}>
                              {busy ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <Undo2 className="ml-1 h-4 w-4" />}
                              إلغاء الاعتماد
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );

  return (
    <div dir="rtl" className="space-y-4">
      {/* E1 segmented view toggle — practice pairs vs exam MCQs. */}
      <div className="flex w-fit gap-1 rounded-lg bg-gray-100 p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => setView("pairs")}
          className={`rounded-md px-4 py-1.5 transition ${
            view === "pairs" ? "bg-white text-gray-900 shadow" : "text-gray-500 hover:text-gray-800"
          }`}
        >
          أسئلة التدريب
        </button>
        <button
          type="button"
          onClick={() => setView("mcq")}
          className={`rounded-md px-4 py-1.5 transition ${
            view === "mcq" ? "bg-white text-gray-900 shadow" : "text-gray-500 hover:text-gray-800"
          }`}
        >
          أسئلة الامتحان (MCQ)
        </button>
      </div>
      {view === "pairs" ? (
        pairsView
      ) : (
        <McqReviewSection courseId={courseId} videos={videos} disabled={disabled} />
      )}
    </div>
  );
}
