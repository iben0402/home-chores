# Home Chores

A simple app for sharing chores at home. Create an account, set up a household, invite family members or flatmates, and manage rooms and chores together.

It's meant to be a **neutral place to say "this needs doing."** Anyone can raise a one-off chore, such as "clean your dishes in the sink", and assign it to someone. Everyone sees the same list, so nobody has to bring it up face to face.

## Features

- **Accounts and households:** sign up with email/password or Google. You can create a household or join one with an invite link or code, and belong to more than one household.
- **Roles**
  - **Admins** manage members and roles, rooms, and repeating chores and their schedules.
  - **Members** take chores, assign chores, tick chores off and create one-off chores.
  - A household always has at least one admin.
- **Rooms:** Kitchen, Bathroom, and so on. Every household starts with a "General" room.
- **Three kinds of chore**
  - **One-off:** done once.
  - **Every N days/weeks/months after it was last done:** for example, vacuuming.
  - **Fixed calendar schedule:** for example, bins every Monday, or bills on the 1st.
- **Assignments belong to one occurrence of a chore, not the whole chore.** Taking vacuuming this week doesn't sign you up forever. You can also claim, or assign others to, the next few occurrences to plan a rota.
- **Anyone can assign anyone.** You can always unassign yourself.
- **In-app notifications:** a 🔔 with an unread count when someone assigns you a chore.
- **History:** who did what, where and when, filterable by person and room.
- **Undo:** if you tick something off by mistake, you can undo it within 10 minutes.

Not in v1: email or push reminders, points or leaderboards, automatic rotations.

## Tech stack

| | |
|---|---|
| Frontend | React 19 + TypeScript, built with Vite, React Router, Tailwind CSS |
| Auth | Firebase Authentication (email/password, Google) |
| Database | Cloud Firestore (live updates, offline cache) |
| Hosting | Firebase Hosting (static single-page app) |
| Tests | Vitest, React Testing Library, `@firebase/rules-unit-testing` |
| Local dev | Firebase Emulator Suite |

The app is **fully client-side**: there is no custom backend. Permissions, such as who can edit chores or change roles, are enforced by **Firestore security rules** ([firestore.rules](firestore.rules)). It runs on Firebase's free **Spark** plan.

## Architecture

```
Browser (React SPA)
  ├─ Firebase Auth      → who you are
  └─ Cloud Firestore    → all data, live-synced between household members
        └─ security rules → who can do what (admin vs member)
Firebase Hosting        → serves the built static files
```

### Data model (Firestore)

```
users/{uid}                              profile
users/{uid}/notifications/{id}           in-app inbox (🔔)
invites/{code}                           invite code → household
households/{hid}                         name, adminUids[], inviteCode
households/{hid}/members/{uid}           who belongs to the household
households/{hid}/rooms/{roomId}
households/{hid}/chores/{choreId}        definition + schedule
households/{hid}/occurrences/{occId}     one instance of a chore: due date, assignee, status
```

History is simply the occurrences that are marked done.

### Source layout

```
src/
  app/        routes, auth gate, household layout
  lib/        firebase init, pure scheduling/date logic
  data/       all Firestore reads/writes + React hooks
  features/   auth, today, rooms, chores, history, household, notifications
  components/ shared UI
tests/rules/  Firestore security rules tests
```

The full design is in [docs/superpowers/specs/2026-11-24-home-chores-design.md](docs/superpowers/specs/2026-11-24-home-chores-design.md). It covers behaviour, permissions and edge cases.

## Getting started

Requirements: Node 20+, the Firebase CLI (`npm i -g firebase-tools`), and Java 11+ for the emulators.

```bash
npm install
npm run dev:all     # Vite + Firebase emulators (Auth, Firestore)
```

Local development uses the emulators with the `demo-home-chores` project, so it doesn't need a real Firebase project. Even when `.env.local` holds the real config, `npm run dev` uses the emulators unless `VITE_USE_EMULATORS=false`.

```bash
npm test            # unit tests
npm run test:rules  # Firestore security rules tests (starts the emulator)
npm run build       # production build into dist/
```

### Deploying

The Firebase project is `home-chores-9a50e`, the default in `.firebaserc`. Authentication (Email/Password + Google) and Firestore are enabled.

1. Make sure `.env.local` has the web app config (`VITE_FIREBASE_*`, see `.env.example`). `npm run build` fails if it's missing.
2. Run `firebase login` (once).
3. Run `npm run build && firebase deploy`. This deploys Hosting, Firestore rules and indexes.
