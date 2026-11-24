# Households (Get started, Create, Join) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in person can create a household (becoming its admin, with a General room and an invite code) or join one by code or link. They land on the household's empty Today screen, which can show the invite.

**Architecture:**
- Firestore data functions live in `src/data/households.ts`. They take the `Firestore` instance as their first argument, so the same code runs in the app (`db`) and in emulator tests (`RulesTestContext.firestore()`).
- Pure invite-code helpers live in `src/lib/inviteCode.ts`.
- The real rules replace deny-all in `firestore.rules`. They are tested under `tests/rules/`, along with the data functions against the emulator.
- Screens are in `src/features/households/`. The app shell (header and tab bar) is in `src/features/shell/`.

**Tech Stack:** React 19, React Router 8, Tailwind 4, Firebase modular SDK (Auth, Firestore), Vitest, `@firebase/rules-unit-testing`.

**Spec:**
- [design spec](../specs/2026-11-24-home-chores-design.md): §8.7 (households, invites, join preview, member colours), §9, §10.
- Design canvas "Chours — first-run and v1 screens": 3 Get started, 4 Create a household (default, error, loading, hand-off to Today), 5a Invite link signed out, 5b Join with a code (not found, replaced, checking), 5c Confirm (default, loading), the Flow board and Copy sheet.

## Global Constraints
- Copy exactly as in the Copy sheet: sentence case, curly ’, no "!" and no emoji.
- Only semantic tokens. Touch targets are at least 44px. Mobile first; on desktop, a centred column of max 520px (`size-content`) for app screens and 440px for first-run screens.
- Invite code alphabet: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, 8 characters, displayed as `XXXX-XXXX`.
- A household always has ≥1 admin. Roles live only in `households/{hid}.adminUids`.
- No Cloud Functions. Every multi-document change is a single batch or transaction.

## Review Focus
1. **Code typed with spaces, a dash, lowercase or look-alikes** (`k7qm 4xrt`, `K7QM4XRT`): normalise and format. Look-alikes `0/O/1/I` can't occur in valid codes, so such a code is simply not found. Test: `normalizeCode` and `formatCode` tables.
2. **Already a member** opens the code or link: go straight to that household's Today with no error. Test: JoinPage "already a member goes to Today".
3. **Signed out on `/join/:code`:** the 5a screen, then log in or sign up with `next=/join/:code`, then 5c. Test: route test for 5a, plus the `next` links on its buttons.
4. **Invite code collision** on create: retry with a new code (the rules refuse to overwrite an existing invite). Test: data test "createHousehold retries when the code is taken".
5. **Rules:**
   - a member can't add themselves as admin, join without a valid active invite, or create rooms or invites;
   - a non-admin can't rename the household;
   - nobody can empty `adminUids`.

   Tests: rules suite.

---

### Task 1: Invite-code helpers
**Files:** `src/lib/inviteCode.ts`, `src/lib/inviteCode.test.ts`
**Interfaces:**
- `CODE_ALPHABET`
- `generateCode(random?: () => number): string`: 8 characters from the alphabet.
- `normalizeCode(input: string): string`: uppercase, strip anything not in A–Z0–9, max 8.
- `formatCode(code: string): string`: inserts a dash after 4 characters (`K7QM-4X` while typing).
- [ ] Tests:
  - `normalizeCode('k7qm 4xrt')` = `'K7QM4XRT'`, and `'K7QM-4XRT-extra'` → `'K7QM4XRT'`;
  - `formatCode('K7QM4')` = `'K7QM-4'`, `formatCode('K7Q')` = `'K7Q'`;
  - `generateCode` returns 8 characters, all from the alphabet.
- [ ] RED, implement, GREEN. Commit.

### Task 2: Firestore rules and data functions (emulator-tested)
**Files:** `firestore.rules`; `src/data/households.ts`; `src/data/types.ts` (Household, Member, Room, Invite); `tests/rules/households.test.ts`; the existing `tests/rules/baseline.test.ts` keeps only the cases still true (unknown paths are denied).
**Interfaces (all take `db: Firestore` first):**
- `createHousehold(db, user: { uid; displayName }, name: string): Promise<string>`. One batch writes the household (`adminUids: [uid]`, `inviteCode`, `name`, `createdBy`, `createdAt`), the member (`color: 1`), the General room (`isDefault: true`, `order: 0`, icon `house`) and the invite (`active: true`, `householdName`). If the invite already exists, it retries up to 5 times with new codes. Returns `hid`.
- `findInvite(db, code): Promise<{ status: 'ok'; householdId; householdName } | { status: 'replaced' } | { status: 'not-found' }>`
- `getHouseholdPreview(db, hid): Promise<{ name; members: Array<{ uid; displayName; color; admin: boolean }> }>`
- `joinHousehold(db, user, code, hid): Promise<void>`. Creates the member doc with `inviteCode` and the next free colour. It is idempotent if already a member.
- `isMember(db, hid, uid): Promise<boolean>`
- `watchMyHouseholds(db, uid, cb: (list: Array<{ id; name }>) => void): Unsubscribe` (collection group `members` where `uid == uid`, then get each household).
- `watchHousehold(db, hid, cb)`: name, `adminUids`, `inviteCode`.
- `nextColor(used: number[]): MemberColor`: pure, exported and unit-tested.
- [ ] Rules tests (emulator), each one allowed and one denied:
  - create a household as self-admin, with member, General room and invite in one batch; denied when `adminUids` lists someone else;
  - join with a valid active invite; denied with a replaced invite, a wrong household or no code;
  - a member can't make themselves admin;
  - only an admin renames;
  - `adminUids` can't be emptied;
  - a signed-in non-member can `get` the household and list members; a signed-out user can't;
  - nobody can `list` invites;
  - the collection-group query for my own member docs is allowed.
- [ ] Data tests (emulator): create, then preview, then join, then `isMember`; replaced code → `'replaced'`; unknown code → `'not-found'`; join twice is idempotent; the code-collision retry.
- [ ] `nextColor([1,2,4])` = 3; all 10 used → `(count % 10) + 1`.
- [ ] RED, implement, GREEN (`npm run test:rules`, `npm test`). Commit.

### Task 3: Components
**Files:** `src/components/{ChoiceCard,InfoNote,EmptyState,BottomSheet,InviteCard,CodeInput,AppHeader,TabBar}.tsx`, tests in `components.test.tsx`; add the needed Lucide icons to `Icon.tsx`.
- `CodeInput({ value; onChange(normalized); error? })` shows `formatCode(value)` and has the screen-reader label "Invite code".
- `InviteCard({ code; link; onCopy; onShare; copied })` shows the code in groups of four and has `aria-label` "Invite code: K 7 Q M 4 X R T".
- `BottomSheet({ title; onClose; children })` is `role="dialog"`, closes on Esc and on scrim click, and moves focus into the sheet.
- `TabBar({ hid })` uses NavLinks for Today, Rooms, History and Household with `aria-current`.
- `AppHeader({ household; unread })`.
- [ ] Tests:
  - CodeInput "formats as you type and reports the normalised code";
  - InviteCard "spells the code for screen readers";
  - BottomSheet "Escape closes";
  - TabBar "marks the current tab".
- [ ] RED, then GREEN. Commit.

### Task 4: Screens and routing
**Files:** `src/features/households/{GetStartedPage,NamePrompt,CreateHouseholdPage,JoinCodePage,JoinPage,JoinConfirm}.tsx`; `src/features/shell/{HouseholdLayout,TodayEmpty,InviteSheet}.tsx`; `src/features/households/useMyHouseholds.ts`; `src/app/HomeRedirect.tsx`; `src/app/routes.tsx`; tests in `src/features/households/households-screens.test.tsx` (mocking `src/data/households`).
- `/` (signed in) redirects to the last-used household (`localStorage['chours:lastHousehold']`, if still a member), else the first household, else `/start`.
- `/start` is Get started: Hi {first name}, the two ChoiceCards, the InfoNote and Log out. If the account has no display name, NamePrompt comes first ("What should we call you?", saved via `updateDisplayName`).
- `/households/new` is Create household, with validation "Give your household a name." and loading "Creating household…". On success it goes to `/h/:hid`.
- `/join` is Join with a code. A complete code is looked up: not found or replaced shows the error; ok goes to `/join/:code`.
- `/join/:code`:
  - signed out: the 5a screen. Its buttons keep `next=/join/:code`: Google, "Log in with email" → `/login?next=…`, "Create an account" → `/signup?next=…`;
  - signed in: the code is looked up; already a member → `/h/:hid`; otherwise 5c (`JoinConfirm`) with the member list, Join household / Not now (→ `/`);
  - not found or replaced shows the 5b error state with the code prefilled.
- `/h/:hid` uses HouseholdLayout (AppHeader with the household name, TabBar) and saves the last-used household. Today shows TodayEmpty ("Your household is ready", Add a chore → `/h/:hid/chores/new`, Invite people → InviteSheet) plus the General-room InfoNote. Non-members are redirected to `/`.
- [ ] Tests:
  - "no households → /start";
  - "last-used household → /h/:hid";
  - "Get started asks for a name when there is none";
  - "Create: empty name error; success goes to /h/:hid";
  - "Join code: not found, replaced and ok → /join/:code";
  - "JoinPage signed out shows invite and keeps next";
  - "already a member goes to Today";
  - "confirm joins then goes to Today";
  - "TodayEmpty Invite people opens the sheet with the formatted code".
- [ ] RED, then GREEN. Commit.

### Task 5: Verify and PR
- [ ] `/build-check` all green, plus `npm run test:rules`.
- [ ] Browser against the emulators: create a household, invite, then in a second browser context join by code and by link (signed out → sign up → confirm), and already-member. Light and dark, phone and desktop.
- [ ] Push and open a PR. CI green, preview checked.
