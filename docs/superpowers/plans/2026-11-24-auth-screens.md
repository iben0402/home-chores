# Auth Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Welcome/Log in, Create account and Forgot password screens from the Claude Design canvas so they work against Firebase Auth. Also add the Chours app icon.

**Architecture:**
- The design system's Tailwind v4 theme is copied into `src/styles/theme.css`. `design_system/` is gitignored and serves only as reference.
- UI primitives live in `src/components/` as TSX with Tailwind utilities on the semantic tokens.
- Auth calls live in `src/data/auth.ts`. Pages and the auth context live in `src/features/auth/`. Route guards are in `src/app/`.

**Tech Stack:** React 19, React Router 8, Tailwind 4, Firebase Auth (modular SDK), lucide-react, Vitest + Testing Library.

**Spec:**
- [docs/superpowers/specs/2026-11-24-home-chores-design.md](../specs/2026-11-24-home-chores-design.md): §2, §5, §8.7 routes and the `/join` redirect, §11.
- Design canvas "Chours — first-run screens" (Claude Design), artboards 1 Welcome (6 states plus desktop), 2 Create account (default, errors, dark), Forgot (form, sent), New components and the Copy sheet.
- Approved in conversation on 2026-11-24:
  - real email/password and Google sign-in, plus password reset;
  - the name is stored as the Auth `displayName`;
  - Google uses a popup;
  - the theme follows the system setting;
  - the app icon is a teal tile with a house that has a check mark inside;
  - the design system is used as reference only.

## Global Constraints
- Copy is exactly as in the design's Copy sheet: sentence case, curly apostrophes (’), no exclamation marks, no emoji.
- Only semantic colour utilities from the theme. Raw palette colours aren't available. The Google button's hexes are the only exception (Google branding).
- Touch targets are at least 44px. Inputs are 16px. Focus uses `focus-visible` with the focus-ring token.
- Phone-first. On desktop (≥ 640px), auth screens show the content in a centred column of max 440px on `bg-canvas`. On phone they are full width with 16px gutters.
- Dark mode is `data-theme` on `<html>`, set before first paint from `prefers-color-scheme`.
- No Firestore writes in this plan. Rules stay deny-all.

## Review Focus
1. **Popup blocked or closed by the user** (`auth/popup-closed-by-user`, `auth/cancelled-popup-request`, `auth/popup-blocked`): show "Google sign-in didn’t finish. Try again, or use your email.", reset the busy state, and show no other error. Test: `authErrorMessage` mapping plus the LoginPage Google-cancel test.
2. **Double submit** while a request is in flight: the button is disabled and `aria-busy`, and the submit handler ignores repeats. Test: "ignores a second submit while logging in".
3. **Signed-in user opens `/login` or `/signup`:** redirect to `/`. **Signed-out user opens a protected route:** redirect to `/login?next=<path>`, then return there after login. Test: guard tests.
4. **Offline:** the notice appears on the `offline` event and hides on `online`. The form stays usable. Test: OfflineNotice tests.
5. **Unknown Firebase error codes** fall back to "Something went wrong. Try again." and are never shown raw. Test: mapping test.

---

### Task 1: Theme, fonts, theme boot, app icon
**Files:** create `src/styles/theme.css` (a copy of `design_system/tailwind/theme.css` with a header comment saying where it came from), `public/favicon.svg`, `public/apple-touch-icon.png` (180), `public/icon-192.png`, `public/icon-512.png`, `public/manifest.webmanifest`, `src/assets/logo-mark.svg` (the same artwork, for the in-app AppMark). Modify `src/index.css` (`@import "./styles/theme.css"` only), `index.html` (Figtree + Roboto 500 Google Fonts, theme boot script, icon and manifest links, `theme-color` light/dark), `src/config.test.ts`.
- [ ] Test `index.html wires icons, manifest and the theme boot`: index.html contains `rel="icon"` → `/favicon.svg`, `rel="apple-touch-icon"`, `rel="manifest"`, and a script setting `document.documentElement.dataset.theme`. The manifest has `name: "Chours"` and 192 and 512 icons. RED, then implement, then GREEN.
- [ ] PNGs are rendered from the SVG with headless Chrome at exact sizes, and checked with `sips -g pixelWidth`.
- [ ] Commit.

### Task 2: UI primitives
**Files:** `src/components/{Icon,Button,IconButton,TextField,PasswordField,OrDivider,OfflineNotice,GoogleSignInButton,AppMark,Avatar,DueBadge,ChoreRow}.tsx`, `src/components/useOnline.ts`, tests in `src/components/*.test.tsx`.
**Interfaces (produced):**
- `Icon({ name: IconName; size?: number; className?: string; label?: string })`, where `IconName` is a union of the Lucide names the README lists and is used here (`house`, `circle-alert`, `loader-circle`, `chevron-left`, `eye`, `eye-off`, `wifi-off`, `mail`, `clock-alert`, `sun`, `calendar`, `calendar-days`, `check`, `skip-forward`, `user-round`, `hand`).
- `Button({ variant?: 'primary'|'secondary'|'ghost'|'destructive'|'take'; size?: 'sm'|'md'|'lg'; block?; loading?; icon? } & ButtonHTMLAttributes)`. Loading means `aria-busy`, disabled, and a spinner icon.
- `IconButton({ icon: IconName; label: string } & ButtonHTMLAttributes)`.
- `TextField({ label; hint?; error?; labelAction?: ReactNode } & InputHTMLAttributes)`. Error means `aria-invalid` and a message with `circle-alert`, linked through `aria-describedby`.
- `PasswordField({ label; hint?; error?; labelAction? } & InputHTMLAttributes)`. Toggle button with `aria-pressed`, labelled "Show password"/"Hide password".
- `OrDivider()`. `OfflineNotice()` is `role="status"` and renders only while `useOnline()` is false. `useOnline(): boolean`.
- `GoogleSignInButton({ loading?; onClick })`. Light colours #FFFFFF / #747775 / #1F1F1F and dark #131314 / #8E918F / #E3E3E3, via `dark:` variants.
- `AppMark({ compact?: boolean })`: logo tile plus "Chours" in `type-display`.
- `Avatar({ name; color: 1..10; size? })`: initials are the first letters of the first two words, `aria-label` is the name.
- `DueBadge({ status; label })`, with the icon per status from the design-system README table and sr-only "Overdue:" for overdue.
- `ChoreRow({ chore: { title; room?; due; assignee?: { name; color } | null; done? }; onToggle?(checked) })`. A checkbox `role="checkbox"` with the check-pop and draw animation, and the title in `fg-muted` when done.
- [ ] Tests (RED first, one file per component where behaviour exists):
  - Button: "loading sets aria-busy and disables";
  - TextField: "error sets aria-invalid and describes the input";
  - PasswordField: "toggle shows and hides the password and flips its label";
  - OfflineNotice: "appears on offline event and hides on online";
  - Avatar: "uses initials of first two words" (`Anna Nowak` → `AN`, `Tom` → `T`);
  - ChoreRow: "checkbox reports toggle with the new state";
  - DueBadge: "overdue badge announces Overdue:".
- [ ] Implement until GREEN. Commit.

### Task 3: Auth data layer and session
**Files:** `src/data/auth.ts`, `src/data/auth.test.ts`, `src/features/auth/AuthProvider.tsx` (`AuthProvider`, `useAuth(): { user: User | null; loading: boolean }`).
**Interfaces:**
- `signIn(email, password)`, `signUp({ name, email, password })` (createUser, then `updateProfile({ displayName: name.trim() })`, then reload the user so the context sees the name), `signInWithGoogle()` (popup), `sendReset(email)`, `signOut()`. All return `Promise<void>`.
- `authErrorMessage(code: string): { field: 'email' | 'password' | 'name' | 'form'; message: string }`. Mapping:
  - `auth/invalid-credential`, `auth/wrong-password`, `auth/user-not-found` → password: "That email and password don’t match.";
  - `auth/invalid-email` → email: "Enter an email address like you@example.com.";
  - `auth/email-already-in-use` → email: "There’s already an account with this email.";
  - `auth/weak-password` → password: "Use at least 6 characters.";
  - `auth/popup-closed-by-user`, `auth/cancelled-popup-request`, `auth/popup-blocked` → form: "Google sign-in didn’t finish. Try again, or use your email.";
  - `auth/network-request-failed` → form: "You’re offline. Try again when you’re back.";
  - `auth/too-many-requests` → form: "Too many attempts. Wait a minute and try again.";
  - anything else → form: "Something went wrong. Try again."
- [ ] Tests:
  - the mapping table;
  - "signUp sets the display name after creating the user" (with `firebase/auth` mocked);
  - "signUp trims the name".
- [ ] RED, then implement, then GREEN. Commit.

### Task 4: Screens, layout and routing
**Files:** `src/features/auth/{AuthLayout,LoginPage,SignUpPage,ForgotPage}.tsx` and tests; `src/app/guards.tsx` (`RequireAuth`, `RedirectIfAuthed`) and tests; `src/features/home/HomePlaceholder.tsx` ("Hi {first name}" plus a **Log out** button; replaced by Get started next); modify `src/app/routes.tsx`, `src/main.tsx` (AuthProvider), `src/App.tsx` (no fixed padding wrapper for auth screens), `src/App.test.tsx`.
- Layout:
  - Welcome: AppMark and tagline vertically centred, with the two-row chore preview (Bins out · General · Today · Tom Reid; Wipe the hob · Kitchen · Thu 3 Dec · Maja Lis). The preview animates by ticking a row, holding 700ms, fading out, then coming back. That loop is skipped under reduced motion.
  - Actions sit at the bottom: Google, the divider, Email, Password with "Forgot password?" next to its label, **Log in** as a secondary lg block (the design default), and "New here? Create an account".
  - Sign up: a back button, the heading and subheading, then the form at the bottom.
  - Forgot: the form, then the sent state ("Back to log in", "Send it again").
- Validation on submit:
  - an empty name shows "Add your name so your household knows who’s who.";
  - a password shorter than 6 characters on sign-up shows "Use at least 6 characters.";
  - an empty email shows "Enter your email.".
- Routes:
  - `/login`, `/signup` and `/forgot` are wrapped in `RedirectIfAuthed`;
  - `/` and `/h/*` are wrapped in `RequireAuth`, which redirects to `/login?next=…`;
  - `/join/:code` stays public (the invite flow comes later).
- [ ] Tests:
  - Login: "submits email and password", "shows mapped error under password", "ignores a second submit while logging in", "Google cancel shows the form message";
  - SignUp: "empty name shows the name error and does not call signUp", "email in use shows Log in instead link";
  - Forgot: "shows the sent state after sending";
  - guards: "redirects signed-out users to /login?next=", "sends signed-in users from /login to /", "returns to next after login".
- [ ] RED, then implement, then GREEN. Commit.

### Task 5: Verify in a browser and open the PR
- [ ] `npm test`, `typecheck`, `lint`, `build` and `test:rules` all green.
- [ ] `npm run dev:all`, then check with `/browse` at 390×844 and 1280×800, light and dark:
  - Welcome, Sign up, Forgot and the error state, compared against the design artboards;
  - email sign-up, then the Hi page, then Log out, then log in, all against the Auth emulator;
  - Google through the emulator's account picker.
- [ ] Push, open a PR, and check the preview deploy.
