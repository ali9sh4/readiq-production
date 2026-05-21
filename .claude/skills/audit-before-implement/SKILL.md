---
name: audit-before-implement
description: >-
  Investigation technique for risky changes on this codebase. Use before
  editing an API contract (app/api/*), a server action, a shared lib/* helper,
  enrollment/access/Mux code, or any feature that spans multiple surfaces
  (web + mobile). Also use when fixing a bug whose root cause is not yet
  proven. Skip for typo fixes, single-file UI tweaks, and changes whose scope
  is already obvious and contained — those do not need it.
---

# Audit Before Implement

For risky changes, trace the real code before editing. This is a technique,
not a gate: do the investigation, then proceed to implement in the same turn
unless what you find changes the scope or contradicts the request. (For work
where you genuinely need scope sign-off first, use plan mode.)

On this codebase, tracing first has caught real problems: docs three weeks
stale, a `revalidatePath` failure that made a successful save look like an
error, a UI toggle that was clickable but server-rejected, and a feature
believed removed that was still live on two of three surfaces.

## The pass

1. **Trace the path end to end.** Follow the real flow — entry point →
   action/route → data layer. Open the files; do not assume.

2. **Grep for every instance.** Changing one call site of a pattern? Find them
   all. A fix applied to one of five is a half-fix that creates an
   inconsistency bug. Check web *and* mobile (`app/api/*`) surfaces.

3. **Verify docs against code.** Project docs drift. If a doc says something is
   done/removed/works-a-certain-way, confirm it in the current code first.

4. **Report what you found**, briefly: what the code does today (file:line),
   where the pattern appears, the proven root cause if it's a bug, and the
   proposed scope. Flag fragility found along the way — but do not expand scope
   to fix it unasked.

## Principles

- **No edits during the trace.** Reading and grepping only.
- **Prove the root cause; don't guess it.** "Probably this" is not a diagnosis
  — trace until you can point at the exact line.
- **Smallest correct change wins.** The audit exists to find it, not to
  justify a broad rewrite.
