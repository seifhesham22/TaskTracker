# Frontend

Web frontend for TaskTracker, built with **React**, **TypeScript** and **Vite**.

## Requirements

- [Node.js](https://nodejs.org/) 22 or newer (includes npm)
- The backend running locally if you want the Home page to show "Online". From the repo root, run `docker compose up --build` (see the [root README](../README.md))

## Install

```bash
cd frontend
npm install
```

## Configure

The backend address is read from the `VITE_API_URL` environment variable and is not hardcoded anywhere in the code.

```bash
# macOS / Linux
cp .env.example .env
# Windows (PowerShell)
Copy-Item .env.example .env
```

The default value is `http://localhost:8080`, the API from Docker Compose. Restart the dev server after you change `.env`.

## Run

```bash
npm run dev
```

Open http://localhost:5173. The **Backend connection** card on the Home page shows whether the API is reachable.

## Build

```bash
npm run build     # type-checks, then writes the production bundle to dist/
npm run preview   # serves dist/ at http://localhost:4173
```

## Other scripts

| Script | What it does |
|---|---|
| `npm run lint` | Runs ESLint |
| `npm run typecheck` | Runs the TypeScript compiler without building |

## Project structure

```text
src/
  api/           API layer, the only code that talks to the backend
    HttpClient.ts    HttpClient interface + FetchHttpClient (JSON over fetch)
    errors.ts        ApiError, ApiConfigurationError
    services/        one class per backend area (SystemService, ...)
    index.ts         composition root: `api.system`, ...
  app/           App root, route table, navigation items
  components/    reusable UI components (each with its own .css)
  config/        AppConfig, which reads VITE_* environment variables
  hooks/         React hooks that wrap API calls
  layouts/       shared page shell (header, nav, footer)
  pages/         one component per route (Home, Tasks, About, 404)
  styles/        design tokens and global styles
```

### Adding a backend call

1. Create or extend a service in `src/api/services/` that takes an `HttpClient` in its constructor.
2. Register it in `src/api/index.ts`.
3. Use it from a hook or a page through `api.<service>`. Pages never call `fetch` directly.

### Adding a page

1. Create the component in `src/pages/`.
2. Add a route in `src/app/routes.tsx`.
3. If it belongs in the header, add it to `src/app/navigation.ts`.

Unknown URLs fall back to the 404 page.
