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
    │   ├── graphql.ts   # GraphQL requests over the client (network / HTTP / GraphQL errors)
    │   ├── boards.ts    # board, tasks and projects queries
    │   └── tasks.ts     # createTask mutation
    ├── app/             # Expo Router screens
    │   ├── _layout.tsx  # Root navigation layout
    │   ├── index.tsx    # Home screen (/)
    │   ├── boards/
    │   │   ├── index.tsx      # Board list (/boards)
    │   │   └── [boardId].tsx  # Board screen (/boards/:boardId)
    │   └── +not-found.tsx    # Fallback for unknown routes
    ├── components/      # Board, create-task and form components (names match the design)
    ├── data/            # Board repository over the GraphQL API, React context
    ├── domain/          # Models, createTask error mapping, formatting
    ├── hooks/           # useBoard, useCreateTaskForm
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

3. Wait for the application to load. The Home screen should display the TaskTracker name, welcome message, and a **View boards** button.

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

### 1. Test Home and Boards

1. Start the backend (see [Run against the backend](#run-against-the-backend)) and the Expo development server (`npm start`).
2. Open the application on the Android emulator.
3. Confirm that the Home screen displays the application name and welcome message.
4. Tap **View boards**. The board list comes from the `projects` query.
5. Tap a board to open it, and use the back button to return.

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
6. Tap **Go to Home** and confirm that the application returns to the Home screen.

If the URL does not open the application, check that the Expo development server is still running, that the emulator has Expo Go installed, and that the URL matches the current Expo terminal output.

## Run against the backend

1. From the repository root, start the database and the API: `docker compose up --build db api`. In Development this applies the migrations and seeds **Test Project** with **Test Board**, its four columns and five users.
2. From `mobile`, copy the example configuration: `cp .env.example .env` (PowerShell: `Copy-Item .env.example .env`).
3. Set the two values in `.env`, then restart Expo with `npx expo start -c`:

| Variable | Value |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | The backend's base URL, without `/graphql`. See the table below |
| `EXPO_PUBLIC_USER_ID` | The user whose projects are listed. Get one with `SELECT "Id", "UserName" FROM "AspNetUsers";` (port 5433, user and password `tasktracker`) |

| Where the app runs | `EXPO_PUBLIC_API_URL` |
| --- | --- |
| Android emulator | `http://10.0.2.2:8080` |
| iOS Simulator | `http://localhost:8080` |
| Physical device | `http://<computer-LAN-IP>:8080` |

The IDs differ per database because the seed generates them, so `EXPO_PUBLIC_USER_ID` has to be taken from your own database.

**No login yet.** The backend has no login, session or token operation, and no authorization on its queries, so the app sends no credentials. `EXPO_PUBLIC_USER_ID` stands in for the signed-in user until the backend adds login. It isn't a secret, but `EXPO_PUBLIC_` variables are embedded in the app bundle, so never put passwords or tokens in them. `.env` must not be committed.

If `EXPO_PUBLIC_API_URL` is empty, the screens show that it isn't set. Android release builds can also restrict unencrypted HTTP.

## Board Screen and Create Task

The board screen (`/boards/:boardId`) follows the designer's mobile handoff (`mobile.html`, `app.jsx`, `styles.css`):

- **Columns:** one tab and one swipeable page per column of the `board` query, always all of them, with the names and order the server returns. The app has no list of column names of its own. Tabs and swiping stay in sync, and the selected column stays selected by its ID when a refresh changes the order.
- **Tasks:** each task is on the page whose ID equals its `columnId`, ordered by the task's `position`. A task whose `columnId` isn't on the board is reported in a notice above the columns, never dropped.
- **States:** loading (skeleton, only after 300 ms), an empty board (**No tasks yet** + **Create task** on every column), an empty column on a board with tasks (“No tasks in this column”), **This board has no columns**, **Couldn’t load this board** with **Try again**, and **Board not found** with **Go to boards**.
- **Pull-to-refresh:** works on every column, including on an empty board, and fetches the board and the tasks again, so renamed or reordered columns and moved tasks show up. If it fails, the cards stay and a toast says “Couldn’t refresh the board. Pull down to try again.”
- **Create task:** a full-screen sheet with Title (required), Description, Assignee, Priority and Due date. The form scrolls; the **Create task** button stays at the bottom, above the keyboard. Assignee and Priority open a bottom sheet; Due date opens the native date picker. **Cancel** asks “Discard this task?” when something was entered.
- **Errors:** Title errors (“Title is required.”) and a rejected assignee (“Mona Adel isn’t a member of Test Project, so they can’t be assigned. Pick someone from this project.”) appear under their field, and the form scrolls to the first field with an error. Network and server failures appear at the top of the form and keep every value. A board that no longer exists closes the form and shows **Board not found**.

### What works against the real backend

The mobile app uses these backend GraphQL operations (`src/api/boards.ts`, `src/api/tasks.ts`):

| Screen | Operation |
| --- | --- |
| Board list (`/boards`) | `projects(userId)` → every project's `boards` |
| Board screen | `board(id)` with `columns`, and `tasks(boardId)` with `position`, `status`, `column` and `assignees`, in one request |
| Assignee list in the form | `projects(userId)` → `projectMembers` of the board's project |
| Create task | `createTask(input)` |

Without `EXPO_PUBLIC_USER_ID`:

- the board list shows “Set EXPO_PUBLIC_USER_ID…”;
- a board opened by its link still loads its columns and tasks, but the Assignee field says the project members can't be listed, and the task can only be created unassigned. The app never invents members.

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

## Manual test against the real backend

Use a local development database only, never shared data.

1. Start the backend and Expo as described in [Run against the backend](#run-against-the-backend), and press `a`.
2. Home → **View boards** → **Test Board**. The header shows “Test Project · N tasks”, and the tabs show the columns from the database.
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

The integration tests call the real API and need a running backend. They aren't part of `npm test` or CI, and because the backend has no delete operation, each run leaves two `integration …` tasks on the board:

```bash
LIVE_API_URL=http://localhost:8080 LIVE_USER_ID=<a user id> npm run test:integration
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
