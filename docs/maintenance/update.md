# Doc & Skill Maintenance Procedure

This runs when the user says "update", "update the docs", or at the end of a
session where code shipped. It is NOT optional and NOT a quick acknowledgement.
Follow every step. Stop where told to stop.

## Principles (the constitution — these override convenience)

1. CODE IS THE SOURCE OF TRUTH. Never restate executable logic (access rules,
   algorithms, validation, state machines) in prose. If a doc explains logic,
   replace it with a one-line pointer to the function: `see isVideoLocked() in
src/lib/access/courseAccess.ts`. Prose copies of code always drift.

2. TWO LAYERS, NEVER MIXED.
   - METHODOLOGY (how we work): prompt format, audit format, conventions,
     commit rules. Lives in shared methodology files. Identical across repos.
   - PROJECT-FACT (this repo): routes, schema, env vars, deploy config.
     Lives in CLAUDE.md / AGENTS.md and project docs. Never shared.
     A file doing both jobs is a bug to be split.

3. ONE STATUS SOURCE. Git log is the real status board. A repo may have AT MOST
   one short status doc, and it must be dated facts, not a transcript. Two docs
   both claiming to be "source of truth" is a defect — merge them.

4. SKILLS ARE EARNED. A pattern becomes a skill only after it has recurred 3+
   times AND is stable. One-off task → archive the prompt. Still in flux →
   leave it in an audit doc. Do not pre-emptively create skills.

5. SHORT AND PRESCRIPTIVE. If a file reads like a transcript of a session
   ("DO NOT START until I say go", commit-hash dumps, "what the new handler
   must look like"), it is wrong. Rewrite as standing rules or archive it.

6. A WRONG DOC IS WORSE THAN NO DOC. It is loaded into context and acted on.
   Delete fearlessly. Stale-but-flagged is still stale.

7. CLAUDE.md IS A BUDGET. Target 80–120 lines. It is read into every session.
   If it exceeds that, move detail into docs/ and leave a pointer. CLAUDE.md
   holds durable facts + pointers only — never logic, never status, never
   things Claude can discover by reading the code.

## Procedure

### Step 0 — Scope

Run `git log --oneline` since the date stamped in the status doc (or since the
last "docs: maintenance" commit). List every feature/change that shipped.

### Step 1 — Inventory

List every file under docs/, .claude/, and every CLAUDE.md / AGENTS.md, with
size and a one-line purpose. Note any CLAUDE.md over 120 lines.

### Step 2 — Verify, do not trust

For every PROJECT-FACT claim touched by Step 0's changes, open the actual code
and confirm it. Check specifically: routes/directory casing, schema/types,
firestore rules, indexes, env vars, package.json scripts, file structure.
Quote each stale line and its correct current state. Do not take any doc's
word for the codebase — verify against the codebase.

### Step 3 — Classify the drift

Tag every problem found: STALE-FACT / COMPLETED-PROMPT-STILL-LIVE /
TRANSCRIPT-STYLE / DUPLICATION / PROSE-COPY-OF-CODE / CLAUDE.md-OVERSIZED /
CONTRADICTION-BETWEEN-DOCS.

### Step 4 — Propose, then STOP

Output a fix list, worst-first, as a diff summary (file → what changes → why).
Do not write anything. Wait for the user to approve or trim the list.

### Step 5 — Apply (only after approval)

Minimal, surgical edits only — no rewrites beyond what the fix list names.

- Fix stale claims against verified current state.
- Move completed prompts/audits to docs/archive/ with a SUPERSEDED header.
- Collapse each duplicated concept to ONE canonical home; replace the other
  copies with a pointer.
- Replace every prose-copy-of-code with a function pointer.
- Trim CLAUDE.md to budget if oversized.

### Step 6 — Additions

- Did a pattern recur 3+ times this period and is it stable? Propose a new
  skill (propose only — let the user confirm).
- Did a new subsystem ship? CLAUDE.md may need ONE new line or pointer.

### Step 7 — Stamp and commit

Update the date on the status doc. One focused commit:
`docs: maintenance update YYYY-MM-DD`.

## Exit self-check (answer all before finishing)

- [ ] Every CLAUDE.md claim verified against code this session?
- [ ] Any doc still restating logic that lives in a function?
- [ ] Any completed prompt still sitting in a live (non-archive) path?
- [ ] Any two files stating the same fact?
- [ ] Any file still reading like a transcript?
- [ ] CLAUDE.md within 80–120 lines?
      If any box is unchecked, the update is not done.
