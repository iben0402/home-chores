# Chores Core Implementation Plan (part 1 of 4: core, assigning, chore page, history)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Real chores. People create chores: members create one-offs, admins can also create repeating chores, either "after it's done" or on set days. Today lists them in sections with filters. Ticking one off has Undo. "Take it" assigns it to yourself. Rooms show real counts and lists, and deleting a room moves its chores to General.

**Spec:** [design spec](../specs/2026-11-24-home-chores-design.md):
- §7 concepts;
- §8.1 creating;
- §8.2 completing;
- §8.3 missed;
- §8.4 assigning (self only here);
- §8.5 undo (the snackbar path);
- §8.8 rooms (delete moves chores);
- §8.9 what Today shows;
- §9 data model;
- §10 rules (chores and occurrences).

**Designs:**
- design system: ScreenToday, ScreenNewChoreMember, ScreenNewChoreAdmin, ScheduleEditor, ChoreRow, SectionHeader, FilterChips, Snackbar, Fab;
- canvas: 1b Room detail, 3e Snackbars, plus the Copy sheet.

**Out of scope (later parts):**
- assigning other people, notifications, and the New chore "For" / "Who does the first one?" fields (part 2);
- the chore page, edit, delete, archive, skip and lookahead editing (part 3);
- History, and undo from History (part 4).

## Global Constraints
- Due dates are `YYYY-MM-DD` in the device's local time.
- **Today sections:** Overdue (< today), Today, This week (to Sunday of the current Mon–Sun week), Later.
- **Date labels:** "Today", "Thu 3 Dec", with the year only when it isn't the current one.
- **Today shows the earliest open occurrence per chore.** "Mine" also shows later occurrences assigned to me.
- **Repeating chores keep `lookahead` = 4 open occurrences.**
- **Copy:**
  - the Copy sheet;
  - the ScheduleEditor sentences ("Due again 1 week after someone last did it.", "Every Monday, no matter when it was last done.", "Every month on the 31st (or the last day of shorter months).");
  - the snackbar "{title} — done" with "Undo".
- **Completion is a Firestore transaction.** Undo restores exactly what completing changed.
- **Overdue is amber, never red.**

## Review Focus
1. **Month ends and leap years** in "every N months" and "day 31 of each month" (`addMonths` clamps to the last day).
2. **Completing late or early** re-dates the remaining queue from the completion day, and assignees stay attached to their place in the queue.
3. **Two people ticking the same occurrence:** the transaction means one wins; the other sees it already gone, with no duplicate top-up.
4. **Undo after the snackbar is gone:** not available here (History does it in part 4). Undo within the 5 seconds restores the dates, deletes the top-up and resets `nextSeq`.
5. **A tampered client:**
   - can't complete as someone else;
   - can't create repeating chores as a member;
   - can't create occurrences for another household's chore;
   - can't edit others' one-offs.

### Task 1: `src/lib/schedule.ts` (pure, thoroughly tested)
- `todayISO(d?)`, `addDays(iso, n)`, `addMonths(iso, n)` (clamped), `parseISO`, `weekday(iso)`.
- `initialDates(rule, startISO, n)`; `nextCalendarDate(rule, afterISO, inclusive)`; `redate(rule, doneISO, count)`; `topUpDate(rule, lastISO)`.
- `dueStatus(iso, todayISO)` → overdue, today, week or later. `dueLabel(iso, todayISO)`.
- `describeSchedule(form)`, `previewDates(form, todayISO, 3)`.

### Task 2: Rules and data (`src/data/chores.ts`), emulator-tested
- **Write functions:** `createChore`, `completeOccurrence` (returns an `UndoToken`), `undoCompletion(token)`, `takeOccurrence`.
- **Watchers:** `watchOpenOccurrences(hid)` and `watchChores(hid)`.
- **Room deletion:** `deleteRoom` moves chores and open occurrences to General.
- **Rules:**
  - Members create one-offs only, as themselves. Admins create anything. Each occurrence belongs to a chore of the same household.
  - Member updates are limited to these shapes: complete (as self, at the server time), re-date (`dueDate` only), take (self, when unassigned), undo (self, within 10 minutes).
  - Members can create top-ups, and delete them during undo, only for the latest `seq`.

### Task 3: Components
SectionHeader, FilterChips, Snackbar (with Undo), Fab, SegmentedControl, NumberStepper, SelectField, ScheduleEditor. ChoreRow gains: the kind tag, "from Tom", Take it, and the leaving animation.

### Task 4: Screens
- **Today:** sections, filters with counts, tick off with Undo, Take it, the FAB, and the empty and "nothing for this filter" states.
- **New chore** (`chores/new?room=`):
  - member: one-off with title, room, due date and note;
  - admin: the ScheduleEditor.
- **Rooms:** real counts. Room detail lists the room's chores in sections.
- **Delete room:** the confirmation states the chore count.

### Task 5: Verify (`/build-check`, rules suite, browser), PR, and an independent review (rules change).
