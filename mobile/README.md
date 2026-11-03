# TaskTracker Mobile

Mobile application for TaskTracker. This is the initial skeleton, with basic screens, navigation, and a placeholder API client ready for future backend integration.

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
└── src/
    ├── api/
    │   ├── client.ts    # Shared HTTP client using fetch
    │   ├── graphql.ts   # GraphQL requests over the client (network / HTTP / GraphQL errors)
    │   └── tasks.ts     # createTask mutation
    ├── app/             # Expo Router screens
    │   ├── _layout.tsx  # Root navigation layout
    │   ├── index.tsx    # Home screen (/)
    │   ├── task-details.tsx  # Task Details screen (/task-details)
    │   ├── boards/
    │   │   ├── index.tsx      # Board list (/boards)
    │   │   └── [boardId].tsx  # Board screen (/boards/:boardId)
    │   └── +not-found.tsx    # Fallback for unknown routes
    ├── components/      # Board, create-task and form components (names match the design)
    ├── data/            # Board data sources: real backend, demo data, React context
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

3. Wait for the application to load. The Home screen should display the TaskTracker name, welcome message, and a **View sample task** button.

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

### 1. Test Home and Task Details

1. Start the Expo development server:

   ```bash
   npm start
   ```

2. Open the application on the Android emulator.
3. Confirm that the Home screen displays the application name and welcome message.
4. Tap **View sample task**.
5. Confirm that the Task Details screen opens and displays its placeholder task information.
6. Tap **Back to Home**, or use the header back button.
7. Confirm that the Home screen appears again.

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

## Configuring the API Base URL

The placeholder API client in `src/api/client.ts` reads the backend URL from the `EXPO_PUBLIC_API_URL` environment variable.

No API request is made when the application starts, so the basic screen flow works without a running backend.

### 1. Create the Local Environment File

From the `mobile` directory, copy the example configuration:

```bash
cp .env.example .env
```

On Windows PowerShell, you can also use:

```powershell
Copy-Item .env.example .env
```

### 2. Configure the Backend URL

Set `EXPO_PUBLIC_API_URL` in `.env` using the actual port on which the backend is listening.

| Where the app runs | Host to use                                                        |
| ------------------ | ------------------------------------------------------------------ |
| Android emulator   | `10.0.2.2` — normally maps to the development computer's localhost |
| iOS Simulator      | `localhost`                                                        |
| Physical device    | The development computer's reachable LAN IP address                |

For example, the Android emulator URL has this form:

```text
http://10.0.2.2:<actual-backend-port>
```

Replace `<actual-backend-port>` with the port used by the backend. Do not copy the placeholder literally.

Restart the Expo development server after changing `.env`.

If `EXPO_PUBLIC_API_URL` is not configured, the API client reports a clear configuration error when a request is attempted.

The `.env` file contains local configuration and must not be committed. Only `.env.example`, containing example values and no secrets, should be committed.

**Security note:** Variables prefixed with `EXPO_PUBLIC_` are embedded in the application bundle. Never put passwords, access tokens, or other secrets in them.

For local HTTPS development, coordinate the certificate and URL configuration with the backend developer. A development certificate that the emulator does not trust may cause requests to fail. Android release builds can also restrict unencrypted HTTP traffic.

## Board Screen and Create Task

The board screen (`/boards/:boardId`) follows the designer's mobile handoff (`mobile.html`, `app.jsx`, `styles.css`):

- **States:** loading (skeleton, only after 300 ms), empty (**No tasks yet** + **Create task**), the board (column tabs + swipe pager + floating **New task** button), **Couldn’t load this board** with **Try again**, and **Board not found** with **Go to boards**.
- **Create task:** a full-screen sheet with Title (required), Description, Assignee, Priority and Due date. The form scrolls; the **Create task** button stays at the bottom, above the keyboard. Assignee and Priority open a bottom sheet; Due date opens the native date picker. **Cancel** asks “Discard this task?” when something was entered.
- **Errors:** Title errors (“Title is required”) and the server’s assignee reason appear under their field, and the form scrolls to the first field with an error. Network and server failures appear at the top of the form and keep every value. A board that no longer exists closes the form and shows **Board not found**.

### What works against the real backend

The backend currently has only two GraphQL operations, `ping` and `createTask`, and no REST endpoints. It has **no way to read boards, columns, tasks or project members**. So, with the real backend:

- `createTask` is fully implemented (`src/api/tasks.ts`), including error mapping.
- Opening a board shows **Couldn’t load this board** with the reason “The server can’t send board data yet…”. The app never shows made-up data as if it came from the server.

When the backend adds board/task/member reads, only `src/data/backendBoardRepository.ts` (`getBoard`, `listBoards`) needs to change.

How errors are told apart (the backend sends `NOT_FOUND` for a missing board **and** a missing column, with no other field):

| Backend answer | Shown as |
| --- | --- |
| `NOT_FOUND` “Board '<this board's id>' was not found.” | **Board not found** screen |
| `NOT_FOUND` “Column '…' was not found on board '…'.” | Error at the top of the form (not “Board not found”) |
| `BAD_USER_INPUT` “User '<assignee id>' is not a member of project …” | The server's message under **Assignee** |
| `BAD_USER_INPUT` “Title cannot be empty…” | “Title is required” under **Title** |
| Other `BAD_USER_INPUT` (for example “This board has no columns…”) | The server's message at the top of the form |
| No response (offline, server down) | “We couldn’t reach the server…” at the top of the form |
| HTTP 5xx, or a GraphQL error without a known code | “Something went wrong on our side…” at the top of the form |

Telling the board and column apart depends on the backend's message text. If those messages change, `src/domain/createTaskErrors.ts` must change too.

## Demo Mode (Development Only)

Demo mode lets you try the board screen and the create-task form on a device while the backend can't send board data. It uses **sample data kept in memory on the device**: it is **not** the backend's seeded data, nothing is sent to the backend, and everything is lost when the app restarts. Screens show a yellow “Demo mode” banner.

Turn it on in `mobile/.env`, then restart Expo with a clean cache:

```bash
EXPO_PUBLIC_MOBILE_DEMO_MODE=true
```

```bash
npx expo start -c
```

It is on when the value is exactly `true`, and also whenever `EXPO_PUBLIC_API_URL` is empty (with no backend configured there is nothing else to load). Open **View boards** on the Home screen. The demo boards are:

| Board | What it simulates |
| --- | --- |
| Demo board | An empty board; tasks you create are added to it |
| Demo · board deleted while the form is open | `createTask` answers “Board '…' was not found.” |
| Demo · column missing on first submit | First `createTask` answers “Column '…' was not found on board '…'.”, then works |
| Demo · network failure on first submit | First `createTask` gets no response, then works |
| Demo · server failure on first submit | First `createTask` gets HTTP 500, then works |
| Demo · board fails to load once | The first load fails, **Try again** works |
| Demo · a board that doesn’t exist | Opening it shows **Board not found** |

On every demo board the assignee **Demo Removed Member** is rejected, as the backend rejects someone who isn't a project member. The simulated failures use the backend's own error codes and messages and go through the same error handling as real responses.

### Manual test on the Android emulator (demo mode)

1. Set `EXPO_PUBLIC_MOBILE_DEMO_MODE=true`, run `npx expo start -c` and press `a`.
2. Home → **View boards** → **Demo board**. Expect **No tasks yet**, “Tasks you add to this board show up here, grouped by status.”, and a **Create task** button.
3. Tap **Create task**, then **Create task** at the bottom with an empty title. Expect “Title is required” under Title, with the keyboard open and Title visible.
4. Type only spaces and submit: same error. Type a real title: the error disappears straight away.
5. Pick **Demo Removed Member** as assignee and submit. Expect “User '…' is not a member of project DEMO, so they can't be assigned to this task.” under Assignee, and the form scrolled to it. Pick another member: the error disappears.
6. Submit. The sheet closes, a “Task created” toast shows, **No tasks yet** disappears, the task card is in **Backlog**, and the header and tab show 1 task.
7. Open **Demo · network failure on first submit**, fill every field (title, description, assignee, priority, due date) and submit. Expect “Couldn’t create the task” at the top and every value still there. Submit again: it works.
8. Repeat with **Demo · server failure on first submit** (expect “Something went wrong on our side…”).
9. **Demo · column missing on first submit**: the error is at the top of the form; it does **not** say “Board not found”.
10. **Demo · board deleted while the form is open**: submit → **Board not found** → **Go to boards** returns to the list.
11. **Demo · a board that doesn’t exist** → **Board not found**. **Demo · board fails to load once** → **Couldn’t load this board** → **Try again** → empty board.
12. Keyboard: with the keyboard open, the **Create task** button stays above it, and the field with an error isn't hidden behind it. Check this on Android and, if available, iOS; Jest can't check native keyboard layout.

### Scenarios that need the real backend

These can't be checked until the backend can send board, task and member data: the seeded **Test Board** showing empty and then the created task; picking real project members; the server rejecting a member removed from the project in the database; and a board deleted in the database showing **Board not found**. Note that `Board` uses soft delete and `createTask` does not currently filter out soft-deleted boards, so a soft-deleted board may still accept new tasks. Only a board row that is really gone returns `NOT_FOUND`. Use a local development database only, never shared data, and don't change the seed.

## Checks

The following checks use dependencies installed in the project:

```bash
npm run lint
npm run typecheck
npm test -- --runInBand
```

The tests use a mocked GraphQL backend and the in-memory demo data. They need no running backend, database or emulator.

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

Work on the feature branch:

```text
feature/mobile-app-skeleton
```

After testing the application and reviewing the changes:

1. Stage only the intended mobile source, configuration, assets, lockfile, and README files.
2. Commit the changes.
3. Push the feature branch.
4. Open a pull request targeting `main`.
5. Request at least one approval.

Do not merge directly into `main`. The task is complete only after the pull request has received the required approval and has been merged.
