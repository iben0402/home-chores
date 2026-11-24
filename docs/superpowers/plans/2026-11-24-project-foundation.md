# Project Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the Home Chores repo as a working Vite + React + TypeScript app connected to Firebase. It should run locally against the Firebase emulators, with a tested deny-all baseline for the security rules, and be ready to deploy to Firebase Hosting.

**Architecture:** A single-page React app built by Vite. `src/lib/firebase.ts` is the only place Firebase is initialized. In development it connects to the Auth and Firestore emulators under the `demo-home-chores` project. Firestore rules start as deny-all and are tested with `@firebase/rules-unit-testing`. Features come in later plans, in the folders listed in spec §11.

**Tech Stack:** Vite 8, React 19, TypeScript, React Router 8, Tailwind CSS 4 (`@tailwindcss/vite`), Firebase JS SDK 13, Vitest 5 + React Testing Library + jsdom, `@firebase/rules-unit-testing` 6, `concurrently`.

**Spec:** [docs/superpowers/specs/2026-11-24-home-chores-design.md](../specs/2026-11-24-home-chores-design.md) (§3 Constraints, §5 Tech stack, §9 indexes, §11 Architecture, §13 Local dev and deploy).

**Out of scope for this plan:** auth screens, households, rooms, chores, notifications, real security rules (beyond deny-all), and the design system (only placeholder tokens). Each of these gets its own plan.

## Global Constraints

- Fully client-side; no backend code, no Cloud Functions (Spark plan).
- TypeScript `strict: true`.
- Firebase is initialized **only** in `src/lib/firebase.ts`. Nothing else imports `firebase/app`.
- Local project ID: `demo-home-chores`. Emulator ports: Auth `9099`, Firestore `8080`, Hosting `5000`, Emulator UI `4000`.
- The web config comes from `VITE_FIREBASE_*` env vars. `.env.local` is gitignored, and `.env.example` is committed.
- Hosting serves `dist/` and rewrites every path to `/index.html` (single-page app).
- Work happens on the branch `feat/project-foundation`, not `master`.

## Review Focus

1. **Emulator connection when env vars are missing:** with no `.env.local` in dev, the app must still boot against the emulators using the demo project ID. It must not crash on an undefined `apiKey`. Tested in Task 3 (`firebase.test.ts`: "uses demo config when env is empty").
2. **Connecting to the emulators twice:** Vite hot reload or React StrictMode re-running the module must not throw "already connected"/"Firestore has already been started". Guarded by checking whether the app already exists (`getApps().length`). Tested in Task 3 ("initializes once").
3. **Deep links in production:** opening `/h/abc/history` directly must serve the app, not a 404. This is the Hosting rewrite. Checked in Task 2 by a test that parses `firebase.json`.
4. **Production build must not point at the emulators:** `import.meta.env.DEV` decides whether to connect. In a production build that is false. Checked in Task 3 with a test that flips the flag.
5. **The deny-all rules must actually deny:** an unauthenticated user and a signed-in user both fail to read and write any path. Tested in Task 2.

---

### Task 1: Scaffold the Vite + React + TypeScript app with Tailwind and Vitest

**Files:**
- Create (via `create-vite`, template `react-ts`): `package.json`, `index.html`, `vite.config.ts`, `tsconfig*.json`, `src/main.tsx`, `src/App.tsx`, `eslint.config.js`, `.gitignore`
- Delete: template demo assets (`src/App.css`, `src/assets/react.svg`, `public/vite.svg`), and replace the template's demo markup in `src/App.tsx`
- Create: `src/index.css`, `src/test/setup.ts`, `src/App.test.tsx`
- Modify: `.gitignore` (add `.env.local`, `*-debug.log`, `.firebase/`)

**Interfaces:**
- Produces:
  - npm scripts `dev`, `build`, `preview`, `test` (`vitest run`), `test:watch` (`vitest`), `lint`, `typecheck` (`tsc -b --noEmit` or the template's equivalent)
  - `src/index.css` with `@import "tailwindcss";` and an `@theme` block of placeholder tokens: `--color-surface`, `--color-text`, `--color-primary`. The design-system work will replace these later.

- [ ] **Step 1: Create the branch, commit the docs, and scaffold into the existing repo**

```bash
git checkout -b feat/project-foundation
git add README.md docs/
git commit -m "docs: add README, design spec and foundation plan"
npm create vite@latest . -- --template react-ts
```
The repo already contains `README.md` and `docs/`. If `create-vite` asks, choose "Ignore files and continue". Make sure `README.md` was **not** overwritten (`git diff README.md` is empty).

- [ ] **Step 2: Install dependencies**

```bash
npm install
npm install react-router firebase
npm install -D tailwindcss @tailwindcss/vite vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 3: Configure Tailwind and Vitest in `vite.config.ts`**

Add the `tailwindcss()` plugin. Add `test: { environment: "jsdom", setupFiles: ["src/test/setup.ts"], include: ["src/**/*.test.{ts,tsx}"] }`. `setup.ts` imports `@testing-library/jest-dom/vitest`. The `include` glob matters: it keeps the rules tests in `tests/rules/` out of `npm test`.

- [ ] **Step 4: Write the failing smoke test `src/App.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders the app name", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "Home Chores" })).toBeInTheDocument();
});
```

- [ ] **Step 5: Run it and confirm it fails**

Run: `npm test`
Expected: FAIL. The template markup has no "Home Chores" heading.

- [ ] **Step 6: Replace `src/App.tsx` with a minimal component that renders `<h1>Home Chores</h1>`, styled with Tailwind classes that use the placeholder tokens. Delete the template assets.**

- [ ] **Step 7: Verify the tests, types, lint and build**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: 1 test passes, and there are no type or lint errors. `dist/index.html` exists.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS app with Tailwind and Vitest"
```

---

### Task 2: Firebase project config, emulators, deny-all rules and rules tests

**Files:**
- Create: `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`
- Create: `tests/rules/baseline.test.ts`, `tests/rules/vitest.config.ts`
- Create: `src/config.test.ts` (checks the Hosting config)
- Modify: `package.json` (scripts)

**Interfaces:**
- Produces:
  - `npm run emulators`: `firebase emulators:start --project demo-home-chores`
  - `npm run test:rules`: `firebase emulators:exec --only firestore --project demo-home-chores "vitest run --config tests/rules/vitest.config.ts"`
  - `tests/rules/` convention: each file calls `initializeTestEnvironment({ projectId: "demo-home-chores", firestore: { rules: readFileSync("firestore.rules","utf8"), host: "127.0.0.1", port: 8080 } })`. Later rules plans add files here.

- [ ] **Step 1: Write `firebase.json`**

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  },
  "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "hosting": { "port": 5000 },
    "ui": { "enabled": true, "port": 4000 },
    "singleProjectMode": true
  }
}
```
`.firebaserc`: `{ "projects": { "default": "demo-home-chores" } }`

- [ ] **Step 2: Write `firestore.rules` as deny-all**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 3: Write `firestore.indexes.json` with the indexes from spec §9**

There are 7 composite indexes, all with `queryScope: "COLLECTION"`: 6 on `occurrences` and 1 on `notifications`. There is also a `fieldOverrides` entry for `members.uid` with a `COLLECTION_GROUP` ascending index. Copy the field orders exactly from spec §9.

- [ ] **Step 4: Write the failing tests**

`src/config.test.ts`:
```ts
import firebaseJson from "../firebase.json";
test("hosting rewrites all paths to index.html", () => {
  expect(firebaseJson.hosting.public).toBe("dist");
  expect(firebaseJson.hosting.rewrites).toContainEqual({ source: "**", destination: "/index.html" });
});
```

`tests/rules/baseline.test.ts`, with `assertFails` from `@firebase/rules-unit-testing`:
- `"unauthenticated read of households/h1 is denied"`
- `"unauthenticated write of households/h1 is denied"`
- `"signed-in user (uid alice) read of households/h1 is denied"`
- `"signed-in user write of users/alice is denied"`
- `afterAll(() => testEnv.cleanup())`, and `beforeEach(() => testEnv.clearFirestore())`

- [ ] **Step 5: Install the rules-testing package and add the scripts**

```bash
npm install -D @firebase/rules-unit-testing
```
Add the `emulators` and `test:rules` scripts (see Interfaces). Also add `"resolveJsonModule": true` to the app tsconfig if `firebase.json` won't import.

- [ ] **Step 6: Run both test suites**

Run: `npm test`
Expected: config test PASS.
Run: `npm run test:rules`
Expected: the emulator starts, all 4 baseline tests PASS, and the emulator shuts down. Java 11+ is required; this machine has Java 21.

- [ ] **Step 7: Check that the emulator suite starts with every service**

Run: `npm run build && npx firebase emulators:start --project demo-home-chores` for about 10 seconds, then stop it.
Expected: the log lists Auth on 9099, Firestore on 8080, Hosting on 5000 and the UI on 4000, with no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: add Firebase config, emulators, deny-all rules and rules tests"
```

---

### Task 3: Firebase client module with emulator wiring and env config

**Files:**
- Create: `src/lib/firebase.ts`, `src/lib/firebase.test.ts`, `.env.example`, `src/vite-env.d.ts` (extend `ImportMetaEnv`)

**Interfaces:**
- Consumes: emulator ports and the project ID from Task 2.
- Produces:
  - `export function getFirebaseConfig(env: Record<string, string | undefined>): FirebaseOptions`. Returns the `VITE_FIREBASE_*` values when `VITE_FIREBASE_PROJECT_ID` is set. Otherwise it returns the demo config `{ apiKey: "demo-key", authDomain: "demo-home-chores.firebaseapp.com", projectId: "demo-home-chores", appId: "demo-app" }`.
  - `export function initFirebase(opts: { env: Record<string,string|undefined>; useEmulators: boolean }): { app: FirebaseApp; auth: Auth; db: Firestore }`. Idempotent. When an app already exists (`getApps().length`), it returns the existing instances and doesn't reconnect the emulators.
  - `export const { app, auth, db } = initFirebase({ env: import.meta.env, useEmulators: import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS !== "false" })`
  - Firestore is created with `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`. In jsdom tests, fall back to `memoryLocalCache()` when `indexedDB` is undefined.
  - Emulator hosts: Auth at `http://127.0.0.1:9099` (`connectAuthEmulator(auth, url, { disableWarnings: true })`), and Firestore with `connectFirestoreEmulator(db, "127.0.0.1", 8080)`.

- [ ] **Step 1: Write the failing tests `src/lib/firebase.test.ts`**

Mock `firebase/auth` and `firebase/firestore` with `vi.mock` so the connect functions are spies.
- `"uses demo config when env is empty"`: `getFirebaseConfig({}).projectId === "demo-home-chores"`, and `apiKey` is a non-empty string.
- `"uses VITE_FIREBASE_* values when provided"`: pass all six keys (`API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `STORAGE_BUCKET`, `MESSAGING_SENDER_ID`, `APP_ID`) and assert they map onto the matching `FirebaseOptions` fields.
- `"connects to emulators when useEmulators is true"`: `connectAuthEmulator` is called with `"http://127.0.0.1:9099"`, and `connectFirestoreEmulator` with `("127.0.0.1", 8080)`.
- `"does not connect to emulators when useEmulators is false"`: neither spy is called.
- `"initializes once"`: calling `initFirebase` twice returns the same `app`, and each connect spy is called at most once in total.

Reset the module registry between tests (`vi.resetModules()`) and delete apps (`deleteApp`) in `afterEach`.

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/lib/firebase.test.ts`
Expected: FAIL, because `./firebase` can't be resolved.

- [ ] **Step 3: Implement `src/lib/firebase.ts` following the Interfaces block. Type the `VITE_FIREBASE_*` and `VITE_USE_EMULATORS` keys in `src/vite-env.d.ts`.**

- [ ] **Step 4: Write `.env.example`**

```
# Copy to .env.local and fill in from Firebase console → Project settings → Your apps.
# Leave empty for local development against the emulators (demo-home-chores).
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
# Set to "false" to use a real project while running `npm run dev`.
VITE_USE_EMULATORS=true
```

- [ ] **Step 5: Run all tests and the typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Firebase client module with emulator wiring"
```

---

### Task 4: App shell: router with placeholder routes, `dev:all`, and a final check

**Files:**
- Create: `src/app/routes.tsx`, `src/app/routes.test.tsx`, `src/app/Placeholder.tsx`
- Create empty folders with a `.gitkeep`: `src/data/`, `src/features/`, `src/components/`
- Modify: `src/main.tsx`, `src/App.tsx`, `package.json`

**Interfaces:**
- Consumes: `auth`/`db` from `src/lib/firebase.ts` (Task 3). `main.tsx` imports the module so it gets initialized, and `App` shows the connected project ID in a small dev-only footer: `Project: demo-home-chores (emulators)`.
- Produces:
  - `export const routes: RouteObject[]`, covering every path in spec §11's route table: `/login`, `/signup`, `/join/:code`, `/`, `/households/new`, `/h/:hid`, `/h/:hid/rooms`, `/h/:hid/rooms/:roomId`, `/h/:hid/chores/new`, `/h/:hid/chores/:choreId`, `/h/:hid/history`, `/h/:hid/household`. Each one renders `<Placeholder title="…" />` (an `<h1>` with the screen name, for example "Today" for `/h/:hid`).
  - A catch-all `*` route that renders "Not found".
  - `main.tsx` renders `<RouterProvider router={createBrowserRouter(routes)} />`.
  - npm script `dev:all`: `concurrently -n vite,fb "vite" "firebase emulators:start --only auth,firestore --project demo-home-chores"`

- [ ] **Step 1: Write the failing tests `src/app/routes.test.tsx`**

Use `createMemoryRouter(routes, { initialEntries: [path] })` with `RouterProvider`:
- `"/h/abc renders Today"`: heading "Today".
- `"/h/abc/history renders History"`: heading "History".
- `"/join/XYZ12345 renders Join household"`: heading "Join household".
- `"/does-not-exist renders Not found"`: text "Not found".

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run src/app/routes.test.tsx`
Expected: FAIL, because `./routes` can't be resolved.

- [ ] **Step 3: Implement `routes.tsx`, `Placeholder.tsx` and the `main.tsx` change. Move the "Home Chores" heading into the `/` placeholder, and update `src/App.test.tsx` to render `/` through the memory router.**

- [ ] **Step 4: Install `concurrently` and add `dev:all`**

```bash
npm install -D concurrently
```

- [ ] **Step 5: Full check**

Run: `npm test && npm run typecheck && npm run lint && npm run build && npm run test:rules`
Expected: everything passes.

Then run `npm run dev:all` and open `http://localhost:5173/h/abc`. Expected: the "Today" placeholder and the footer `Project: demo-home-chores (emulators)`. The browser console has no Firebase errors. `http://127.0.0.1:4000` shows the Emulator UI.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add app shell with placeholder routes and dev:all script"
```

---

## What comes next (separate plans, in order)
1. **Auth + households:** sign up/in, user profile, create a household, invite and join, members and roles, household switcher, and the rules plus tests for these paths.
2. **Rooms + chores + scheduling:** pure `lib/schedule.ts` with thorough tests, chore editor, occurrence creation, rules.
3. **Today / assign / complete / undo / skip**, including the transaction flow and rules.
4. **Notifications:** bell, panel, rules.
5. **History**, then **design system applied** and a PWA manifest, then the **first real deploy**.
