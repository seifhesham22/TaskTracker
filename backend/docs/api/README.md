# GraphQL API

The endpoint is `/graphql` (for example http://localhost:8080/graphql with Docker). Open it in a browser to get the Nitro playground, where you can run every example on these pages.

## Operations

| Operation | Kind | Needs a token | What it does |
| --- | --- | --- | --- |
| [`register`](mutations/register.md) | mutation | no | Creates a user account from an email and a password |
| [`login`](mutations/login.md) | mutation | no | Checks an email and password and returns an access token |
| [`me`](queries/me.md) | query | yes | The user the token belongs to |
| [`tasks`](queries/tasks.md) | query | yes | The tasks of a board (or all tasks), in the order they were created |
| [`projects`](queries/projects.md) | query | yes | The projects a user is a member of, with their boards and members |
| [`board`](queries/board.md) | query | yes | One board with its columns |
| [`createTask`](mutations/createTask.md) | mutation | yes | Creates a task, or a subtask, in a column of a board |
| [`moveTask`](mutations/moveTask.md) | mutation | yes | Moves a task to another column, which changes its status |

Every type these operations return is described once in [types.md](types.md).

## Authentication

1. Call [`login`](mutations/login.md) with an email and password. It returns an `accessToken` (a JWT).
2. Send that token with every other request, in the `Authorization` header:

   ```
   Authorization: Bearer <accessToken>
   ```

   In Nitro, add it under the request's **Headers**.
3. The token expires after 60 minutes (`expiresAt` in the login response). After that, log in again.

The token carries the user's id in its `sub` claim and the email in `email`. On the server, a resolver can take a `ClaimsPrincipal` parameter and call `GetUserId()` on it (from `TaskTracker.API.Shared.Auth`).

A request without a valid token to an operation that needs one gets `AUTH_NOT_AUTHENTICATED`. That includes a missing token, an expired one, and one signed with a different key.

## How the schema fits together

Queries are the entry points. From what they return, a request follows fields to related data:

```
me ──► User
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
| `INVALID_CREDENTIALS` | `login` got a wrong email or password. The message is always the same, so it never says which one was wrong |
| `AUTH_NOT_AUTHENTICATED` | The operation needs a token, and the request has none or an invalid one |
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

[`projects`](queries/projects.md) still takes the user's id as an argument. It can switch to the user from the token, like [`me`](queries/me.md).
