# Known issues

Found by the independent review of chores part 1 (PR #7, merged 2026-11-24) and parked to ship features first.
Ordered by priority. "Confirmed" means it was reproduced against the Firestore emulator.

## Chores

Fixed in `fix/chores-rules`: the rules holes C1, I1, I2, M3, M4 (occurrences now have `{choreId}_{seq}` IDs and every counter change or delete must be part of a real tick or undo, recorded on the chore as `lastTick`), plus I3 (concurrent ticks retry), I5 (top up only while the queue is short), M1 (monthly drift), M6 and History item 17 (exact undo from the snackbar and History).

### Behaviour
1. **I4 · Ticking the last chore on Today (or in a room) loses its Undo.** The empty state replaces the list, and the snackbar with it.
2. **I6 · The snackbar may not be announced by screen readers, and Undo disappears after 5 s** (too fast for keyboard users). Fix: a permanently mounted live region, and pause the timer on hover or focus.
3. **M2 · The "On set days" preview skips today, though creating the chore includes it.**
4. **M5 · New chore:** past due dates are accepted; the first failed submit doesn't move focus to the error; an empty room list shows a generic error.
5. **M7 · On a slow connection a ticked row can reappear for a moment** and be ticked again ("Someone already ticked that off").
6. **M8 · "Today" isn't refreshed at midnight** while the app stays open.
7. **M9 · Deleting a room** reads its chores outside the batch (a chore added at that moment keeps the old room), and a room with more than about 500 chores exceeds one batch.
8. **Undo of an older tick** (when someone ticked the same chore after you) only reopens your occurrence; the dates and the added occurrence from your tick stay. Exact undo covers the chore's latest tick.
9. **Admins pass the rules' tick checks unconditionally** (by design: admins may edit chores freely), so an admin's client bug could still skew a queue.

### History
10. **History loads the latest 200 entries**; older ones aren't reachable yet (no "load more").
11. **"Open chore"** isn't in the History entry sheet yet. (Skipped entries are listed since `feat/skip`.)
12. **Skipping someone's chore doesn't notify them** (no notification type for it in the design yet).

### Product question
- **"Mine" on Today** currently shows everything assigned to you, including later occurrences. Spec §8.9 could also be read as "the next of each chore, plus later ones assigned to you".

## Elsewhere (from earlier reviews)
- Auth: the button press-scale animation is instant (transition property); the password toggle's screen-reader label; the offline notice is inserted with its text already in it (may not be announced); the "Log in instead" link depends on matching the error text; the placeholder page's sign-out error is unhandled.
- Households: the "Copied" label never resets; creating a household offline spins forever; an existing member opening a replaced code sees the error instead of going in.
- Tooling: `/build-check` flags `firestore.rules`, `src/index.css` and `src/test/setup.ts` as having no mapped test (they are covered by the emulator and unit suites).
- Lint: a fast-refresh warning in `src/components/Avatar.tsx`.
