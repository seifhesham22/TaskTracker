# GraphQL API

The endpoint is `/graphql` (for example http://localhost:8080/graphql with Docker). Open it in a browser to get the Nitro playground, where you can run every example on these pages.

## Operations

| Operation | Kind | What it does |
| --- | --- | --- |
| [`tasks`](queries/tasks.md) | query | The tasks of a board (or all tasks), in the order they were created |
| [`projects`](queries/projects.md) | query | The projects a user is a member of, with their boards and members |
| [`board`](queries/board.md) | query | One board with its columns |
| [`createTask`](mutations/createTask.md) | mutation | Creates a task, or a subtask, in a column of a board |
| [`moveTask`](mutations/moveTask.md) | mutation | Moves a task to another column, which changes its status |
| [`register`](mutations/register.md) | mutation | Creates a user account from an email and a password |

Every type these operations return is described once in [types.md](types.md).

## How the schema fits together

Queries are the entry points. From what they return, a request follows fields to related data:

```
projects(userId) ──► Project ──► boards ──► Board ──► columns ──► Column
board(id) ────────────────────────────────► Board ──► columns ──► Column
tasks(boardId) ──► Task ──► column, status, assignees
```

The `Board` reached through `projects { boards }` and the one from `board(id)` is the same type, so its fields work the same either way.

Related fields (`Task.column`, `Task.assignees`, `Project.boards`, `Board.columns`, …) are loaded with DataLoaders: one SQL query for all the items in the response, and only when the request asks for that field.

## Errors

Errors come back in the GraphQL `errors` list, with a code in `extensions.code`. When a request fails, `data` is `null` (or the failed field is `null`).

| Code | Meaning |
| --- | --- |
| `NOT_FOUND` | Something the request points to doesn't exist, for example a board id or a column that isn't on the task's board |
| `BAD_USER_INPUT` | The request is understood but breaks a rule, for example an empty title |
| (none) | The schema refused the request before it ran, for example a required field is missing. The message says which |

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

Each operation page lists the cases and messages for that operation.

## Not there yet

There is no login yet. Where an operation needs a user, like [`projects`](queries/projects.md), the user's id is passed as an argument for now.
