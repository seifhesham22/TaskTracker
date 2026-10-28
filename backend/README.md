# Backend

ASP.NET Core (.NET 10) API for TaskTracker, using PostgreSQL and EF Core.

## Run

The easiest way is Docker, from the repo root (see the [root README](../README.md)):

```bash
docker compose up --build
```

Without Docker, set your local PostgreSQL connection string once, then run the API:

```bash
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=tasktracker;Username=postgres;Password=<your-password>" --project backend/TaskTracker.API
dotnet run --project backend/TaskTracker.API
```

## Migrations

Migrations are applied automatically when the API starts in Development. To apply or roll them back by hand:

| Action | Package Manager Console | CLI (`dotnet tool install --global dotnet-ef`) |
|---|---|---|
| Apply all migrations | `Update-Database` | `dotnet ef database update --project backend/TaskTracker.API` |
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
- One board, **Test Board**, in that project

**To run the seed:** start the API in Development (`docker compose up --build`, `dotnet run`, or F5 in Visual Studio).

**To start from an empty database:** with Docker, run `docker compose down -v`, then `docker compose up --build`.

**To check the result** (Docker database: `localhost:5433`, user / password `tasktracker`):

```sql
SELECT COUNT(*) FROM projects;         -- 1
SELECT COUNT(*) FROM project_members;  -- 5
SELECT COUNT(*) FROM boards;           -- 1
```
