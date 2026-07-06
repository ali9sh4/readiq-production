"use client";

// Student flashcard recall deck — Phase 3 slice 4 (Format A) of
// docs/RUBIK_STUDY_FEATURES.md; build plan docs/AUDIT_STUDY_DECK.md §7.
//
// Deliberately standalone: CoursePlayer merely mounts it, so the deck
// survives the throwaway viewer's deletion and can re-host on a future
// practice route (§13 q2, decided web-first 2026-07-04).
//
// Card flow (non-goal 9 compliant — no pre-reveal confidence prompts):
// question → student attempts recall → reveal → self-grade نعم/لا →
// on لا the card re-queues in-session and offers the "شاهد الشرح" clip
// jump (only when the server said hasValidClip — §8.2). Self-grade state is
// session-only React state (persistence + SRS is Phase 5); event logging is
// slice 6, deliberately NOT wired here.
//
// Clip playback (§8.3 token budget): ONE SignedMuxPlayer mounted for the
// deck's lifetime — one token mint per (courseId, videoId) session — kept
// hidden until the first jump, seeked via ref with a ~15 s pre-roll, and
// fake-stopped at sourceEndSec by a one-shot timeupdate check (client UX
// only; the token plays the whole video by design, non-goal 6).

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import type MuxPlayer from "@mux/mux-player-react";
import {
  Check,
  Eye,
  Loader2,
  Play,
  RefreshCw,
  X,
} from "lucide-react";
import { useAuth } from "@/context/authContext";
import SignedMuxPlayer from "@/components/SignedMuxPlayer";
import { Button } from "@/components/ui/button";
import {
  listApprovedQaForStudy,
  type QaStudyCard,
} from "@/app/actions/qa_study_actions";
import { localizeQaStudyError } from "@/lib/qa/localizeError";

type MuxPlayerRef = ComponentRef<typeof MuxPlayer>;

interface Props {
  courseId: string;
  videoId: string;
  playbackId?: string | null;
  /**
   * False while the host keeps the deck mounted but hidden (e.g. the
   * student peeked at another tab). Hiding must not leave clip audio
   * playing invisibly, so the deck pauses/closes its clip when inactive.
   */
  active?: boolean;
  /**
   * Fired right before a clip starts playing — the host uses it to pause
   * its main lesson player so two audio streams of the same lecture never
   * overlap.
   */
  onClipPlay?: () => void;
  /**
   * The reverse direction of onClipPlay: increments whenever the host's
   * main player starts playing; the deck closes its clip in response.
   */
  closeClipSignal?: number;
}

// §8.2 hedged seek: land shortly before the cited moment, never promise
// exact seconds. The copy says "قرب الدقيقة" for the same reason.
const PRE_ROLL_SEC = 15;

// Display-only Arabic-Indic numerals — same convention as QaReviewTab
// (deterministic mapping, never applied to state or payloads).
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
function toArabicNumerals(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => ARABIC_DIGITS[Number(d)]);
}
function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return toArabicNumerals(`${m}:${String(s).padStart(2, "0")}`);
}

type Phase = "question" | "revealed" | "missed";

export default function QaStudyDeck({
  courseId,
  videoId,
  playbackId,
  active = true,
  onClipPlay,
  closeClipSignal = 0,
}: Props) {
  const auth = useAuth();

  const [cards, setCards] = useState<QaStudyCard[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Session state (Format A: React state only, nothing persisted).
  const [queue, setQueue] = useState<QaStudyCard[]>([]);
  const [phase, setPhase] = useState<Phase>("question");
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());
  const [missCount, setMissCount] = useState(0);

  // Clip state. activeClipRef mirrors clipCard for the timeupdate closure —
  // binding the fake-stop to the active card only (same pattern as the
  // review tab's attestation check).
  const [clipCard, setClipCard] = useState<QaStudyCard | null>(null);
  const playerRef = useRef<MuxPlayerRef>(null);
  const activeClipRef = useRef<QaStudyCard | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    let token: string | null = null;
    try {
      token = (await auth?.user?.getIdToken()) ?? null;
    } catch {
      token = null;
    }
    if (!token) {
      setLoadError("انتهت الجلسة — يرجى تسجيل الدخول من جديد.");
      setLoading(false);
      return;
    }
    try {
      const res = await listApprovedQaForStudy(token, { courseId, videoId });
      if (!res.success) {
        setLoadError(localizeQaStudyError(res));
      } else {
        setCards(res.cards);
        setQueue(res.cards);
        setPhase("question");
        setMasteredIds(new Set());
        setMissCount(0);
      }
    } catch {
      setLoadError("تعذّر تحميل البطاقات — تحقق من الاتصال وأعد المحاولة.");
    } finally {
      setLoading(false);
    }
  }, [auth?.user, courseId, videoId]);

  useEffect(() => {
    load();
  }, [load]);

  const current = queue[0] ?? null;
  const total = cards?.length ?? 0;
  const mastered = masteredIds.size;
  const progressPct = total ? Math.round((mastered / total) * 100) : 0;

  // ----- clip jump -----------------------------------------------------------
  const closeClip = useCallback(() => {
    playerRef.current?.pause();
    activeClipRef.current = null;
    setClipCard(null);
  }, []);

  // Hidden-not-unmounted host tabs: never leave clip audio playing
  // invisibly.
  useEffect(() => {
    if (!active) closeClip();
  }, [active, closeClip]);

  // Host's main player started playing — close our clip (the symmetric
  // half of onClipPlay). Signal 0 = never fired.
  useEffect(() => {
    if (closeClipSignal > 0) closeClip();
  }, [closeClipSignal, closeClip]);

  const jumpToClip = (card: QaStudyCard) => {
    // Reveal the player region FIRST. playerRef is null not only while the
    // token is in flight but also when SignedMuxPlayer is showing its
    // retriable ErrorPlaceholder (mint failed / rate-limited) — keeping the
    // region hidden in that state would bury the retry button and dead-end
    // the clip jump for the whole session (adversarial-review finding).
    setClipCard(card);
    const player = playerRef.current;
    if (!player) {
      // The now-visible placeholder (loading or error+retry) communicates
      // state; the fake-stop is deliberately NOT armed since no seek
      // happened — the student taps شاهد الشرح again once the player is up.
      return;
    }
    activeClipRef.current = card;
    onClipPlay?.();
    player.currentTime = Math.max(0, card.sourceStartSec - PRE_ROLL_SEC);
    void player.play()?.catch(() => {});
  };

  const onTimeUpdate = () => {
    const active = activeClipRef.current;
    const player = playerRef.current;
    if (!active || !player) return;
    const t = player.currentTime;
    if (typeof t !== "number") return;
    if (t >= active.sourceEndSec) {
      // One-shot fake stop (§8.3): clear the active card so the student can
      // free-play past the window without being re-paused every tick.
      player.pause();
      activeClipRef.current = null;
    }
  };

  // ----- card flow ------------------------------------------------------------
  const gradeYes = () => {
    if (!current) return;
    setMasteredIds((prev) => {
      const next = new Set(prev);
      next.add(current.qaId);
      return next;
    });
    closeClip();
    setQueue((prev) => prev.slice(1));
    setPhase("question");
  };

  const gradeNo = () => {
    if (!current) return;
    setMissCount((n) => n + 1);
    // Re-queue at the back for another attempt this session. NB: the card
    // moves NOW, so the "missed" phase renders the back of the queue and
    // moving on must NOT slice again (queue[0] is already the next card).
    setQueue((prev) => [...prev.slice(1), prev[0]]);
    setPhase("missed");
  };

  const nextAfterMiss = () => {
    closeClip();
    setPhase("question");
  };

  // In the "missed" phase the current card moved to the back of the queue,
  // so render the card the student just missed (last item), not queue[0].
  const missedCard = phase === "missed" ? queue[queue.length - 1] ?? null : null;
  const shown = phase === "missed" ? missedCard : current;

  const restart = () => {
    if (!cards) return;
    closeClip();
    setQueue(cards);
    setPhase("question");
    setMasteredIds(new Set());
    setMissCount(0);
  };

  // ----- render ---------------------------------------------------------------
  if (loading) {
    return (
      <div
        dir="rtl"
        className="flex items-center justify-center gap-3 rounded-xl border bg-white p-10 text-gray-600"
      >
        <Loader2 className="h-5 w-5 animate-spin" />
        جارٍ تحميل البطاقات…
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        dir="rtl"
        role="alert"
        className="flex flex-col items-center gap-4 rounded-xl border border-red-200 bg-red-50 p-8 text-red-800"
      >
        <span>{loadError}</span>
        <Button variant="outline" onClick={load}>
          <RefreshCw className="ml-2 h-4 w-4" /> إعادة المحاولة
        </Button>
      </div>
    );
  }

  if (!cards?.length) {
    return (
      <div
        dir="rtl"
        className="rounded-xl border bg-white p-10 text-center text-gray-600"
      >
        لا توجد بطاقات معتمدة لهذا الدرس بعد.
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3">
        <span className="text-sm font-semibold text-gray-700">
          أتقنت {toArabicNumerals(mastered)} من {toArabicNumerals(total)}
        </span>
        <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-100 sm:w-48">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Clip player — ONE mounted player for the whole deck session,
          hidden until the first jump. Unmounting it per card would re-mint
          tokens against the 30/min limit (§8.3). */}
      <div className={clipCard ? "space-y-2" : "hidden"}>
        {clipCard && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">
            <span>
              الشرح يبدأ قرب الدقيقة{" "}
              <span dir="ltr">{fmtTime(clipCard.sourceStartSec)}</span>
            </span>
            <button
              type="button"
              onClick={closeClip}
              className="rounded p-1 text-blue-700 hover:bg-blue-100"
              aria-label="إغلاق المقطع"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <SignedMuxPlayer
          ref={playerRef}
          courseId={courseId}
          videoId={videoId}
          playbackId={playbackId ?? undefined}
          streamType="on-demand"
          onTimeUpdate={onTimeUpdate}
          className="w-full overflow-hidden rounded-lg"
        />
      </div>

      {/* Card or session summary */}
      {shown ? (
        <div className="rounded-xl border bg-white p-5 lg:p-8">
          <p dir="auto" className="text-base font-semibold leading-relaxed text-gray-900 lg:text-lg">
            {shown.question}
          </p>

          {phase === "question" ? (
            <div className="mt-6 flex justify-center">
              <Button onClick={() => setPhase("revealed")}>
                <Eye className="ml-2 h-4 w-4" /> اعرض الجواب
              </Button>
            </div>
          ) : (
            <>
              <div className="mt-4 rounded-lg bg-gray-50 p-4">
                <p dir="auto" className="whitespace-pre-wrap leading-relaxed text-gray-800">
                  {shown.answer}
                </p>
              </div>

              {phase === "revealed" && (
                <div className="mt-5">
                  <p className="mb-3 text-center text-sm text-gray-500">
                    هل تذكّرت الجواب؟
                  </p>
                  <div className="flex justify-center gap-3">
                    <Button
                      onClick={gradeYes}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="ml-2 h-4 w-4" /> نعم
                    </Button>
                    <Button onClick={gradeNo} variant="destructive">
                      <X className="ml-2 h-4 w-4" /> لا
                    </Button>
                  </div>
                </div>
              )}

              {phase === "missed" && (
                <div className="mt-5 space-y-3">
                  <p className="text-center text-sm text-gray-500">
                    لا بأس — ستظهر هذه البطاقة مرة أخرى في نهاية الجولة.
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    {shown.hasValidClip && (
                      <Button variant="outline" onClick={() => jumpToClip(shown)}>
                        <Play className="ml-2 h-4 w-4" />
                        شاهد الشرح{" "}
                        <span dir="ltr" className="mr-1">
                          {fmtTime(shown.sourceStartSec)}
                        </span>
                      </Button>
                    )}
                    <Button onClick={nextAfterMiss}>التالي</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* queue empty → session summary */
        <div className="rounded-xl border bg-white p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <p className="text-lg font-semibold text-gray-900">
            أحسنت! أكملت بطاقات هذا الدرس
          </p>
          <p className="mt-2 text-sm text-gray-600">
            أتقنت {toArabicNumerals(mastered)} من {toArabicNumerals(total)}
            {missCount > 0 && (
              <> — احتجت {toArabicNumerals(missCount)} إعادة</>
            )}
          </p>
          <Button onClick={restart} variant="outline" className="mt-5">
            <RefreshCw className="ml-2 h-4 w-4" /> إعادة التدريب
          </Button>
        </div>
      )}
    </div>
  );
}
