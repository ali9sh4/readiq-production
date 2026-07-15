"use client";

// E1 step 4 — instructor MCQ review (docs/AUDIT_MCQ_TRANSFORM.md §3),
// rendered by the segmented toggle inside QaReviewTab (قرارات decision 5).
// Deliberate differences from the pair review it is modeled on:
//   - NO bulk approval anywhere (decision 2: individual-only in v1).
//   - The correct answer is rendered read-only and is NEVER editable —
//     fixing a wrong key means fixing the source pair and re-running the
//     transform (finding §3). Only the stem and the 3 distractors edit.
//   - 2026-07-14 (owner decision): approval is ONE-TAP — no attestation
//     gate, no numeric confirmation checkbox. The numeric class remains a
//     visible رقم/قياس badge only; معاينة المقطع stays as optional preview.
//   - Each card shows its SOURCE pair (question/answer/status) so the
//     reviewer verifies faithfulness in place; a diverged source disables
//     approval up front (the server re-checks inside the transaction anyway).

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
  approveMcq,
  editMcq,
  listMcqForReview,
  rejectMcq,
  revokeMcqApproval,
  type McqReviewFailure,
  type McqReviewItem,
} from "@/app/actions/mcq_review_actions";
import { localizeMcqReviewError } from "@/lib/qa/localizeError";
import { withStableHeader } from "@/components/qa_review/keepHeaderStable";
import type { CourseVideo } from "@/types/types";

type MuxPlayerRef = ComponentRef<typeof MuxPlayer>;

interface Props {
  courseId: string;
  videos: CourseVideo[];
  disabled?: boolean;
}

const WIDE_SPAN_SEC = 300; // §8.2 — one tick in a >5min window is weak attestation

// Display-only Arabic-Indic digits (same rule as QaReviewTab — never applied
// to state or payloads).
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
function toArabicNumerals(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => ARABIC_DIGITS[Number(d)]);
}
function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return toArabicNumerals(`${m}:${String(s).padStart(2, "0")}`);
}

function statusBadge(item: McqReviewItem) {
  if (item.stale)
    return { label: "قديم — أعد تشغيل التحويل", cls: "bg-gray-100 text-gray-500 border border-gray-300" };
  switch (item.status) {
    case "approved":
      return { label: "معتمد", cls: "bg-green-100 text-green-800 border border-green-300" };
    case "rejected":
      return { label: "مرفوض", cls: "bg-red-50 text-red-700 border border-red-200" };
    default:
      return { label: "بانتظار المراجعة", cls: "bg-blue-50 text-blue-700 border border-blue-200" };
  }
}

export default function McqReviewSection({ courseId, videos, disabled }: Props) {
  const auth = useAuth();

  const [items, setItems] = useState<McqReviewItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ stem: string; distractors: string[] }>({
    stem: "",
    distractors: ["", "", ""],
  });
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const playerRef = useRef<MuxPlayerRef>(null);
  // Mirror of the active item for the timeupdate closure (fake-stop UX).
  const activeItemRef = useRef<McqReviewItem | null>(null);

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
      const res = await listMcqForReview(token, courseId);
      if (!res.success) setLoadError(localizeMcqReviewError(res));
      else setItems(res.items);
    } catch {
      setLoadError("تعذّر تحميل الأسئلة — تحقق من الاتصال وأعد المحاولة.");
    } finally {
      setLoading(false);
    }
  }, [courseId, getToken]);

  useEffect(() => {
    load();
  }, [load]);

  const videosWithItems = useMemo(() => {
    if (!items) return [];
    const byVideo = new Map<string, McqReviewItem[]>();
    for (const it of items) {
      const list = byVideo.get(it.videoId) ?? [];
      list.push(it);
      byVideo.set(it.videoId, list);
    }
    const ordered = [...videos]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .filter((v) => byVideo.has(v.videoId));
    return ordered.map((v) => {
      const list = byVideo.get(v.videoId)!;
      const sorted = [...list].sort((a, b) => {
        // Numeric-first (the class worth the closest look), then lecture order.
        const aq = a.quarantine === "numeric" ? 0 : 1;
        const bq = b.quarantine === "numeric" ? 0 : 1;
        if (aq !== bq) return aq - bq;
        return a.sourceStartSec - b.sourceStartSec;
      });
      return { video: v, items: sorted };
    });
  }, [items, videos]);

  const totals = useMemo(() => {
    const t = { pending: 0, approved: 0, rejected: 0, numericPending: 0, diverged: 0 };
    for (const it of items ?? []) {
      if (it.status === "pending") {
        t.pending++;
        if (it.quarantine === "numeric") t.numericPending++;
      } else if (it.status === "approved") t.approved++;
      else t.rejected++;
      if (it.sourceDiverged) t.diverged++;
    }
    return t;
  }, [items]);

  // ----- attestation ----------------------------------------------------
  const clearActiveItem = () => {
    activeItemRef.current = null;
    setActiveItemId(null);
  };

  const previewItem = (it: McqReviewItem) => {
    const player = playerRef.current;
    if (!player) {
      toast.info("الفيديو قيد التحميل — انتظر لحظة ثم أعد المحاولة");
      return;
    }
    activeItemRef.current = it;
    setActiveItemId(it.id);
    player.currentTime = it.sourceStartSec;
    void player.play()?.catch(() => {});
  };

  const onTimeUpdate = () => {
    const active = activeItemRef.current;
    const player = playerRef.current;
    if (!active || !player) return;
    const t = player.currentTime;
    if (typeof t !== "number") return;
    if (t >= active.sourceEndSec) {
      player.pause();
      clearActiveItem();
    }
  };

  // ----- mutations (local-state mirror, no router.refresh) ---------------
  // Mutation responses don't re-join the source pair — preserve the panel
  // and divergence flag from the previous state unless the response has one.
  const patchItem = (updated: McqReviewItem) =>
    setItems(
      (prev) =>
        prev?.map((it) =>
          it.id === updated.id
            ? {
                ...updated,
                sourcePair: updated.sourcePair ?? it.sourcePair,
                sourceDiverged: updated.sourcePair ? updated.sourceDiverged : it.sourceDiverged,
              }
            : it
        ) ?? prev
    );

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

  const runAction = async <T extends { success: true } | McqReviewFailure>(
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
      if (!res.success) toast.error(localizeMcqReviewError(res as McqReviewFailure));
      else onSuccess(res as Extract<T, { success: true }>);
    } catch {
      toast.error("حدث خطأ غير متوقع. حاول مرة أخرى.");
    }
  };

  const handleApprove = (it: McqReviewItem) =>
    withBusy(it.id, () =>
      runAction(
        (token) => approveMcq(token, courseId, { mcqDocId: it.id }),
        (res) => {
          patchItem(res.item);
          toast.success("تم اعتماد سؤال الامتحان");
        }
      )
    );

  const handleReject = (it: McqReviewItem) =>
    withBusy(it.id, () =>
      runAction(
        (token) => rejectMcq(token, courseId, { mcqDocId: it.id, rejectReason: rejectReason.trim() }),
        (res) => {
          patchItem(res.item);
          setRejectingId(null);
          setRejectReason("");
          toast.success("تم رفض السؤال (محفوظ للسجل — لا يُحذف)");
        }
      )
    );

  const startEdit = (it: McqReviewItem) => {
    // Stop the clip while editing — keeps the preview state coherent.
    if (activeItemRef.current?.id === it.id) {
      playerRef.current?.pause();
      clearActiveItem();
    }
    setEditingId(it.id);
    setEditForm({ stem: it.stem, distractors: [...it.distractors] });
  };

  const handleEditSave = (it: McqReviewItem) =>
    withBusy(it.id, () =>
      runAction(
        (token) =>
          editMcq(token, courseId, {
            mcqDocId: it.id,
            stem: editForm.stem.trim(),
            distractors: editForm.distractors.map((d) => d.trim()),
          }),
        (res) => {
          patchItem(res.item);
          setEditingId(null);
          if (activeItemRef.current?.id === it.id) {
            playerRef.current?.pause();
            clearActiveItem();
          }
          toast.success("تم حفظ التعديل");
        }
      )
    );

  const handleRevoke = (it: McqReviewItem) =>
    withBusy(it.id, () =>
      runAction(
        (token) => revokeMcqApproval(token, courseId, { mcqDocId: it.id }),
        (res) => {
          patchItem(res.item);
          toast.success("أُلغي الاعتماد — عاد السؤال إلى قائمة المراجعة");
        }
      )
    );

  // ----- render -----------------------------------------------------------
  if (loading) {
    return (
      <div dir="rtl" className="flex items-center justify-center gap-3 rounded-xl border bg-white p-10 text-gray-600">
        <Loader2 className="h-5 w-5 animate-spin" />
        جارٍ تحميل أسئلة الامتحان…
      </div>
    );
  }
  if (loadError) {
    return (
      <div dir="rtl" role="alert" className="flex flex-col items-center gap-4 rounded-xl border border-red-200 bg-red-50 p-8 text-red-800">
        <span>{loadError}</span>
        <Button variant="outline" onClick={load}>
          <RefreshCw className="ml-2 h-4 w-4" /> إعادة المحاولة
        </Button>
      </div>
    );
  }
  if (!items?.length) {
    return (
      <div dir="rtl" className="rounded-xl border bg-white p-10 text-center text-gray-600">
        لا توجد أسئلة امتحان لهذا الكورس بعد — راجِع أسئلة التدريب واعتمدها أولاً، ثم تُولَّد أسئلة الامتحان (MCQ) من الأسئلة المعتمدة.
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-4">
      <Card>
        <CardContent dir="rtl" className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="font-semibold text-blue-700">بانتظار المراجعة: {toArabicNumerals(totals.pending)}</span>
            <span className="font-semibold text-amber-700">منها رقمية: {toArabicNumerals(totals.numericPending)}</span>
            <span className="font-semibold text-green-700">معتمدة: {toArabicNumerals(totals.approved)}</span>
            <span className="font-semibold text-red-700">مرفوضة: {toArabicNumerals(totals.rejected)}</span>
            {totals.diverged > 0 && (
              <span className="text-gray-500">{toArabicNumerals(totals.diverged)} تغيّر مصدرها — تحتاج إعادة تحويل</span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="ml-2 h-4 w-4" /> تحديث
          </Button>
        </CardContent>
      </Card>

      <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">
        الاعتماد فردي فقط — كل سؤال امتحان يُراجَع على حدة قبل دخوله بنك الامتحان. لا يوجد اعتماد جماعي هنا.
      </p>

      {videosWithItems.map(({ video, items: vItems }) => {
        const expanded = expandedVideoId === video.videoId;
        return (
          <Card key={video.videoId} className="overflow-hidden">
            <button
              type="button"
              className="flex w-full flex-wrap items-center justify-between gap-3 bg-gray-50 px-4 py-3 text-right hover:bg-gray-100"
              onClick={(e) =>
                // Expansion must not move the viewport (see keepHeaderStable).
                withStableHeader(e.currentTarget, () => {
                  setExpandedVideoId(expanded ? null : video.videoId);
                  clearActiveItem();
                })
              }
            >
              <span className="font-semibold text-gray-800">
                {video.title}{" "}
                <span className="text-sm font-normal text-gray-500">({toArabicNumerals(vItems.length)} سؤال امتحان)</span>
              </span>
            </button>

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

                {vItems.map((it) => {
                  const badge = statusBadge(it);
                  const busy = busyIds.has(it.id);
                  const wideSpan = it.sourceEndSec - it.sourceStartSec > WIDE_SPAN_SEC;
                  // 2026-07-14 (owner decision): one-tap approval — only
                  // integrity states (stale / diverged source) block it.
                  const canApprove = it.status === "pending" && !it.stale && !it.sourceDiverged;

                  return (
                    <div
                      key={it.id}
                      className={`rounded-lg border p-4 ${
                        activeItemId === it.id ? "border-blue-400 ring-1 ring-blue-200" : "border-gray-200"
                      }`}
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className={`rounded-full px-2 py-0.5 ${badge.cls}`}>{badge.label}</span>
                        {it.quarantine === "numeric" && (
                          <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-amber-800">
                            رقم / قياس
                          </span>
                        )}
                        {it.editedAt && (
                          <span className="rounded-full border border-purple-300 bg-purple-50 px-2 py-0.5 text-purple-700">
                            معدّل
                          </span>
                        )}
                        {it.sourceDiverged && (
                          <span className="rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-red-700">
                            المصدر تغيّر — أعد التحويل
                          </span>
                        )}
                        {it.lintWarnings.includes("longest-option-is-correct") && (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                            الإجابة الصحيحة أطول الخيارات بوضوح
                          </span>
                        )}
                        <span className="text-gray-500" dir="ltr">
                          {fmtTime(it.sourceStartSec)} – {fmtTime(it.sourceEndSec)}
                        </span>
                      </div>

                      {wideSpan && (
                        <div className="mb-2 flex items-center gap-2 rounded bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          نطاق زمني واسع (أكثر من ٥ دقائق) — تحقق بعناية قبل الاعتماد.
                        </div>
                      )}

                      {/* Stem + options — read or edit */}
                      {editingId === it.id ? (
                        <div className="space-y-2">
                          <Textarea
                            dir="auto"
                            className="resize-none text-right text-base"
                            rows={2}
                            value={editForm.stem}
                            onChange={(e) => setEditForm((f) => ({ ...f, stem: e.target.value }))}
                          />
                          {/* The key is displayed but NOT editable — by design. */}
                          <div className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900">
                            <span className="font-semibold">الإجابة الصحيحة (غير قابلة للتعديل):</span>{" "}
                            {it.correctAnswer}
                          </div>
                          {editForm.distractors.map((d, i) => (
                            <Textarea
                              key={i}
                              dir="auto"
                              className="resize-none text-right text-sm"
                              rows={2}
                              placeholder={`البديل ${toArabicNumerals(i + 1)}`}
                              value={d}
                              onChange={(e) =>
                                setEditForm((f) => ({
                                  ...f,
                                  distractors: f.distractors.map((x, j) => (j === i ? e.target.value : x)),
                                }))
                              }
                            />
                          ))}
                          <div className="flex gap-2">
                            <Button size="sm" disabled={busy || disabled} onClick={() => handleEditSave(it)}>
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
                          <p className="font-semibold text-gray-900">{it.stem}</p>
                          <ul className="mt-2 space-y-1.5">
                            <li className="flex items-start gap-2 rounded border border-green-300 bg-green-50 px-3 py-1.5 text-sm text-green-900">
                              <Check className="mt-0.5 h-4 w-4 shrink-0" />
                              <span>
                                {it.correctAnswer}
                                <span className="mr-2 text-xs text-green-700">— الإجابة الصحيحة (غير قابلة للتعديل)</span>
                              </span>
                            </li>
                            {it.distractors.map((d, i) => (
                              <li key={i} className="rounded border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700">
                                {d}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}

                      {/* Source pair — faithfulness panel */}
                      {it.sourcePair && editingId !== it.id && (
                        <details className="mt-3 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                          <summary className="cursor-pointer text-gray-600">السؤال المصدر (المعتمد)</summary>
                          <p className="mt-2 font-medium text-gray-800">{it.sourcePair.question}</p>
                          <p className="mt-1 whitespace-pre-wrap text-gray-600">{it.sourcePair.answer}</p>
                        </details>
                      )}

                      {it.status === "rejected" && it.rejectReason && (
                        <p className="mt-2 text-sm text-red-700">سبب الرفض: {it.rejectReason}</p>
                      )}

                      {/* Reject reason input */}
                      {rejectingId === it.id && (
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
                              onClick={() => handleReject(it)}
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
                      {editingId !== it.id && rejectingId !== it.id && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {it.status !== "rejected" && (
                            <Button size="sm" variant="outline" onClick={() => previewItem(it)}>
                              <Play className="ml-1 h-4 w-4" /> معاينة المقطع
                            </Button>
                          )}
                          {it.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                disabled={disabled || busy || !canApprove}
                                title={
                                  it.sourceDiverged
                                    ? "السؤال المصدر تغيّر — أعد تشغيل التحويل"
                                    : it.stale
                                      ? "سؤال قديم — لا يمكن اعتماده"
                                      : undefined
                                }
                                onClick={() => handleApprove(it)}
                              >
                                {busy ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <Check className="ml-1 h-4 w-4" />}
                                اعتماد
                              </Button>
                              <Button size="sm" variant="outline" disabled={disabled || busy} onClick={() => startEdit(it)}>
                                <Pencil className="ml-1 h-4 w-4" /> تعديل البدائل
                              </Button>
                            </>
                          )}
                          {it.status === "rejected" && (
                            <Button size="sm" variant="outline" disabled={disabled || busy} onClick={() => startEdit(it)}>
                              <Pencil className="ml-1 h-4 w-4" /> تعديل وإعادة للمراجعة
                            </Button>
                          )}
                          {it.status !== "rejected" && (
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={disabled || busy}
                              onClick={() => { setRejectingId(it.id); setRejectReason(""); }}
                            >
                              <X className="ml-1 h-4 w-4" /> رفض
                            </Button>
                          )}
                          {it.status === "approved" && (
                            <Button size="sm" variant="outline" disabled={disabled || busy} onClick={() => handleRevoke(it)}>
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
}
