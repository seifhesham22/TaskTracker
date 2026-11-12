# Backend

ASP.NET Core (.NET 10) API for TaskTracker, using PostgreSQL and EF Core.

## Run

The easiest way is Docker, from the repo root (see the [root README](../README.md)):

```bash
docker compose up --build
```

With Docker, everything works without any setup, including the key that signs login tokens. To use your own values, copy `.env.example` to `.env` in the repo root and change them.

Without Docker, set your local PostgreSQL connection string and a token signing key (at least 32 characters) once, then run the API:

```bash
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=tasktracker;Username=postgres;Password=<your-password>" --project backend/TaskTracker.API
dotnet user-secrets set "Jwt:Key" "local-development-jwt-signing-key-change-me-0123456789" --project backend/TaskTracker.API
dotnet run --project backend/TaskTracker.API
```

The API refuses to start without a `Jwt:Key`, so a missing key shows up right away instead of as failed logins. On a real server, set it as the `Jwt__Key` environment variable, with a long random value that is never committed.

## Migrations

Migrations are applied automatically when the API starts in Development. To apply or roll them back by hand:

| Action                                 | Package Manager Console                  | CLI (`dotnet tool install --global dotnet-ef`)                                       |
| -------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------ |
| Apply all migrations                   | `Update-Database`                        | `dotnet ef database update --project backend/TaskTracker.API`                        |
| Roll back to before the project tables | `Update-Database 20261024103535_Initial` | `dotnet ef database update 20261024103535_Initial --project backend/TaskTracker.API` |

Starting the API applies the migrations again, so check a rollback **before** you start the API.

## Seed data

The seed runs automatically on API startup in **Development only**, right after the migrations. It is safe to run again: anything that already exists is skipped, so nothing is duplicated.

It creates:

- Roles `Admin` and `Member`
- Five users, all with password `Dev@123456`:
  - `admin@local.test` (Admin)
  - `user1@local.test`, `user2@local.test`, `user3@local.test`, `user4@local.test` (Member)
- One project, **Test Project** (key `TES`), with all five users as members
- One board, **Test Board**, in that project, with four columns: Backlog, To do, In progress, Done

**To run the seed:** start the API in Development (`docker compose up --build`, `dotnet run`, or F5 in Visual Studio).

**To start from an empty database:** with Docker, run `docker compose down -v`, then `docker compose up --build`.

**To check the result** (Docker database: `localhost:5433`, user / password `tasktracker`):

```sql
SELECT COUNT(*) FROM projects;         -- 1
SELECT COUNT(*) FROM project_members;  -- 5
SELECT COUNT(*) FROM boards;           -- 1
SELECT COUNT(*) FROM board_columns;    -- 4
```

## GraphQL API

The endpoint is `/graphql` (for example http://localhost:8080/graphql with Docker). Open it in a browser to get the Nitro playground.

Every query and mutation has its own page in [docs/api](docs/api/README.md):

| Operation | Kind | What it does |
| --- | --- | --- |
| [`tasks`](docs/api/queries/tasks.md) | query | The tasks of a board (or all tasks), in the order they were created |
| [`projects`](docs/api/queries/projects.md) | query | The projects a user is a member of, with their boards and members |
| [`board`](docs/api/queries/board.md) | query | One board with its columns |
| [`createTask`](docs/api/mutations/createTask.md) | mutation | Creates a task, or a subtask, in a column of a board |
| [`moveTask`](docs/api/mutations/moveTask.md) | mutation | Moves a task to another column, which changes its status |
| [`register`](docs/api/mutations/register.md) | mutation | Creates a user account from an email and a password |
| [`login`](docs/api/mutations/login.md) | mutation | Checks an email and password and returns an access token |
| [`me`](docs/api/queries/me.md) | query | The user the access token belongs to |

Everything except `register` and `login` needs the token from `login`; see [Authentication](docs/api/README.md#authentication).

The types are described in [docs/api/types.md](docs/api/types.md), and how errors work in [docs/api/README.md](docs/api/README.md#errors).
