# TaskTracker Mobile

Mobile application for TaskTracker. Every board, column, task and project member it shows comes from the backend's GraphQL API and PostgreSQL. It has no demo mode and no local sample data: if a request fails, the app shows the failure.

## Tech Stack

- [React Native](https://reactnative.dev/) via [Expo](https://expo.dev/) (SDK 58, managed workflow)
- TypeScript
- [Expo Router](https://docs.expo.dev/router/introduction/) for file-based navigation
- ESLint with `eslint-config-expo`

## Project Structure

```text
mobile/
├── app.json             # Expo app configuration
├── .env.example         # Template for local environment variables
├── package.json         # Dependencies and npm scripts
├── package-lock.json    # Locked dependency versions
├── tsconfig.json        # TypeScript configuration
├── eslint.config.js     # ESLint configuration
├── README.md            # Mobile setup and usage instructions
├── assets/              # App icons and images
├── __tests__/           # Jest + React Native Testing Library tests
├── test-utils/          # Test helpers (mocked GraphQL backend); not app code
├── integration/         # Tests that need a running backend (npm run test:integration)
└── src/
    ├── api/
    │   ├── client.ts    # Shared HTTP client using fetch
    │   ├── graphql.ts   # GraphQL requests over the client; sends the session's Bearer token
    │   ├── auth.ts      # register, login, logout and me
    │   ├── boards.ts    # board, tasks and projects queries
    │   └── tasks.ts     # createTask mutation
    ├── app/             # Expo Router screens
    │   ├── _layout.tsx  # Root layout: AuthProvider, and the guard between signed-in and signed-out screens
    │   ├── index.tsx    # Your projects (/), with Log out
    │   ├── login.tsx    # Log in (/login), and the “You’re logged out” confirmation
    │   ├── register.tsx # Create your account (/register)
    │   ├── boards/
    │   │   ├── index.tsx      # Board list (/boards)
    │   │   └── [boardId].tsx  # Board screen (/boards/:boardId)
    │   ├── projects/new.tsx   # Create a project (/projects/new)
    │   ├── projects/[projectId]/
    │   │   └── backlog.tsx    # Project backlog (/projects/:projectId/backlog)
    │   ├── tasks/[taskId]/
    │   │   ├── index.tsx      # Task details (/tasks/:taskId?boardId=…)
    │   │   ├── edit.tsx       # Edit task (/tasks/:taskId/edit?boardId=…)
    │   │   ├── subtask.tsx    # Create subtask (/tasks/:taskId/subtask?boardId=…)
    │   │   └── dependencies.tsx # Task dependencies (/tasks/:taskId/dependencies?boardId=…)
    │   └── +not-found.tsx    # Fallback for unknown routes
    ├── auth/            # Session in memory, its secure storage, AuthProvider
    ├── components/      # Board, create-task, form and auth components (names match the design)
    ├── data/            # Board repository over the GraphQL API, React context
    ├── domain/          # Models, createTask and auth error mapping, formatting
    ├── hooks/           # useBoard, useCreateTaskForm, useCredentialsForm
    └── theme/           # Design tokens from the designer handoff
```

## Prerequisites

- **Node.js and npm** — use a version compatible with the installed Expo SDK.
- **Visual Studio Code** — recommended editor.
- **Android Studio** — required to configure the Android SDK and Android emulator.
- **Android SDK and emulator** — create a virtual device in Android Studio through **Device Manager**.
- **`ANDROID_HOME` environment variable** — should point to the Android SDK location.
- **macOS and Xcode** — required only if you want to use the iOS Simulator.

## Install Dependencies

From the repository root, enter the mobile directory:

```bash
cd mobile
```

Install the dependencies using the committed lockfile:

```bash
npm ci
```

If the project does not have a `package-lock.json`, use `npm install` instead.

## Run the App

### Android Emulator

1. Start an Android virtual device from **Android Studio → Device Manager**.
2. From the `mobile` directory, run:

   ```bash
   npm run android
   ```

   Alternatively, start Expo manually:

   ```bash
   npm start
   ```

   Then press `a` in the Expo terminal to open the app on the Android emulator.

3. Wait for the application to load. Signed out, it opens on **Welcome back** (log in); signed in, on **Your projects**.

The development server must remain running while testing the application.

### iOS Simulator (macOS Only)

The iOS Simulator requires macOS and Xcode. It cannot run on Windows or Linux.

On macOS, run:

```bash
npm run ios
```

Alternatively, run `npm start` and press `i` in the Expo terminal.

### Physical Device

1. Install Expo Go from the App Store or Google Play, if compatible with the project.
2. Run:

   ```bash
   npm start
   ```

3. Scan the QR code displayed in the terminal using the appropriate Expo Go workflow.
4. Make sure the phone and development computer can communicate over the network.

## Testing Navigation

Use these steps to verify that navigation works and that invalid routes display the fallback screen.

### 1. Test Login, Projects and Boards

1. Start the backend (see [Run against the backend](#run-against-the-backend)) and the Expo development server (`npm start`).
2. Open the application on the Android emulator. It opens on **Welcome back**.
3. Log in with a seeded user, for example `user1@local.test` / `Dev@123456`. **Your projects** lists the user's projects from the `projects` query.
4. Tap **Open project**, then a board to open it, and use the back button to return.

### 2. Test the Unknown-Route Fallback

The application should display a custom **Page not found** screen when a route does not exist. The screen should provide a **Go to Home** action.

1. Keep the Expo development server running.
2. Find the development URL printed in the Expo terminal. It will resemble:

   ```text
   exp://<your-computer-ip>:<port>
   ```

   Use the actual URL printed by your current Expo session. The IP address and port can vary.

3. Append `/--/nope` to the actual Expo URL. For example, if the displayed URL is `exp://192.168.0.102:8081`, the test URL becomes:

   ```text
   exp://192.168.0.102:8081/--/nope
   ```

   Replace the example address with your actual Expo URL.

4. On Windows, open a **second PowerShell terminal** in VS Code and run:

   ```powershell
   $expoUrl = Read-Host "Paste the Expo URL shown in the terminal"

   & "$env:ANDROID_HOME\platform-tools\adb.exe" shell am start -a android.intent.action.VIEW -d "$expoUrl/--/nope"
   ```

   Paste only the base URL, such as `exp://192.168.0.102:8081`, when prompted. Do not include `/--/nope` in your answer to the prompt.

   If `adb` is already available on your PATH, you can use the equivalent command:

   ```bash
   adb shell am start -a android.intent.action.VIEW -d "exp://<your-computer-ip>:<port>/--/nope"
   ```

   Replace the example host and port before running the command.

5. Look at the emulator and confirm that the custom **Page not found** screen appears.
6. Tap **Go to Home** and confirm that the application returns to **Your projects** (or to **Welcome back** when signed out).

If the URL does not open the application, check that the Expo development server is still running, that the emulator has Expo Go installed, and that the URL matches the current Expo terminal output.

## Run against the backend

1. From the repository root, start the database and the API: `docker compose up --build db api`. In Development this applies the migrations and seeds **Test Project** with **Test Board**, its four columns and five users.
2. From `mobile`, copy the example configuration: `cp .env.example .env` (PowerShell: `Copy-Item .env.example .env`).
3. Set `EXPO_PUBLIC_API_URL` in `.env` to the backend's base URL, without `/graphql`, then restart Expo with `npx expo start -c`:

| Where the app runs | `EXPO_PUBLIC_API_URL` |
| --- | --- |
| Android emulator | `http://10.0.2.2:8080` |
| iOS Simulator | `http://localhost:8080` |
| Physical device | `http://<computer-LAN-IP>:8080` |

4. Log in with a seeded user (`admin@local.test`, `user1@local.test` or `user2@local.test`, password `Dev@123456`), or create an account. `EXPO_PUBLIC_USER_ID` is no longer used: the projects shown are the signed-in user's.

`EXPO_PUBLIC_` variables are embedded in the app bundle, so never put passwords or tokens in them. `.env` must not be committed.

If `EXPO_PUBLIC_API_URL` is empty, the screens show that it isn't set. Android release builds can also restrict unencrypted HTTP.

## Registration, Login and Logout (US-1, US-2)

The screens follow the designer's handoff for registration, login, the projects landing and logout.

| Screen | What it does |
| --- | --- |
| **Create your account** (`/register`) | Email and password, both required; the email must look like `name@domain.tld`. Sends `register(input: { email, password })`. While it runs the button says **Creating account…** and the form is locked, so it can't be sent twice. On success: **Account created / You’re ready to get started.**, then **Continue to log in** opens the login screen with the email filled in. Registering doesn't sign in, because the backend returns no token. |
| **Welcome back** (`/login`) | Same validation. Sends `login(input: { email, password })` (**Logging in…** while it runs), keeps the session, and the guard opens **Your projects**. Typed values stay after an error. |
| **Your projects** (`/`) | `projects(userId)` for the signed-in user. **Open project** lists that project's boards. **Log out** shows **Logging out…** and “Ending your session…”. |
| **You’re logged out** | Shown on `/login` after a logout, with **Back to log in**. |

**Show password** / **Hide password** switches the field's masking without changing its value. The email field uses the email keyboard without autocapitalisation; the password fields use `new-password` / `current-password` autofill. The forms scroll and keep the focused field above the keyboard, inside the safe area. After a failed submit, focus moves to the first field with an error.

**Errors** (wording from the design):

| Backend answer | Shown as |
| --- | --- |
| `register`: `BAD_USER_INPUT` “An account with the email '…' already exists.” | “This email is already registered. Log in or use another email.” under **Email** |
| `register`: `BAD_USER_INPUT` “'…' is not a valid email address.” | “Enter a valid email address.” under **Email** |
| `register`: any other `BAD_USER_INPUT` (ASP.NET Identity's password rules: at least 10 characters, upper and lower case, a digit and a symbol) | The backend's message under **Password**. The app doesn't copy the rules, so they can't drift apart. |
| `login`: `INVALID_CREDENTIALS` (wrong password **or** unknown email; the backend answers both the same way) | “Email or password is incorrect. Check your details and try again.” above the fields |
| `login`: anything else, including no response | “We couldn’t log you in. Try again.” above the fields |
| `register`: no response | “We couldn’t reach the server. Check your connection and try again.” above the fields |
| `logout`: no response or a server error | “We couldn’t confirm logout. Try again.” with **Try again** |

Telling the register errors apart depends on the backend's message text (`RegisterHandler.cs`). If it changes, `src/domain/authErrors.ts` must change too.

### Session, storage and protected screens

- **Token.** `login` returns a JWT (`accessToken`, `expiresAt`, valid for 60 minutes by default) and the user's `id` and `email`. Every GraphQL request then sends `Authorization: Bearer <token>`. `board`, `tasks`, `projects`, `createTask` and `moveTask` all require it.
- **Secure storage.** The token, its expiry and the user's ID and email are kept with [`expo-secure-store`](https://docs.expo.dev/versions/latest/sdk/securestore/) (iOS Keychain, Android Keystore-encrypted storage). They can be read only while the device is unlocked, and are never restored to another device (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`). The password is never stored, logged or put in an error. Nothing auth-related is in AsyncStorage or `.env`.
- **Reopening the app.** An expired stored session is dropped. Otherwise `me` checks the token. If the backend refuses it (`AUTH_NOT_AUTHENTICATED`, for example after a logout on this token) or the account no longer exists, the session is dropped and the login screen says “Your session has ended. Log in again to continue.” If the server can't be reached, the unexpired session is kept.
- **Expiry while in use.** When a request sent with the session's token comes back `AUTH_NOT_AUTHENTICATED`, the session is removed from the device and from memory, and the login screen opens with the same message.
- **Protected screens.** `_layout.tsx` uses Expo Router's `Stack.Protected`: `/`, `/boards` and `/boards/:id` exist only while signed in, and `/login` and `/register` only while signed out. A link to a protected screen while signed out opens the login screen. Logout resets the history, so Back can't return to a protected screen.
- **Logout.** The stored session is deleted from the device **first**. Then `logout` revokes the token on the server, the in-memory session is cleared, and **You’re logged out** shows. If the server already refuses the token, that counts as logged out. If the server can't be reached, the error and **Try again** show. Nothing is left on the device by then, so a restart would be signed out; the token stays in memory only so that the retry can still revoke it.

Password recovery isn't part of these stories and isn't offered.

## Board Screen and Create Task

The board screen (`/boards/:boardId`) follows the designer's mobile handoff (`mobile.html`, `app.jsx`, `styles.css`):

- **Columns:** one tab and one swipeable page per column of the `board` query, always all of them, with the names and order the server returns. The app has no list of column names of its own. Tabs and swiping stay in sync, and the selected column stays selected by its ID when a refresh changes the order.
- **Tasks:** each task is on the page whose ID equals its `columnId`, ordered by the task's `position`. A task whose `columnId` isn't on the board is reported in a notice above the columns, never dropped.
- **States:** loading (skeleton, only after 300 ms), an empty board (**No tasks yet** + **Create task** on every column), an empty column on a board with tasks (“No tasks in this column”), **This board has no columns**, **Couldn’t load this board** with **Try again**, and **Board not found** with **Go to boards**.
- **Pull-to-refresh:** works on every column, including on an empty board, and fetches the board and the tasks again, so renamed or reordered columns and moved tasks show up. If it fails, the cards stay and a toast says “Couldn’t refresh the board. Pull down to try again.”
- **Move a task:** touch and hold a card to open **Move to column**, which lists the columns of this board with the current one marked. Choosing another column moves the card there at once, shows **Saving…** on it, and sends `moveTask`. If the server refuses or can't be reached, the card goes back and a notice shows the reason with **Try again** and **Dismiss**. Other tasks can still be moved while one is saving.
- **Create task:** a full-screen sheet with Title (required), Description, Assignee, Priority and Due date. The form scrolls; the **Create task** button stays at the bottom, above the keyboard. Assignee and Priority open a bottom sheet; Due date opens the native date picker. **Cancel** asks “Discard this task?” when something was entered.
- **Errors:** Title errors (“Title is required.”) and a rejected assignee (“Mona Adel isn’t a member of Test Project, so they can’t be assigned. Pick someone from this project.”) appear under their field, and the form scrolls to the first field with an error. Network and server failures appear at the top of the form and keep every value. A board that no longer exists closes the form and shows **Board not found**.

### What works against the real backend

The mobile app uses these backend GraphQL operations (`src/api/auth.ts`, `src/api/boards.ts`, `src/api/tasks.ts`). All but `register` and `login` send the session's token:

| Screen | Operation |
| --- | --- |
| Create your account | `register(input: { email, password })` |
| Log in | `login(input: { email, password })` |
| Reopening the app | `me` |
| Log out | `logout` |
| Your projects (`/`) | `projects(userId)` with the signed-in user's ID |
| Board list (`/boards?projectId=…`) | `projects(userId)` → that project's `boards` |
| Board screen | `board(id)` with `columns`, and `tasks(boardId)` with `position`, `status`, `column` and `assignees`, in one request |
| Assignee list in the form | `projects(userId)` → `projectMembers` of the board's project |
| Create task | `createTask(input)` |
| Move a task | `moveTask(input: { taskId, columnId })` |
| Task details, Edit task (loading) | `board(id)` + `tasks(boardId)` (the backend has no single-task query), and `projects(userId)` for the project's name |
| Mark complete | `moveTask(input: { taskId, columnId })` to the board's first Done column |
| Task dependencies (list) | `blockedBy` and `blocks` on each task of `tasks(boardId)` |
| Task dependencies (find a task) | `backlog(projectId, search, pageSize)` |
| Task dependencies (add) | `addTaskDependency(input: { blockingTaskId, blockedTaskId })` |
| Create a project | `createProject(input: { name })` |
| Project backlog | `backlog(projectId, search, where, page, pageSize)` |
| Create subtask | `createTask(input: { boardId, title, parentTaskId })` |
| Edit task (saving) | `updateTask(input: { taskId, title?, description?, priority?, startDate?, dueDate? })`, with only the changed fields |

If the signed-in user isn't a member of a board's project, or the members can't be loaded, the Assignee field says why and the task can only be created unassigned. The app never invents members.

The `Column` type has no colour field, so the status icon's colour comes from the column's category (`colors.status` in `src/theme/tokens.ts`). The card also shows the task's description when it has one, because no other screen shows it; the design's card has no description.

After a task is created, the task returned by `createTask` is put on the board straight away, then the board is loaded again from the backend.

How errors are told apart (the backend sends `NOT_FOUND` for a missing board **and** a missing column, with no other field):

| Backend answer | Shown as |
| --- | --- |
| `NOT_FOUND` “Board '<this board's id>' was not found.” | **Board not found** screen |
| `NOT_FOUND` “Column '…' was not found on board '…'.” | Error at the top of the form (not “Board not found”) |
| `BAD_USER_INPUT` “User '<assignee id>' is not a member of project …” | “<name> isn’t a member of <project>, so they can’t be assigned. Pick someone from this project.” under **Assignee** (the design's wording) |
| `BAD_USER_INPUT` “Title cannot be empty…” | “Title is required.” under **Title** |
| Other `BAD_USER_INPUT` (for example “This board has no columns…”) | The server's message at the top of the form |
| No response (offline, server down) | “We couldn’t reach the server…” at the top of the form |
| HTTP 5xx, or a GraphQL error without a known code | “Something went wrong on our side…” at the top of the form |

Telling the board and column apart depends on the backend's message text. If those messages change, `src/domain/createTaskErrors.ts` must change too.

## Task Details and Edit Task (US-11)

Tap a card on the board to open **Task details** (title, description, priority, start date, due date), then **Edit task**. Touch and hold still moves the card.

- The form opens filled with the task as the backend has it (grey placeholders and **Loading…** until then). **Save changes** stays disabled until something changes.
- **Save changes** sends `updateTask` with only the changed fields, so the others keep their saved values. Dates are sent as midnight UTC of the chosen day (`2026-11-20T00:00:00Z`), as the create-task form does. A cleared description, priority or date is sent as `null`. While saving, the form is locked and the button says **Saving…**; it can't be sent twice.
- After saving, the app returns to **Task details**, which reads the task again from the backend and shows **✓ Task updated**. The board reads itself again when you go back to it.
- **Cancel** and **×** leave at once if nothing changed. Otherwise **Discard changes?** offers **Keep editing** or **Discard changes**. No request is sent.
- The date pickers offer **Clear**, because both dates are optional.

Validation follows the backend (`TaskItem.cs`): the title is required (“Title is required.”) and at most 200 characters after trimming, and the due date can't be before the start date (“Due date must be on or after the start date.”); the same day is allowed. The backend's own refusals of these show under the same fields. A task that no longer exists, or any other refusal, shows above the form. A network or server failure shows “We couldn’t save your changes. Try again.” and keeps every value.

`updateTask` requires a login token but doesn't check project membership, so the app doesn't either.

## Subtasks (US-13)

**Task details** shows the task's status (its column) and a **Subtasks** section: “n / m done”, then each subtask indented under the parent with its key, column and ✓ (done) or ○. Tapping one opens it; a subtask's details link back to its parent (“Subtask of TES-24 · …”). On the board, a subtask's card says “↳ Subtask of TES-24” (or “↳ Subtask” if the parent is on another board).

**Add subtask** opens **Create subtask**, fixed to that parent: only the title is asked for (required, at most 200 characters after trimming, as the backend checks). It sends `createTask` with the parent's board and `parentTaskId`; the backend puts the new task in the board's first column and checks that the parent exists in the same project. While it runs, the title, **Cancel** and **Create subtask** are disabled and the button says **Creating…**, so only one subtask can be created. On success the app returns to the parent, which reads the board again and shows **✓ Subtask created** with the new subtask listed. A failure keeps the title and shows “We couldn’t create the subtask. Try again.” (or the backend's reason, e.g. a parent that no longer exists). **Cancel** returns to the unchanged parent.

The backend stores the relationship only as each task's `parentTaskId` and has no `subtasks` field, so a task's subtasks are the tasks on its board that point at it. A subtask on another board of the project isn't listed under its parent.

## Completing a Parent Task (US-15)

**Mark complete** on Task details moves the task to its board's first Done column with `moveTask`. The backend enforces the rule (`TaskCompletionGuard`): while any subtask isn't in a Done column it refuses with `BAD_USER_INPUT` and `extensions.incompleteSubtasks: [{ id, readableId, title }]`, and nothing is saved. The app doesn't check this itself; it shows what the backend says.

- **Refused:** “Complete N subtasks first / This parent task can’t be completed while its subtasks are still open.”, then **Incomplete subtasks** (“N remaining”) with each open child's key, column and **Open subtask →**, and **Back to task**. The parent keeps its status: nothing changes on screen until the backend accepts. If the refusal lists no children, they are taken from a fresh read of the board.
- **Coming back from a child** reads the parent again: finished children drop off the list, an open child added meanwhile is added, and when none are left the refusal clears and **All subtasks are complete.** shows with **Mark complete**.
- **Completing:** the button says **Completing…** and the request is sent once. **Accepted:** **✓ Task completed**, the status chip becomes **✓ Done**, and the button **Completed** (disabled). The task is then read again from the backend; the board updates when you return to it.
- **Failures** (no response, server error) show a message above the buttons, keep the status, and **Mark complete** can be tried again. A board with no Done column says so without sending a request.

A child on another board can't be read with this board, so it stays in the list as the backend named it until a new attempt.

## Task Dependencies (US-16)

The backend stores a dependency as one row, **blocking task → blocked task**: the blocking task must happen first. Every task returns both sides from that row: `blockedBy` (its predecessors) and `blocks` (its dependents), so the same relationship always reads the same from either task: “TES-18 · … ↓ must happen before TES-24 · …”, first task on top.

- **Task details** lists the task's relationships under **Dependencies**, with **Dependencies** opening **Task dependencies**: “Blocked by · N tasks” and “Blocks · N tasks”, each with the other task's card (tap to open it) and the direction box.
- **Add dependency**: **Relationship** “Blocked by” (the selected task must finish before this one) or “Blocks” (this task must finish before the selected one), and **Find a task**, which searches the project with `backlog`. The backend's search matches titles; a key such as `TES-18` or `18` is matched in the app against the project's tasks (the first 100). The current task is never offered, and a task already linked in that direction is shown as **Already linked** and can't be picked (the backend also ignores a repeated link). The direction box previews the link before **Add dependency**.
- **Add dependency** without a selection says “Select a task to continue.” and sends nothing. While adding, the button says **Adding…** and only one request is sent. On success the screen returns to the list with **✓ Dependency added**, read again from the backend, and **Add another dependency**.
- The backend decides what is allowed: same project, not the task itself, writers and owners only, and no cycles (US-18). Its message is shown as it is, and the selection and direction are kept so the user can change them or try again. With no response: “We couldn’t add the dependency. Try again.”
- Readers of the project (the `role` from `projects`) see the relationships but not **Add dependency**.

## Circular Dependencies (US-18)

The backend refuses a link that would close a cycle (`TaskDependencyCycleGuard`, inside `addTaskDependency`): it looks for an existing path from the task that would wait back to the task that would go first, so it catches a direct cycle (A → B, then B → A) and longer ones (A → B → C, then C → A). Nothing is saved. The refusal is `BAD_USER_INPUT` with this sentence, and no separate code:

`{X} can't block {Y}: {Y} already blocks {X} ({Y} → … → {X}), so this would create a cycle.`

The app recognises a cycle only by that whole sentence (`toCycleInfo` in `src/domain/dependencies.ts`), so other `BAD_USER_INPUT` refusals (different projects, the task itself) are never shown as cycles. It doesn't look for cycles itself. If the backend's wording changes, `toCycleInfo` must change with it.

- **Refused:** the form (titled **Add dependency**) keeps the relationship and the chosen task, and shows “This dependency creates a cycle. / TES-27 already depends on TES-24. Choose another task or cancel.” and “Existing: TES-24 → TES-27 / Rejected: TES-27 → TES-24 / The new link was not saved.”, with **Choose another task** and **Cancel**. No success message, and nothing is added to the list: the list is only ever what the backend returns.
- **Choose another task:** search again (“Search tasks…”); the refused task is marked **Creates a cycle** for that direction and can't be picked. The button becomes **Retry with TES-18**; while it runs it says **Adding…**, sends one request and keeps the explanation on screen. Another refused cycle replaces the explanation.
- **Accepted:** **✓ Dependency added**, the dependencies read again from the backend (the earlier ones unchanged, the refused one absent), “The rejected TES-27 link was never added.” and **Back to task**.
- **Cancel** returns to the saved dependencies as they were. Other refusals and failures show their own message (“We couldn’t add the dependency. Try again.” with no response or a server error), never the cycle explanation.

## Project Backlog (US-23)

**View backlog** on a project in **Your projects** opens **Project backlog**: every task of the project's boards in one list, as `backlog` returns it. The backend scopes it to the project (and refuses non-members), orders it by board, column and position, and does all searching, filtering and paging; the app keeps that order and numbers the rows by position (“1 · TES-31”). Each row shows the title, the status (its column), the priority (“No priority” when none) and the estimate in story points (“Not estimated” when none). Tapping a row opens the task.

| Variable | Sent | Backend |
| --- | --- | --- |
| `projectId` | Always | The selected project |
| `search` | Only when not blank (trimmed) | Part of the title, case ignored |
| `where.status.in` | Only when a status chip is on | `BACKLOG`, `TO_DO`, `IN_PROGRESS`, `DONE`, `CANCELLED` |
| `where.priority.in` | Only when a priority chip is on | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `page`, `pageSize` | Always; `pageSize` is 20 | 1-based page; `hasNextPage`, `totalCount`, `totalPages` come back |

- **Search** is sent 350 ms after typing stops. **Status** and **Priority** chips can be combined with each other and with the search; **Clear filters** removes the chips. Any change asks for page 1 again and replaces the list.
- **Load more** asks for the next page with the same search and filters and adds it below, skipping any item already shown; it is shown only while `hasNextPage` is true, and “End of the backlog.” after the last page. While it loads, the list stays and the button says **Loading more…**; if it fails, the list stays and **Try again** asks for the same page.
- Only the answer to the latest search or filter is used; a late answer to an earlier one is ignored.
- States from the design: **Loading backlog…** with grey rows (never the empty state first), **No backlog items yet** with **Back to project**, and **Couldn’t load the backlog** with **Try again**. With a search or filter and no match: **No matching backlog items** with **Clear search and filters**.

The design shows no search, filter or paging controls; they follow the app's existing inputs and buttons. The `storyPoints` field was added to the backend's `Task` type for this screen (`TaskItem.StoryPoints` existed but wasn't exposed). No operation sets story points yet, so every item shows “Not estimated” until one does.

## Creating a Project (US-3)

**Create project** under **Your projects** opens **Create a project**, which asks only for the name. It sends `createProject(input: { name })` with the trimmed name; the backend takes the owner from the token, makes the key, and saves the project, the Owner membership and a first board together. Back on the list, which is read from the backend each time it comes into view, **✓ Project created. You are the Owner.** shows with the new project.

- An empty or blank name shows “Enter a project name.” and sends nothing. Any other rule is the backend's (at most 100 characters): its message shows under the name.
- While creating, the form, **Cancel** and Android's Back are locked, and only one request is sent.
- With no answer or a server error: “Couldn’t create the project. Your name is kept. Try again.” The project may have been saved all the same, so trying the same name again first reads the list. If a project of that name that the user owns has appeared since the first attempt, it counts as created and nothing is sent. If the list can't be read, nothing is sent.

## Manual test against the real backend

Use a local development database only, never shared data.

1. Start the backend and Expo as described in [Run against the backend](#run-against-the-backend), and press `a`.
2. Log in as `admin@local.test` / `Dev@123456` → **Open project** on **Test Project** → **Test Board**. The header shows “Test Project · N tasks”, and the tabs show the columns from the database.
3. **New task** (or **Create task** on an empty board): the Assignee sheet lists the project's members.
4. Create a task with every field filled. The card appears in the active column without a refresh. Pull to refresh, and check it with `SELECT * FROM tasks;`.
5. Rename a column, then pull to refresh. Restore it afterwards:

   ```sql
   UPDATE board_columns SET "Name" = 'Ready for work' WHERE "Name" = 'To do';
   UPDATE board_columns SET "Name" = 'To do' WHERE "Name" = 'Ready for work';
   ```

6. Open a board that doesn't exist, with your Expo URL: `adb shell am start -a android.intent.action.VIEW -d "exp://10.0.2.2:8081/--/boards/00000000-0000-0000-0000-000000000001"`. Expect **Board not found**.
7. Run `docker compose stop api`. Pull to refresh (the cards stay, and a toast says so), and submit a filled form (the error is at the top and every value stays). Run `docker compose start api` and submit again.

`Board` uses soft delete and `createTask` doesn't filter out soft-deleted boards, so a soft-deleted board may still accept new tasks while the `board` query reports it as not found.

## Checks

The following checks use dependencies installed in the project:

```bash
npm run lint
npm run typecheck
npm test -- --runInBand
```

`npm test` uses a mocked GraphQL backend, so it needs no running backend, database or emulator. These fixtures live only in `__tests__` and `test-utils`, and the app never imports them.

The integration tests call the real API and need a running backend. They aren't part of `npm test` or CI, and because the backend has no delete operation, each run leaves three `integration …` tasks on the board and one `integration-…@test.local` account:

```bash
LIVE_API_URL=http://localhost:8080 LIVE_EMAIL=admin@local.test LIVE_PASSWORD='Dev@123456' npm run test:integration
```

You can inspect available scripts by running:

```bash
npm run
```

Optional: Expo Doctor checks project configuration and dependency compatibility. It may require internet access and can download its CLI package the first time it is run:

```bash
npx expo-doctor
```

Only report a check as passed after you have actually run it and reviewed its result.

## Building the App

This project targets Android and iOS. Day-to-day development can use Expo Go when the project and dependencies are compatible with it.

The following build options may require additional configuration and have not necessarily been verified for this project.

| Option                      | Prerequisites                                                                                                                               | Command                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Local native Android build  | Android Studio, Android SDK, a suitable JDK, and a running emulator or connected device. An initial build may download Gradle dependencies. | `npx expo run:android`                 |
| Local native iOS build      | macOS, Xcode, and CocoaPods                                                                                                                 | `npx expo run:ios`                     |
| Cloud build using EAS Build | Internet access, an Expo account, and EAS project configuration                                                                             | `npx eas-cli build --platform android` |

Native build commands may generate `android/` and `ios/` directories through Expo prebuild. These generated directories are not needed for the current managed-workflow skeleton and must not be committed for this task.

The cloud-build command may download the EAS CLI on first use and may prompt for project configuration. Verify the current project configuration before using it.

The iOS build command requires macOS and Xcode; it cannot run locally on Windows.

## Files That Must Not Be Committed

Do not commit the following generated, local-only, or sensitive files and directories:

- `node_modules/` — installed JavaScript dependencies.
- `.expo/` — local Expo state, device information, and caches. The existing root `.gitignore` does not ignore this directory, so do not stage it.
- `dist/` — generated export output.
- `android/` and `ios/` — generated native project directories for this managed-workflow task. These are not covered by the existing root `.gitignore`; do not stage them.
- `expo-env.d.ts` — generated by Expo and not covered by the existing root `.gitignore`; do not stage it unless the team explicitly decides to track it.
- `.env` and `.env.local` — local environment configuration. `.env.example` may be committed if it contains no secrets.
- Signing keys and credentials, including `*.jks`, `*.keystore`, `*.p8`, `*.p12`, `*.key`, and `*.mobileprovision`.

The existing root `.gitignore` must remain unchanged for this task.

Stage intended files explicitly rather than using `git add .`. For example:

```bash
git add mobile/README.md mobile/package.json mobile/package-lock.json mobile/app.json mobile/tsconfig.json mobile/eslint.config.js mobile/.env.example mobile/assets mobile/src
```

Before committing, inspect the staged files:

```bash
git status --short
git diff --cached --check
git diff --cached --stat
```

Confirm that `.expo/`, `node_modules/`, build outputs, secrets, and unintended files are not staged.

## Git Workflow

After testing the application and reviewing the changes:

1. Stage only the intended mobile source, configuration, assets, lockfile, and README files.
2. Commit the changes.
3. Push the feature branch.
4. Open a pull request targeting `main`.
5. Request at least one approval.

Do not merge directly into `main`. The task is complete only after the pull request has received the required approval and has been merged.
