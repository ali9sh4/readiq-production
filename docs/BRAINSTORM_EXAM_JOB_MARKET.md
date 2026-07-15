# Final exam → Rubik Job Market — brainstorm (pre-design)

---
**قرارات نهائية — 2026-07-07 (يحل محل §3, §5–§8, §11)**

1. **الشكل:** امتحان MCQ موقوت فقط، مولّد من أسئلة التدريب المعتمدة نفسها.
   لا فايفا، لا بنك أسئلة منفصل.
2. **السعر:** مجاني. الكلفة مدمجة في تسعير الدورات الجديدة.
3. **المحاولات: محاولة واحدة فقط، نهائياً.** تحذير واضح قبل البدء + نافذة
   تأكيد. المؤقّت خادمي ولا يتوقف — مغادرة الامتحان لا تلغيه.
   (زر إعادة تعيين للأدمن فقط، للحالات القاهرة، غير معلن.)
4. **التصحيح:** مفتاح حتمي، كل سؤال معتمد من المحاضر قبل دخوله الامتحان،
   بوابة الأرقام الصارمة مستمرة.
   *(تعديل 2026-07-14: بوابة الأرقام أصبحت تصنيفاً وشارة فقط — الاعتماد
   بضغطة واحدة دون شروط، بقرار المالك.)*
5. **سوق التوظيف:** قائمة اختيارية (opt-in) — اسم، دورة، "متاح للمقابلات"،
   تواصل. لا درجات معلنة، لا كلمة "شهادة" إطلاقاً. السوق أداة اكتشاف
   للمقابلات، ليس اعتماداً.
6. **التسريب:** مقبول حالياً؛ يُعاد النظر عند ظهور إساءة فعلية.
7. **الاسم:** سوق التوظيف.
---

**Status:** Brainstorm. **Nothing here is decided or built.** This doc exists
to be argued with before any code. It extends — and must not contradict —
`docs/RUBIK_STUDY_FEATURES.md` §9 Phase 8 (exam & certification, *demoted
behind prerequisites*, DECIDED) and its content-safety invariants (§4).
**Date:** 2026-07-07.

---

## 1. The vision, restated precisely

Each course gets a **final exam**: timed, attempt-limited, taken after
enrollment. The result feeds a new surface — the **Rubik Job Market** — where
employers see a verified credential and hire on it. "Get certified, get
hired." It is the endgame the whole timestamp-graph asset points at.

## 2. The core tension: the trust budget

A hiring credential raises the stakes **above** certificates, not below:

- A **cheatable** exam devalues every honest candidate's credential and, once
  employers notice, kills the feature retroactively for everyone who earned it.
- An **inaccurate** exam (bad items, wrong grading) wrongly brands a real
  person as incompetent in front of employers. That is a harm to a named
  individual, not a UX bug.

Phase 8 was demoted for exactly these reasons — a summative "/100" is not
buildable on the current bank (exposure-contaminated, recall-level, no item
stats, no blueprint, no standard setting). **The Job Market makes that
reasoning bind harder, not softer.** So the play is not to skip the Phase 8
ladder; it is to climb it deliberately, and to buy trust from the one source
this market already trusts:

> **The credible unit of trust in the Iraqi dental market is the instructor**
> (Phase 8, prerequisite 4). The exam is supporting evidence; the
> instructor's endorsement is the headline. This reframe honestly lowers the
> v1 psychometric bar: the credential claims "examined and endorsed under
> Dr. X's supervision," never "Rubik certifies clinical competence."

Everything below is arranged around that trade.

---

## 3. Fork 1 — exam format

The corpus is open-ended viva Q&A (question + free-text answer) by design;
Iraqi dental assessment is oral. No format is free:

| Option | Grading | Cheat resistance | Verdict |
|---|---|---|---|
| **A. MCQ-only credential** | Deterministic key — defensible, timeable, item stats possible | Weak unproctored: an LLM answers MCQs in seconds | Necessary but not sufficient |
| **B. Typed free answers + AI grading (Haiku)** | Probabilistic. A grading error *fails a person* in front of employers; Arabic morphology makes appeals ugly | Same LLM exposure as A | **Out for summative v1.** The vision doc already confines LLM grading to bounded low-stakes modes (checkpoints), behind the chat cost rails. Keep it there. |
| **C. Timed MCQ screen → instructor viva** | MCQ: deterministic. Viva: instructor rubric | Viva is the strongest cheap layer: you cannot ChatGPT a live oral answer | **Recommended pilot shape** |
| **D. In-person exam sittings** (partner clinic/college) | Any | Strongest | Real option later; a BD project, not a code project |

**Recommendation: C.** The timed, one-at-a-time MCQ exam screens for
seriousness and knowledge cheaply at any scale; candidates who clear the bar
get a short (10–15 min, recorded) oral viva conducted by the instructor over
the same corpus. The viva is the *native* format for this market, it is where
identity gets confirmed (§5), and at pilot scale (founder's own course) its
cost is a calendar problem, not an engineering problem. The credential is
issued only after the viva. Scaling the viva is a later problem — and by
then option D and proctoring exist as alternatives.

## 4. Fork 2 — where exam items come from (the held-out pool)

The practice deck **is** the current bank; any exam drawn from it measures
"memorized the deck." Phase 8 prerequisite 2 already demands a separate,
unexposed pool. Cheapest honest path:

- **Regenerate from the existing transcripts.** Q&A generation is
  non-deterministic across runs (proven: the 2026-07-03 regeneration changed
  pair counts), so a fresh run over the same transcripts yields new pairs.
  Dedupe against the practice bank by `contentHash` (the module exists).
  Transcripts are already on disk — no new transcription cost.
- **Review with the machinery we already built.** Exam-pool items go through
  the same quarantine classes, numeric tripwire, and instructor review tab —
  the Phase 2 UI is format-agnostic enough to host a second pool.
- **Land them in a separate subcollection** — proposal:
  `courses/{courseId}/examItems/{id}`, **not** `qa/`. Two reasons:
  1. Content-safety invariant 1 says approved `qa` pairs are servable to
     students. Exam items must *never* be servable pre-exam. Making the
     separation **structural** (different collection, deny-all, only the exam
     runtime reads it) beats making it a status flag someone forgets to check.
  2. The §5.3 regeneration firewall governs `qa` imports; a parallel pool
     avoids torturing its migrate semantics.
- **MCQ transform** (Phase 6's design, unchanged): offline Sonnet pass whose
  distractors are other true statements from *inside* the course corpus — the
  only distractor source compatible with the no-invention grounding rule.
  Expected yield ~40–60%, so generate the open-ended pool oversized.
- **Blueprint on the cheap:** every pair is welded to a video, and videos
  belong to sections. Sections *are* the topic blueprint for v1 — each exam
  form carries a per-section minimum/maximum. No tagging pass needed to start.

**Leakage posture (assume, don't hope):** any administered bank is public
~30 days later (screenshots → Telegram — the vision doc's own assumption).
Mitigations: pool ≥ 4–5× form length with per-student random forms; item-stat
drift detection (an item whose pass rate jumps suddenly has leaked → retire);
scheduled rotation via fresh regeneration runs (cheap by design). The
defensible asset stays the remediation loop and enrollment-gated clips, which
cannot leak.

## 5. Fork 3 — anti-cheat, honestly

Said plainly so nobody designs against the wrong threat model: **an
unproctored browser exam cannot stop a determined cheater with a second
device or an LLM.** Timing pressure raises the cost; it does not make it
zero. The layers that actually carry weight:

1. **Server-side, one-item-at-a-time serving.** The full form is *never* sent
   to the client (else devtools dumps the bank). Answer submission per item,
   server-timestamped; per-item time limit enforced server-side (late answer
   = unanswered); **no going back**.
2. **Server-authoritative attempt lifecycle.** Attempt doc at
   `exams/{examId}/attempts/{uid}` — the doc ID **is** the uid, created
   transactionally, so a second attempt cannot be created; states
   `in_progress → submitted | expired`, all timestamps server-derived; the
   deadline lives on the attempt doc and submission past it is refused.
3. **Randomized forms** per student (draw + shuffle from the pool, section
   quotas honored), so neighbors hold different exams.
4. **An exam fee (wallet-priced, web-only).** Aligns with Phase 8
   prerequisite 5 and quietly taxes multiple-account attempts.
5. **The viva layer (§3).** Real-time oral answering on camera is the one
   cheap check an LLM can't sit.
6. **Identity.** A Firebase account is not a person, and a hiring credential
   without identity is fiction. Pilot answer: the instructor confirms
   identity at the viva (he knows his students by face and name). Post-pilot:
   an ID step at certificate issuance — open question q3.

What deliberately does **not** ship in v1: webcam proctoring software,
browser lockdown, keystroke forensics. Heavy, privacy-hostile, and defeated
by a phone on the desk anyway. The viva buys more trust for less.

## 6. Fork 4 — attempt policy

Strict one-attempt-*ever* maximizes the incentive to cheat (stakes are
absolute) and deters honest candidates from ever sitting. Counter-proposal:

- One attempt per **exam form generation**; a retake is allowed after a
  cooldown (e.g. 60–90 days) **on a fresh form**.
- Attempt history is immutable and the verify page shows the latest band
  **plus the attempt number** ("المحاولة الثانية"). Employers see honesty,
  candidates keep a path to redemption, and the perverse incentive drops.

The "once, counter-gated" enforcement machinery (§5.2) is identical either
way — the policy is a knob on top. **Needs an owner decision (q2).**

## 7. The credential — what an employer actually sees

Phase 8 prerequisite 4 already specifies the right skeleton; sharpened:

- **The verify page IS the credential.** `/verify/{certId}` (unguessable ID,
  public, no auth): candidate name, course, **instructor name and
  endorsement**, score **band**, date, attempt number, and a revocation
  status. Any PDF/image is decoration pointing at the page. Forgery is
  defeated by the page, not by watermarks.
- **Bands, never "/100", in v1** — bands absorb measurement error, which is
  exactly the wrongly-judged-candidate harm we can't afford; and the ladder
  (item stats, standard setting) hasn't been climbed yet. The instructor
  sets the band cutoffs with a documented rationale.
- **Revocable.** Cheating discovered later → the page flips to "ملغاة" with a
  date. A credential that can't be revoked can't be trusted.
- **Framing is product law** (extends non-goal 3's medico-legal shield):
  "اجتاز الامتحان النهائي بإشراف د. فلان" — mastery of *this course* under
  *this instructor*. Never "clinically competent," never a Rubik-owned claim
  about patient care.

## 8. Job Market scope — start embarrassingly small

- **M0 — verified profile.** A candidate's public profile page listing their
  verified credentials (each linking to its verify page) + a "متاح للتوظيف"
  contact toggle. **Publishing is opt-in per certificate, never automatic** —
  auto-publishing a low band harms the student and would be indefensible.
- **M1 — employer directory.** Browse/filter candidates by course + band.
  Requires ≥ dozens of opted-in credentialed candidates before it's a
  product; before that it's an empty room.
- **M2 — postings/marketplace.** A different company (employer supply,
  moderation, employment-law exposure). Explicitly out of scope until M0/M1
  prove demand.

M0 is buildable the day the first certificate exists and is 90% of the pitch
("verified Rubik score on a profile").

## 9. Proposed build ladder (maps onto Phase 8's prerequisites)

Each rung independently shippable, each with a gate; no rung starts before
its gate.

| Rung | What | Gate to enter | Phase-8 prereq it satisfies |
|---|---|---|---|
| **E0** (now) | Launch Format A; let `study_events` accumulate | — (done, pending pilot approval) | — |
| **E1** | Phase 6 MCQ transform → **low-stakes lesson checkpoints** | Pilot course fully approved | #1 (MCQ bank + begins item stats — shares the Phase 7 event substrate) |
| **E2** | Held-out exam pool: regenerate → dedupe → `examItems` → instructor review | E1 validates the MCQ transform quality | #2 (separate unexposed pool, section blueprint) |
| **E3** | Exam runtime (server-authoritative §5.1–5.3), run as **unscored beta** on the founder's course | E2 pool approved | — (produces the item stats #1 needs) |
| **E4** | Scoring + bands + instructor-set bar (documented) + certificate + `/verify/{certId}` | E3 item stats over the beta cohort; bad items retired | #3, #4 |
| **E5** | Viva layer + identity confirmation → credential issuance; wallet exam fee | E4 live | #4, #5 |
| **M0** | Opt-in verified profile | first real certificate | — |

Deliberately *not* on the ladder: AI grading of summative answers, proctoring
software, mobile exam surfaces (mobile is view-only, final), M1/M2.

## 10. Proposed exam invariants (to be ratified before any build)

Mirroring the sectional-invariants pattern — each prevents a specific way the
credential dies:

1. **Exam items are structurally unservable to study surfaces.** They live in
   `examItems`, deny-all to clients, read only by the exam runtime during an
   active attempt. No status flag substitutes for the structural split.
2. **The full form never reaches the client.** One item per request, answer
   per request, server-clocked, no back-navigation.
3. **Attempt lifecycle is server-authoritative.** Transactional create keyed
   on uid, server timestamps only, deadline enforced at submission.
4. **Summative grading is deterministic in v1.** MCQ key only; no LLM touches
   a score that reaches an employer.
5. **Scores publish only by per-certificate opt-in.** Nothing about an
   attempt (including that it happened) is visible to anyone but the student
   until they publish; failed attempts are never publicly visible.
6. **Every credential is backed by a revocable verify page.** The page, not
   the artifact, is the source of truth.
7. **Band claims never exceed the evidence.** No "/100", no competence
   language, instructor-endorsement framing only — until the Phase 8 ladder
   (item stats + standard setting) is climbed for that course.
8. **Numeric-tripwire discipline carries over.** Exam items with number+unit
   answers get the same hard review gate as practice pairs — a wrong dose in
   an *exam key* wrongly fails the candidate who answered correctly.

## 11. Open questions for the owner (decide before E2 starts)

1. **Format:** confirm §3's recommendation — MCQ screen + instructor viva for
   the credential — vs MCQ-only credential for v1?
2. **Attempt policy:** strict one-attempt-ever vs cooldown retakes on fresh
   forms with visible attempt count (§6 recommends the latter)?
3. **Identity:** is instructor-confirms-at-viva acceptable for the pilot?
   What's the post-pilot ID step (national ID upload? phone + manual check)?
4. **Pricing:** is the exam wallet-paid? Rough price point? (Also the
   multiple-account tax, §5.4.)
5. **Eligibility:** completed enrollment only, or also a minimum-progress bar
   (e.g. all sections owned for sectional courses — the exam spans the whole
   course, so partial section ownership presumably disqualifies)?
6. **Viva logistics:** recorded video call? Who schedules? Is the recording
   retained as evidence backing the credential?
7. **Naming:** "Rubik Job Market" as the umbrella vision, but does M0 ship as
   something smaller ("الملف المهني" / "Rubik Verified")?

## 12. Cost sketch

- **E1/E2 content:** MCQ transform well under $1 for the current corpus
  (Batch API); pool regeneration reuses existing transcripts — Sonnet only,
  roughly the same ~$0.50/hour-of-content as before.
- **E3/E4 runtime:** zero LLM by design; Firestore attempt/answer docs are
  noise at pilot scale.
- **E5 viva:** the real cost is instructor time (~15 min/candidate). Fine at
  pilot volume; this is the scaling constraint that eventually motivates
  option D (exam sittings) or proctoring — a decision for when it hurts.

## 13. Relationship to the rest of the roadmap

- `study_events` (live now) is the shared substrate: Phase 7's demand heatmap
  and E1/E3's item statistics are the same lazy-aggregation pattern over
  append-only events. Building E1 checkpoints *advances* Phase 7 for free.
- Phase 5 (spaced repetition) stays an independent upside build on the
  practice deck; nothing here blocks or is blocked by it.
- The exam is web-only end to end (non-goal 1: mobile purchases/certification
  never; mobile shows a "أكمل على الموقع" prompt at most).
