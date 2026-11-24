# Known issues

Found by the independent review of chores part 1 (PR #7, merged 2026-11-24) and parked to ship features first.
Ordered by priority. "Confirmed" means it was reproduced against the Firestore emulator.

## Chores

### Security (rules) — live in production
1. **C1 · A member can delete upcoming occurrences of any chore** (confirmed). Lowering `nextSeq` by one while deleting the newest occurrence is allowed without any tick, so repeating a few times wipes a chore's queue (it never comes back), and it also deletes another member's one-off. Only members of the same household can do this.
2. **I1 · `nextSeq` can be moved ±1 freely and `lastDoneAt` accepts anything** (confirmed). This can create duplicate occurrence positions, and junk `lastDoneAt` would break the future chore page.
3. **I2 · A member can create a one-off with hundreds of extra occurrences** (confirmed), with any seq, kind, title or room. In effect a repeating chore that only admins should create.
4. **M3 · Displayed names can be faked** (confirmed): "from Alice" and "done by Alice" are free text.
5. **M4 · A top-up can be added to an archived chore** (confirmed), and its kind isn't checked against the chore.

**Planned fix for 1–5 (one design change):**
- give occurrences predictable IDs (`{choreId}_{seq}`);
- record each completion on the chore (`lastTick: { occurrenceId, by }`);
- the rules only allow a counter change, or a delete, that is part of a real tick or undo by the same person, and they check seq ≥ 0 plus kind, title and room against the chore on create;
- names must match the member's own doc;
- occurrences created with the current random IDs keep working.

### Behaviour
6. **I3 · Two people ticking different occurrences of the same chore at the same moment:** one gets "Couldn't mark it done" (confirmed). Fix: re-read inside a retry loop.
7. **I4 · Ticking the last chore on Today (or in a room) loses its Undo.** The empty state replaces the list, and the snackbar with it.
8. **I5 · Undo after someone took the new occurrence leaves the queue one too long for good**, and keeps the undone "last done" time (confirmed). Fix: only top up while the queue is shorter than `lookahead`.
9. **I6 · The snackbar may not be announced by screen readers, and Undo disappears after 5 s** (too fast for keyboard users). Fix: a permanently mounted live region, and pause the timer on hover or focus.
10. **M1 · "Every N months" chores drift** (e.g. 30th → 28th after February, then stay on the 28th). Fix: compute the top-up from the completion date, not the last clamped date.
11. **M2 · The "On set days" preview skips today, though creating the chore includes it.**
12. **M5 · New chore:** past due dates are accepted; the first failed submit doesn't move focus to the error; an empty room list shows a generic error.
13. **M6 · Undo fails entirely** if a re-dated occurrence was completed meanwhile, and the message mentions History, which didn't exist yet.
14. **M7 · On a slow connection a ticked row can reappear for a moment** and be ticked again ("Someone already ticked that off").
15. **M8 · "Today" isn't refreshed at midnight** while the app stays open.
16. **M9 · Deleting a room** reads its chores outside the batch (a chore added at that moment keeps the old room), and a room with more than about 500 chores exceeds one batch.

### Product question
- **"Mine" on Today** currently shows everything assigned to you, including later occurrences. Spec §8.9 could also be read as "the next of each chore, plus later ones assigned to you".

## Elsewhere (from earlier reviews)
- Auth: the button press-scale animation is instant (transition property); the password toggle's screen-reader label; the offline notice is inserted with its text already in it (may not be announced); the theme doesn't follow an OS change while the app is open; the "Log in instead" link depends on matching the error text; the placeholder page's sign-out error is unhandled.
- Households: the "Copied" label never resets; creating a household offline spins forever; an existing member opening a replaced code sees the error instead of going in.
- Tooling: `/build-check` flags `firestore.rules`, `src/index.css` and `src/test/setup.ts` as having no mapped test (they are covered by the emulator and unit suites).
- Lint: a fast-refresh warning in `src/components/Avatar.tsx`.
