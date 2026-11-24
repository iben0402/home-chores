# Chours — Design

Date: 2026-11-24
Status: Draft, awaiting approval (builder pass done)

## 1. Intent

A small web app where a household (family or flatmates) shares one list of chores.

It is more than a tracker. It gives everyone a **neutral, shared place to say "this needs doing"**, so that problems don't have to be raised face to face. For example, one flatmate sees another's dirty dishes piling up in the sink. Instead of starting an argument, they create a one-off chore ("Clean your dishes"), assign it to that person, and everyone can see it. The other flatmates don't need to raise it again. The chore does the talking.

Everyone logs in with their own account. Admins set up rooms and repeating chores. Everyone can take chores, assign them to others, tick them off and see who did what.

## 2. Goals, non-goals, anti-goals

### Goals
- Each person has their own account and can belong to one or more households.
- Admins and members have clear, **server-enforced** permissions. Firestore security rules enforce them, not only the UI.
- Three kinds of chore: one-off, repeats every N days/weeks/months after it was last done, and repeats on a fixed calendar schedule.
- Assignments apply to **one occurrence** of a repeating chore. People can also sign up for future occurrences.
- In-app notifications, shown as a bell with an unread count, when someone assigns you a chore.
- History: a log of who did what, where and when.
- Ticking off a chore takes at most 2 taps on a phone.
- Runs on Firebase's free Spark plan.

### Non-goals (for now)
- Email or push notifications, and reminders sent at a set time. These need Cloud Functions and the Blaze plan.
- Native mobile apps. The app is a mobile-first web app.
- Points, leaderboards, rewards and gamification.
- Rotations generated automatically ("everyone takes turns"). Rotas are planned by hand by assigning future occurrences.
- Comments, photos and attachments on chores.
- Translations (i18n). The UI is in English.
- Working fully offline. Firestore's built-in cache helps, but offline use isn't designed for.

### Anti-goals: what would make this a failure even if it works
- **It escalates conflict instead of defusing it.** No public shaming such as "Tom has 7 overdue chores" banners, and no anonymous blame.
- **It feels like admin bureaucracy.** Members must be able to do everything they need (take, assign, tick off, create one-off chores) without asking an admin.
- **It's slow to use.** If ticking off a chore takes longer than doing it, people stop using the app.

## 3. Constraints

- **Fully client-side.** There is no backend code. The React app talks to Firebase Auth and Firestore directly. All authorization lives in `firestore.rules`.
- **Firebase Spark plan.** That rules out Cloud Functions, scheduled jobs and server-side email or push.
- **Hosting:** classic Firebase Hosting, serving static files from a single-page app.
- Because nothing runs on a server, **every state transition is written by a client**. Rules must make those writes safe: members can't change their own role, write to another household, or fake notifications.

## 4. Approaches considered

| | Approach | Trade-offs |
|---|---|---|
| **A (chosen)** | **React + Vite single-page app on Firebase Hosting**, using Firestore and Auth from the client | Simplest setup, deploys with one command, free. Nothing runs on a timer, so due dates are worked out when people act, and timed reminders need Cloud Functions later. |
| B | Next.js exported as static files, on Firebase Hosting | Same capabilities as A plus Next's file-based routing. Routes with IDs in the URL are awkward without a server. More configuration for no gain. |
| C | Next.js with server rendering, on Firebase App Hosting | Server rendering and server actions, but needs the Blaze plan from day one. Overkill for a logged-in app where search engines don't matter. |

**Chosen: A.** The user wanted the app fully client-side and accepted the trade-offs: no server-side timers, no email or push, and Blaze plus Cloud Functions if those are wanted later.

## 5. Tech stack

| Concern | Choice |
|---|---|
| Language | TypeScript (strict) |
| UI | React 19 + Vite |
| Routing | React Router (data/declarative mode, client-only) |
| Styling | Tailwind CSS v4 |
| Backend | Firebase JS SDK (modular): Auth, Firestore |
| Auth providers | Email/password + Google |
| Dates | date-fns |
| Unit tests | Vitest + React Testing Library |
| Rules tests | `@firebase/rules-unit-testing` against the Firestore emulator |
| Local dev | Firebase Emulator Suite (Auth, Firestore, Hosting), with a `demo-home-chores` project ID so local development doesn't need a real Firebase project |
| Deploy | `firebase deploy` (Hosting + Firestore rules + indexes) |

## 6. Roles and permissions

There are two roles per household: **admin** and **member**. The person who creates a household becomes its first admin. A household always has at least one admin.

| Action | Member | Admin |
|---|---|---|
| See all rooms, chores, occurrences and history in the household | ✅ | ✅ |
| Assign any open occurrence to anyone in the household, self included | ✅ | ✅ |
| Unassign **yourself** | ✅ | ✅ |
| Unassign someone else | ❌ | ✅ |
| Tick off any open occurrence, including one assigned to someone else | ✅ | ✅ |
| Undo your own tick (see §8.5) | ✅ | ✅ |
| Create a **one-off** chore | ✅ | ✅ |
| Edit or delete a one-off chore | creator only | ✅ |
| Create, edit, archive or delete **repeating** chores, including their schedule and lookahead | ❌ | ✅ |
| Skip an occurrence | ❌ | ✅ |
| Create, rename, reorder or delete rooms | ❌ | ✅ |
| See the invite code/link | ✅ | ✅ |
| Regenerate the invite code | ❌ | ✅ |
| Remove a member | ❌ | ✅ |
| Promote or demote admins | ❌ | ✅ (can't remove the last admin) |
| Rename the household | ❌ | ✅ |
| Delete the household | ❌ | ❌ in v1 (see §15) |
| Leave the household | ✅ | ✅ (not if they're the last admin) |
| Delete a wrong history entry | ❌ | ✅ |

*Builder's call (proposed by Claude, not yet confirmed):* members can unassign only themselves. Unassigning someone else is the admin's job, which stops members from quietly pulling chores away from each other.

## 7. Core concepts

- **Household:** a named group of people. A user can belong to several, and the app has a switcher.
- **Member:** a user in a household, with the role `admin` or `member`.
- **Room:** a place in the home, such as Kitchen or Bathroom. Each new household is seeded with a **"General"** room for chores that don't belong to one room, such as bins or shopping.
- **Chore:** the definition of a task: title, optional description, room, kind and schedule.
  - `oneoff`: done once.
  - `interval`: repeats every N days/weeks/months, counted from when it was **last done**.
  - `calendar`: repeats on fixed dates, either weekly on chosen weekdays or monthly on a day of the month, regardless of when it was done.
- **Occurrence:** one instance of a chore that needs doing. It has a due date, an optional assignee, and a status of `open`, `done` or `skipped`. **Assignments, completions and history all belong to occurrences, not chores.** A one-off chore has exactly one occurrence.
- **Lookahead:** how many open occurrences a repeating chore keeps visible ahead of time. The default is 4, and admins can change it per chore (1–8). This is what lets people sign up for future occurrences.
- **Notification:** an in-app message in a user's inbox, such as "Anna assigned you 'Vacuuming' (Thu 10 Dec)".

## 8. Behaviour

### 8.1 Creating chores and their occurrences
- **One-off:** creating it also creates one occurrence. The due date is optional and defaults to today. The creator can assign it at once.
- **Interval:** the admin picks a first due date (default today) and the interval. The app creates `lookahead` occurrences with `seq` values 0…k−1 and due dates `first + i × interval`.
- **Calendar:** the app creates the next `lookahead` dates that match the rule, starting today.

### 8.2 Completing an occurrence
These steps run in a single Firestore **transaction**, so two people ticking at the same moment don't double-count:
1. Mark the occurrence `done`, with `doneBy`, `doneByName` and `doneAt`.
2. **Interval chores:** recompute the due dates of the remaining open occurrences of that chore from `doneAt`. Occurrence n gets `doneAt + n × interval`, counted in order of `seq`. **Assignees stay on their occurrence**, so "Anna has the next one after mine" stays true when the dates move.
3. **Calendar chores:** the dates of the remaining occurrences don't change.
4. Top the chore back up to `lookahead` open occurrences by creating new ones at the end of the queue, with no assignee. The new interval dates continue from the last open one. Calendar dates take the next matching date after the last open one. Update `chore.nextSeq` and `chore.lastDoneAt`.
5. One-off chores: steps 2–4 don't apply. The chore is finished once its occurrence is done, and it disappears from the Rooms and Today views.

*Calendar dates include today if today matches the rule. Months are added with `addMonths`, which clamps to the end of shorter months.*

*The dates move even when a chore is done early. Interval chores always count from when they were last done.*

### 8.3 Missed occurrences
Missed occurrences are never deleted or moved automatically. An occurrence is **overdue** when it's still open and its due date is before today in the viewer's local time. It stays overdue until someone ticks it off or an admin skips it. Skipping uses the same steps as completing, with status `skipped` and no `doneBy`. For interval chores, a skip recomputes dates from the skip time.

To avoid clutter, the Today view shows **only the earliest open occurrence per chore** when several are overdue. The chore detail screen shows all of them.

### 8.4 Assigning
- Any household member can set the assignee of any **open** occurrence to any household member.
- If the new assignee isn't the person doing the assigning, the same batch writes a notification to the new assignee's inbox.
- Self-assign: the **"Take it"** button. It doesn't send a notification.
- Unassign: you can unassign yourself, and admins can unassign anyone. Unassigning doesn't send a notification.
- Reassigning from A to B notifies B. *Builder's call:* A isn't notified.

### 8.5 Undo and correcting history
- The person who ticked an occurrence can undo it for **10 minutes**, as long as no later occurrence of the same chore has been completed since. Undo sets the occurrence back to `open`, deletes the occurrence that was created to top up the queue (only if nobody has been assigned to it yet; otherwise it's kept and the queue is one longer until the next completion), and for interval chores recomputes the open due dates from the previous completion. Firestore can't express this whole rule, so security rules enforce a simpler version: the person who ticked it, within 10 minutes of `doneAt`. The client handles the rest.
- Admins can delete any `done` occurrence. This removes it from history and doesn't change the queue.

### 8.6 Editing and deleting chores
- **Editing the title, room or description:** the change applies to all occurrences, which repeat the title and room for queries (see §9). The batch updates the open ones. Done ones keep their old values, so history shows what the chore was called at the time.
- **Editing the schedule:** for interval chores, open occurrences are re-dated from the last completion, or from the first due date if it has never been done. For calendar chores, open occurrences are re-dated to the next matching dates under the new rule. Either way, they're re-dated in `seq` order and assignees are kept.
- **Lowering lookahead:** deletes open occurrences from the end of the queue and notifies their assignees. **Raising it:** adds new unassigned occurrences.
- **Delete or archive:** deleting removes the chore and its open occurrences. Done occurrences stay in history, which keeps the repeated title and room. Archiving hides the chore and deletes its open occurrences. *Builder's call:* offer archive only for repeating chores, and delete for one-off chores.
- People assigned to open occurrences that are deleted or significantly changed (re-dated or retitled) get a notification of type `chore_changed` or `chore_deleted`.

### 8.7 Households, invites and membership
- **Create a household:** one batch writes the household doc, with you in `adminUids`, your member doc, and the "General" room.
- **Invite:** each household has one active invite code: 8 characters from an alphabet without look-alike characters (no 0/O or 1/I), shown as `K7QM-4XRT`. It's stored as `invites/{code}` → `{ householdId, householdName, active }`. The share link is `/join/{code}`. Admins can regenerate the code. The old invite doc is kept with `active: false`, so someone using it is told "That code has been replaced with a new one." and not "doesn't match". Codes don't expire on their own.
- **Join preview (decided 2026-11-24):** before joining, the confirmation screen shows the household name and its members' first names, avatars and Admin badges. Without a server, the rules let **any signed-in user who knows a household's ID** read the household doc and its members. Household IDs are random and only reachable through an invite code, and member docs hold no emails. A Cloud Function (Blaze) would be the stricter alternative.
- **Member colours:** each member doc gets `color` 1–10 (the design system's member identity colours). It's the lowest colour not already used in the household, or `(count % 10) + 1` once all are taken. A rare duplicate from two people joining at the same moment is acceptable.
- **Revoking access (review fix, 2026-11-24):** the current code lives only in `households/{hid}/private/invite` (members only), never on the public household or member docs. A replaced invite keeps only `active: false`, so it no longer reveals its household. Admin powers need membership too: an admin who leaves or is removed comes off `adminUids` in the same batch, and the last admin can't leave.
- **Join:** a signed-in user opens `/join/{code}`. The app reads the invite to get the household ID, then creates `households/{hid}/members/{uid}`. Rules allow creating your *own* member doc only when the invite's `householdId` matches. If you aren't signed in, the link sends you to login or signup and then returns you to the join page.
- **Remove a member or leave:** one batch deletes the member doc, removes the user from `adminUids` if they're an admin, and unassigns all their **open** occurrences. Their past completions stay in history under the name repeated on each occurrence.
- **Promote or demote:** edits `household.adminUids`. Rules forbid an empty `adminUids`.
- **Display names:** taken from signup (or the Google profile) and copied into each member doc. If the account has no name (saving it at sign-up failed, or a Google profile without one), "Get started" asks for it before anything else, so member docs never get an empty name. If a user changes their name, the client updates their member doc in every household. Names copied into old occurrences and notifications aren't rewritten.
- **Joining twice:** if you're already a member, `/join/{code}` just opens the household.

### 8.8 Rooms
- Rooms are ordered by `order`, and admins can rename and reorder them.
- **Deleting a room** moves all of its chores and their **open** occurrences to "General", in one batch. Done occurrences keep their old `roomId`. History shows "(deleted room)" when that room no longer exists. *Builder's call.*
- "General" can't be deleted.

### 8.9 What the Today view shows
- With a lookahead of 4, every repeating chore has 4 open occurrences, and listing all of them would bury the list. So:
  - **Everyone / Unassigned:** only the **earliest open occurrence of each chore**.
  - **Mine:** the earliest open occurrence of each chore **plus any later occurrences assigned to me**, so "I signed up for vacuuming on the 17th" is visible from the main screen.
- Sections: Overdue (before today), Today, This week (until the end of the current Mon–Sun week), Later.
- Future occurrences of a chore are all shown and assignable on the **chore detail** screen. Tapping a row's assignee opens a picker.
- *Builder's call*, made on the user's behalf.

### 8.10 Notifications
- Stored in `users/{uid}/notifications`. Only the owner can read them, mark them read or delete them.
- Created by **another client**, the one that assigns the chore. Rules check that:
  - the sender is signed in and `fromUid == request.auth.uid`;
  - both sender and recipient are members of the `householdId` in the notification;
  - the notification is created unread, with type `assigned`, `chore_changed` or `chore_deleted`.
- The bell in the header shows the unread count, read live. Opening the panel lists the newest 30. Clicking one opens the household and occurrence it's about and marks it read. A "mark all read" button is included.
- *Builder's call:* notifications older than 60 days aren't shown. Nothing cleans them up because there's no server.
- *Known limitation:* a member could misuse a valid assignment to send unwanted notifications. Within a household that's acceptable.

## 9. Data model (Firestore)

```
users/{uid}
  displayName: string
  email: string
  photoURL?: string
  createdAt: Timestamp

users/{uid}/notifications/{nid}
  type: "assigned" | "chore_changed" | "chore_deleted"
  householdId: string
  householdName: string        // copied in, so the inbox can show it without reading the household
  occurrenceId?: string
  choreId: string
  choreTitle: string
  dueDate?: string             // "YYYY-MM-DD"
  fromUid: string
  fromName: string
  read: boolean
  createdAt: Timestamp (serverTimestamp)

invites/{code}
  householdId: string
  householdName: string        // copied in, so the invite screens can show it
  active: boolean              // false once replaced by a newer code
  createdBy: string
  createdAt: Timestamp

households/{hid}               // readable by any signed-in user (join preview): holds no code
  name: string
  adminUids: string[]          // the only place roles are stored; every admin must be a member
  createdBy: string
  createdAt: Timestamp

households/{hid}/private/invite   // members only
  code: string                 // the current invite code

households/{hid}/joins/{uid}   // proof of the code someone joined with; admins only
  inviteCode: string

households/{hid}/members/{uid}
  uid: string                  // repeats the doc ID so collection-group queries can filter on it
  displayName: string
  color: number                // 1–10, member identity colour (see §8.7)
  photoURL?: string
  joinedAt: Timestamp          // = request.time
  photoURL?: string

households/{hid}/rooms/{roomId}
  name: string
  order: number
  isDefault?: boolean          // "General": can be renamed, but not deleted

households/{hid}/chores/{choreId}
  title: string
  description?: string
  roomId: string
  kind: "oneoff" | "interval" | "calendar"
  interval?: { every: number, unit: "day" | "week" | "month" }
  calendar?: { freq: "weekly", weekdays: number[] }      // 0=Sun … 6=Sat
           | { freq: "monthly", dayOfMonth: number }      // 1–31; short months use their last day
  lookahead: number            // 1 for oneoff, 1–8 otherwise, default 4
  nextSeq: number              // seq for the next occurrence created
  lastDoneAt?: Timestamp
  archived: boolean
  createdBy: string
  createdAt: Timestamp

households/{hid}/occurrences/{occId}
  choreId: string
  choreTitle: string           // copied from the chore, so lists and history don't need joins
  roomId: string               // copied from the chore
  kind: "oneoff" | "interval" | "calendar"
  seq: number
  dueDate: string              // "YYYY-MM-DD" local date; sorts as a string
  status: "open" | "done" | "skipped"
  assigneeUid: string | null
  assignedBy?: string
  doneBy?: string
  doneByName?: string
  doneAt?: Timestamp
  createdBy: string            // for one-off chores: who raised it, shown in the UI ("from Tom")
  createdByName: string
```

Design notes:
- **Occurrences live directly under the household**, not under each chore. That way, "all open occurrences sorted by due date" and "history sorted by `doneAt`" are each a single query.
- **History is simply occurrences with `status == "done"`.** There is no separate history collection.
- **Roles live only in `household.adminUids`.** One document read tells both the rules and the UI who is an admin, and roles can't drift out of sync.
- **Listing "my households"** uses a collection-group query on `members` where `uid == me`, then reads each household.
- Due dates are stored as `YYYY-MM-DD` strings in the device's local time. Households in more than one time zone are out of scope.

### Required composite indexes (initial)
- `occurrences`: `status ASC, dueDate ASC`
- `occurrences`: `status ASC, assigneeUid ASC, dueDate ASC`
- `occurrences`: `choreId ASC, status ASC, seq ASC`
- `occurrences`: `status ASC, doneAt DESC`
- `occurrences`: `status ASC, roomId ASC, doneAt DESC`
- `occurrences`: `status ASC, doneBy ASC, doneAt DESC`
- `notifications`: `read ASC, createdAt DESC`
- Collection-group exemption: a single-field index on `members.uid`.

## 10. Security rules (outline)

Helpers:
- `signedIn()`
- `isMember(hid)`: `exists(/households/hid/members/auth.uid)`
- `isAdmin(hid)`: `auth.uid in get(/households/hid).data.adminUids`

| Path | read | create | update | delete |
|---|---|---|---|---|
| `users/{uid}` | self, or anyone who shares a household with them (*builder's call: simplify to signed-in users*) | self | self | — |
| `users/{uid}/notifications/{n}` | owner | the sender, if `fromUid == auth.uid`, both are members of `householdId`, `read == false` and `type` is allowed | owner, `read` field only | owner |
| `invites/{code}` | `get` by anyone, signed in or not (the invite-link screen shows the household name before log-in); never `list` | admin of `householdId`, `active == true` | admin of `householdId` (`active` and `householdName` only) | — |
| `households/{hid}` | any signed-in user (`get` only; see the join preview in §8.7) | signed in, `adminUids == [auth.uid]`, `createdBy == auth.uid` | admin. `adminUids` must not be empty, and `createdBy` can't change | admin |
| `members/{uid}` (incl. collection group) | any signed-in user for this household's members (join preview), plus the user's own doc via the collection group | (a) self as creator of a new household, checked with `getAfter`; or (b) self with a valid `inviteCode` for this `hid` | self (displayName/photoURL) | self (leave) or admin (remove) |
| `rooms/{r}` | member | admin | admin | admin, but not when `isDefault` |
| `chores/{c}` | member | admin; or a member if `kind == "oneoff"` and `createdBy == auth.uid` | admin; or the creator for oneoff; or any member changing only `nextSeq` and `lastDoneAt` (completion flow) | admin; or the creator for oneoff |
| `occurrences/{o}` | member | admin; or a member creating an open, unassigned occurrence for an existing chore (top-up), or the first occurrence of their own one-off | see below | admin; the creator of a oneoff; or the person who ticked it during the undo window (top-up occurrence only) |

Occurrence update rules for members, where each update must match exactly one shape:
- **Assign:** only `assigneeUid` and `assignedBy` change. Status is `open`, the new assignee is a member, and `assignedBy == auth.uid`.
- **Unassign self:** `assigneeUid` goes from `auth.uid` to `null`.
- **Complete:** status goes from `open` to `done`, and `doneBy == auth.uid`.
- **Re-date:** only `dueDate` changes and status is `open`. This is needed when someone completes an interval chore.
- **Undo:** status goes from `done` to `open`, by `doneBy == auth.uid`, within 10 minutes of `doneAt`.

Admins may update any field.

*Known limitation of having no server:* a member could tamper with the app to re-date occurrences or create extra top-up occurrences. Rules limit what such a write can do, but can't check that the date maths is right. Within a household that's acceptable.

Every rule has tests in `tests/rules/` that run against the emulator.

## 11. App architecture

```
src/
  main.tsx                 // React root, router, providers
  app/
    routes.tsx             // route table
    AuthGate.tsx           // redirects to /login when signed out
    HouseholdLayout.tsx    // header (household switcher, bell), bottom tabs
  lib/
    firebase.ts            // initializeApp, getAuth, getFirestore (persistent cache); connects to emulators in dev
    schedule.ts            // PURE date logic: initial dates, next calendar dates, re-dating after completion
    ids.ts                 // invite code generator
  data/                    // all Firestore access lives here; components never import firebase/firestore
    converters.ts          // typed FirestoreDataConverters
    households.ts          // create, join, leave, remove member, promote/demote, regenerate invite
    rooms.ts
    chores.ts              // create/edit/delete, including occurrence creation and re-dating
    occurrences.ts         // assign, unassign, complete (transaction), skip, undo
    notifications.ts
    hooks.ts               // useHouseholds, useOccurrences(filter), useNotifications… built on onSnapshot
  features/
    auth/                  // Login, Signup, Google button
    today/                 // main list: Mine / Everyone / Unassigned
    rooms/                 // room list, room detail, admin room editor
    chores/                // chore detail (upcoming occurrences + assign), chore editor
    history/               // history list with person/room filters
    household/             // members, roles, invite, leave
    notifications/         // bell + panel
  components/              // shared UI: Button, Sheet, Avatar, DueBadge, EmptyState…
  types.ts                 // domain types matching §9
tests/
  rules/                   // Firestore rules tests (emulator)
firebase.json              // hosting (SPA rewrite to /index.html), firestore, emulators
.firebaserc                // default: demo-home-chores; real project added with `firebase use --add`
firestore.rules
firestore.indexes.json
```

Principles:
- **Date logic is pure and unit-tested** (`lib/schedule.ts`). It is the most error-prone part of the app.
- **Every write lives in `data/`** as a named function, such as `completeOccurrence(hid, occId)`. Components call these functions. Multi-document changes use batches or transactions.
- **Reads are live** (`onSnapshot`). With Firestore's persistent cache, screens load instantly and stay in sync across flatmates' phones.
- **Admin controls are hidden** from members, and the rules enforce the same limits anyway.

### Routes
| Path | Screen |
|---|---|
| `/login`, `/signup` | Auth |
| `/join/:code` | Join a household. Redirects to auth first if signed out, then returns here |
| `/` | Redirects to the last-used household, or `/households/new` if you have none |
| `/households/new` | Create a household |
| `/h/:hid` | **Today**: Overdue / Today / This week / Later, with filter chips Mine · Everyone · Unassigned |
| `/h/:hid/rooms` | Rooms with a count of open chores in each |
| `/h/:hid/rooms/:roomId` | The room's chores |
| `/h/:hid/chores/new` | New chore. Members only see the one-off option |
| `/h/:hid/chores/:choreId` | Chore detail: upcoming occurrences, each with an assignee picker; recent history; edit (admin) |
| `/h/:hid/history` | Completion log, filterable by person and room |
| `/h/:hid/household` | Members, roles, invite link/code, leave |

### Main screen sketch (mobile)
```
 Flat on Main St ▾                        🔔 2
 ─────────────────────────────────────────────
 [ Mine ]  [ Everyone ]  [ Unassigned ]

 OVERDUE
  ☐ Bins out          General   Mon 30 Nov   Anna
 TODAY
  ☐ Clean your dishes Kitchen   one-off      You   · from Tom
 THIS WEEK
  ☐ Vacuuming         Living    Thu 3 Dec    —    [Take it]
  ☐ Bathroom          Bathroom  Sat 5 Dec    Tom
 ─────────────────────────────────────────────
  Today   Rooms   History   Household
```
- Tap the checkbox: the chore is done, and an "Undo" snackbar appears for a few seconds. You can also undo from history within 10 minutes.
- Tap a row to open a sheet with Assign to…, Take it / Unassign me, and Open chore.
- A "+" floating button creates a new chore. Members get the one-off form.

## 12. Testing strategy
- **Unit tests (Vitest):** everything in `lib/schedule.ts`. This includes month-end calendar dates, weekly rules with several weekdays, re-dating when done early or late, and lookahead top-up.
- **Rules tests:** every row of the §10 tables, allowed and denied, against the emulator.
- **Data-layer tests:** the `data/` functions run against the emulator for complete, undo, join and remove-member.
- **Component tests:** light, for key interactions such as ticking off, assigning and the bell count.

## 13. Local dev and deploy
- `npm run dev` starts Vite. Starting the emulators separately is up to the builder, for example with `firebase emulators:start` or a combined `npm run dev:all`.
- `npm test` runs the unit tests. `npm run test:rules` runs `firebase emulators:exec` around the rules tests.
- Going live means creating a Firebase project on the Spark plan, enabling the Email/Password and Google sign-in providers, running `firebase use --add`, putting the web config in `.env.local` (`VITE_FIREBASE_*`) and running `npm run build && firebase deploy`.

## 14. Left to the builder
- Visual design: colours, typography, iconography. Mobile-first, clean, friendly.
- Empty states, loading skeletons and error toasts.
- Exact wording of UI copy and notification text.
- Whether to add a PWA manifest so the app can be added to the home screen. Recommended, and cheap.
- Pagination sizes for history and notifications.

## 15. Open questions for later (not blocking v1)
- Email or push reminders, which need Blaze and Cloud Functions.
- Automatic rotations.
- Supporting households spread across several time zones.
- Deleting a household (it needs subcollections removed recursively, which is best done by a Cloud Function) and deleting accounts.
