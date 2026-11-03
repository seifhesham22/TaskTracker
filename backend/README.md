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

### createTask

Creates a task in a column of a board. The task's status is the category of that column (a column "In review" with category `IN_PROGRESS` gives the task status `IN_PROGRESS`). Without a `columnId`, the task goes into the board's first column. The database gives the task the next number in its project.

**Input**

| Field         | Type           | Required | Notes                                                     |
| ------------- | -------------- | -------- | --------------------------------------------------------- |
| `boardId`     | `UUID`         | yes      | Must be an existing board                                 |
| `columnId`    | `UUID`         | no       | A column of that board. Default: the board's first column |
| `title`       | `String`       | yes      | Not empty or only spaces, max 200 characters              |
| `description` | `String`       | no       |                                                           |
| `assigneeId`  | `UUID`         | no       | Must be a member of the board's project                   |
| `priority`    | `TaskPriority` | no       | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`                       |
| `dueDate`     | `DateTime`     | no       | ISO 8601, e.g. `2026-11-05T00:00:00Z`                     |

**Example**

```graphql
mutation {
  createTask(
    input: {
      boardId: "01a18766-48b5-7fb8-a04c-13e1bf648def"
      title: "Full task"
      description: "Some details"
      assigneeId: "01a18766-479c-7ec2-be3f-3c3a00989ad6"
      priority: HIGH
      dueDate: "2026-11-05T00:00:00Z"
    }
  ) {
    id
    readableId
    status
    columnName
    title
    description
    priority
    assigneeIds
    dueDate
  }
}
```

**Response**

```json
{
  "data": {
    "createTask": {
      "id": "01a18766-8315-7c9c-90fd-5657de973481",
      "readableId": "TES-2",
      "status": "BACKLOG",
      "columnName": "Backlog",
      "title": "Full task",
      "description": "Some details",
      "priority": "HIGH",
      "assigneeIds": ["01a18766-479c-7ec2-be3f-3c3a00989ad6"],
      "dueDate": "2026-11-05T00:00:00Z"
    }
  }
}
```

**Errors** come back in the GraphQL `errors` list:

| Case                                              | `extensions.code` | Message                                                                          |
| ------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------- |
| Title is empty or only spaces                     | `BAD_USER_INPUT`  | Title cannot be empty or only spaces.                                            |
| Assignee is not in the project                    | `BAD_USER_INPUT`  | User '…' is not a member of project TES, so they can't be assigned to this task. |
| Board does not exist                              | `NOT_FOUND`       | Board '…' was not found.                                                         |
| Column is not on that board                       | `NOT_FOUND`       | Column '…' was not found on board '…'.                                           |
| Board has no columns (and no `columnId` was sent) | `BAD_USER_INPUT`  | This board has no columns, so the task can't get a status.                       |
| Title missing completely                          | (none)            | Refused by the schema: `title` is a required field and cannot be null.           |

```json
{
  "errors": [
    {
      "message": "Board '00000000-0000-0000-0000-000000000001' was not found.",
      "extensions": { "code": "NOT_FOUND" }
    }
  ],
  "data": null
}
```

### tasks

Returns tasks in the order they were created (`TES-1`, `TES-2`, …). Give a `boardId` for the tasks of one board, or leave it out for all tasks. A board with no tasks returns an empty list.

**Arguments**

| Argument  | Type   | Required | Notes                        |
| --------- | ------ | -------- | ---------------------------- |
| `boardId` | `UUID` | no       | Only the tasks of this board |

**Fields of `Task`**

| Field         | Type             | Notes                                                                     |
| ------------- | ---------------- | ------------------------------------------------------------------------- |
| `id`          | `UUID!`          |                                                                           |
| `number`      | `Int!`           | Number of the task in its project                                         |
| `readableId`  | `String!`        | Project key and number, e.g. `TES-1`                                      |
| `title`       | `String!`        |                                                                           |
| `description` | `String`         | `null` when not set                                                       |
| `priority`    | `TaskPriority`   | `null` when not set                                                       |
| `startDate`   | `DateTime`       | `null` when not set                                                       |
| `dueDate`     | `DateTime`       | `null` when not set                                                       |
| `boardId`     | `UUID!`          |                                                                           |
| `columnId`    | `UUID!`          |                                                                           |
| `position`    | `String!`        | Order of the task inside its column                                       |
| `column`      | `Column!`        | `id`, `name`, `position`, `category`. The task's status is `column.category` |
| `assignees`   | `[Assignee!]!`   | `id`, `userName`. An empty list when nobody is assigned                   |

`column` and `assignees` are loaded with DataLoaders: one SQL query for all the tasks in the response, and only when the query asks for them.

**Example**

```graphql
query {
  tasks(boardId: "01a18766-48b5-7fb8-a04c-13e1bf648def") {
    readableId
    title
    description
    priority
    dueDate
    column {
      name
      category
    }
    assignees {
      id
      userName
    }
  }
}
```

**Response**

```json
{
  "data": {
    "tasks": [
      {
        "readableId": "TES-1",
        "title": "Title only",
        "description": null,
        "priority": null,
        "dueDate": null,
        "column": { "name": "Backlog", "category": "BACKLOG" },
        "assignees": []
      },
      {
        "readableId": "TES-2",
        "title": "Full task",
        "description": "Some details",
        "priority": "HIGH",
        "dueDate": "2026-11-05T00:00:00Z",
        "column": { "name": "Backlog", "category": "BACKLOG" },
        "assignees": [{ "id": "01a18766-479c-7ec2-be3f-3c3a00989ad6", "userName": "user1@local.test" }]
      }
    ]
  }
}
```

**Errors** come back in the GraphQL `errors` list:

| Case                 | `extensions.code` | Message                  |
| -------------------- | ----------------- | ------------------------ |
| Board does not exist | `NOT_FOUND`       | Board '…' was not found. |

### projects

Returns the projects a user is a member of, sorted by name, each with the role that user has in it. Deleted projects never come back. A user who is in no project gets an empty list.

Temporary until login: the user's id is passed as an argument. Take one from the database with `SELECT "UserId" FROM project_members;`.

**Arguments**

| Argument | Type    | Required | Notes                           |
| -------- | ------- | -------- | ------------------------------- |
| `userId` | `UUID!` | yes      | The user whose projects you get |

**Fields of `Project`**

| Field            | Type               | Notes                                                       |
| ---------------- | ------------------ | ----------------------------------------------------------- |
| `id`             | `UUID!`            |                                                             |
| `key`            | `String!`          | e.g. `TES`                                                  |
| `name`           | `String!`          |                                                             |
| `description`    | `String`           | `null` when not set                                         |
| `role`           | `ProjectRole!`     | The user's role in this project: `READER`, `WRITER`, `OWNER` |
| `boards`         | `[Board!]!`        | `id`, `projectId`, `name`, `columns` (see [board](#board)), in board order. Deleted boards are left out. An empty list when the project has no boards |
| `projectMembers` | `[ProjectMember!]!` | `projectId`, `userId`, `userName`, `role`, `joinedAt`, sorted by user name |

`boards` and `projectMembers` are loaded with DataLoaders: one SQL query each for all the projects in the response, and only when the query asks for them. So the sidebar (every project with its boards) is one request.

**Example**

```graphql
query {
  projects(userId: "01a18766-479c-7ec2-be3f-3c3a00989ad6") {
    id
    key
    name
    role
    boards {
      id
      name
    }
    projectMembers {
      userName
      role
    }
  }
}
```

**Response**

```json
{
  "data": {
    "projects": [
      {
        "id": "01a18766-48a1-7b2e-9c3f-5d6e7f809a1b",
        "key": "TES",
        "name": "Test Project",
        "role": "OWNER",
        "boards": [{ "id": "01a18766-48b5-7fb8-a04c-13e1bf648def", "name": "Test Board" }],
        "projectMembers": [
          { "userName": "admin@local.test", "role": "OWNER" },
          { "userName": "user1@local.test", "role": "OWNER" },
          { "userName": "user2@local.test", "role": "OWNER" },
          { "userName": "user3@local.test", "role": "OWNER" },
          { "userName": "user4@local.test", "role": "OWNER" }
        ]
      }
    ]
  }
}
```

**Errors** come back in the GraphQL `errors` list:

| Case                | `extensions.code` | Message                 |
| ------------------- | ----------------- | ----------------------- |
| User does not exist | `NOT_FOUND`       | User '…' was not found. |

### board

Returns one board with its columns. This is what the board screen asks for when it opens, also from a link or after a refresh. The same `Board` type comes back from `projects { boards }`, so `columns` works there too.

**Arguments**

| Argument | Type    | Required | Notes        |
| -------- | ------- | -------- | ------------ |
| `id`     | `UUID!` | yes      | The board id |

**Fields of `Board`**

| Field       | Type         | Notes                                                                                     |
| ----------- | ------------ | ----------------------------------------------------------------------------------------- |
| `id`        | `UUID!`      |                                                                                           |
| `projectId` | `UUID!`      |                                                                                           |
| `name`      | `String!`    |                                                                                           |
| `columns`   | `[Column!]!` | `id`, `name`, `category` (the status), `position`, in board order. An empty list when the board has no columns |

`columns` is loaded with a DataLoader: one SQL query for all the boards in the response, and only when the query asks for it.

**Example**

```graphql
query {
  board(id: "01a18766-48b5-7fb8-a04c-13e1bf648def") {
    id
    name
    columns {
      id
      name
      category
      position
    }
  }
}
```

**Response**

```json
{
  "data": {
    "board": {
      "id": "01a18766-48b5-7fb8-a04c-13e1bf648def",
      "name": "Test Board",
      "columns": [
        { "id": "01a18766-48b6-7c11-9a2e-1f2a3b4c5d01", "name": "Backlog", "category": "BACKLOG", "position": "V" },
        { "id": "01a18766-48b6-7c11-9a2e-1f2a3b4c5d02", "name": "To do", "category": "TO_DO", "position": "l" },
        { "id": "01a18766-48b6-7c11-9a2e-1f2a3b4c5d03", "name": "In progress", "category": "IN_PROGRESS", "position": "t" },
        { "id": "01a18766-48b6-7c11-9a2e-1f2a3b4c5d04", "name": "Done", "category": "DONE", "position": "x" }
      ]
    }
  }
}
```

**Errors** come back in the GraphQL `errors` list:

| Case                                  | `extensions.code` | Message                  |
| ------------------------------------- | ----------------- | ------------------------ |
| Board does not exist, or was deleted  | `NOT_FOUND`       | Board '…' was not found. |
