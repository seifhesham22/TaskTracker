# GraphQL API

The endpoint is `/graphql` (for example http://localhost:8080/graphql with Docker). Open it in a browser to get the Nitro playground, where you can run every example on these pages.

## Operations

| Operation | Kind | Needs a token | What it does |
| --- | --- | --- | --- |
| [`register`](mutations/register.md) | mutation | no | Creates a user account from an email and a password |
| [`login`](mutations/login.md) | mutation | no | Checks an email and password and returns an access token |
| [`logout`](mutations/logout.md) | mutation | yes | Ends the current session, so its token stops working |
| [`me`](queries/me.md) | query | yes | The user the token belongs to |
| [`tasks`](queries/tasks.md) | query | yes | The tasks of a board (or all tasks), in the order they were created |
| [`backlog`](queries/backlog.md) | query | yes | All tasks of a project as one ordered list, in pages, with search and filters |
| [`projects`](queries/projects.md) | query | yes | The projects of the logged-in user, with their boards and members |
| [`createProject`](mutations/createProject.md) | mutation | yes | Creates a project with a default board; the logged-in user becomes its owner |
| [`createBoard`](mutations/createBoard.md) | mutation | yes | Adds a board with the default columns to a project; owner only |
| [`addProjectMember`](mutations/addProjectMember.md) | mutation | yes | Adds an existing account to a project by email, as a reader or writer |
| [`removeProjectMember`](mutations/removeProjectMember.md) | mutation | yes | Removes a reader or writer from a project; the owner can't be removed |
| [`board`](queries/board.md) | query | yes | One board with its columns |
| [`createTask`](mutations/createTask.md) | mutation | yes | Creates a task, or a subtask, in a column of a board |
| [`moveTask`](mutations/moveTask.md) | mutation | yes | Moves a task to another column, which changes its status |
| [`rankTask`](mutations/rankTask.md) | mutation | yes | Changes the place of a task in the project's backlog order |
| [`updateTask`](mutations/updateTask.md) | mutation | yes | Changes a task's title, description, priority and dates |
| [`addTaskDependency`](mutations/addTaskDependency.md) | mutation | yes | Says that one task blocks another in the same project, refusing cycles |
| [`assignTask`](mutations/assignTask.md) | mutation | yes | Adds a project member to a task's assignees; a task can have several |
| [`unassignTask`](mutations/unassignTask.md) | mutation | yes | Removes one assignee from a task; the others stay |

Every type these operations return is described once in [types.md](types.md).

## Authentication

1. Call [`login`](mutations/login.md) with an email and password. It returns an `accessToken` (a JWT).
2. Send that token with every other request, in the `Authorization` header:

   ```
   Authorization: Bearer <accessToken>
   ```

   In Nitro, add it under the request's **Headers**.
3. The token expires after 60 minutes (`expiresAt` in the login response). After that, log in again.
4. To log out, call [`logout`](mutations/logout.md) with the token. It stops working at once; other sessions are not affected.

The token carries the user's id in its `sub` claim and the email in `email`. On the server, a resolver can take a `ClaimsPrincipal` parameter and call `GetUserId()` on it (from `TaskTracker.API.Shared.Auth`).

A request without a valid token to an operation that needs one gets `AUTH_NOT_AUTHENTICATED`. That includes a missing token, an expired one, a logged-out one, and one signed with a different key.

## Project access

Everything about a project, its boards and its tasks is for the project's members only. The user is always the one in the token.

| Kind | Operations | Who can | Everyone else |
| --- | --- | --- | --- |
| Read | [`projects`](queries/projects.md), [`board`](queries/board.md), [`tasks`](queries/tasks.md), [`backlog`](queries/backlog.md) | Any member: `READER`, `WRITER` or `OWNER` | `NOT_FOUND` |
| Write | [`createTask`](mutations/createTask.md), [`moveTask`](mutations/moveTask.md), [`updateTask`](mutations/updateTask.md), [`addTaskDependency`](mutations/addTaskDependency.md), [`assignTask`](mutations/assignTask.md), [`unassignTask`](mutations/unassignTask.md), [`rankTask`](mutations/rankTask.md), [`addProjectMember`](mutations/addProjectMember.md), [`removeProjectMember`](mutations/removeProjectMember.md) | `WRITER`s and the `OWNER` | A `READER` gets `AUTH_NOT_AUTHORIZED`, a non-member `NOT_FOUND` |
| Owner only | [`createBoard`](mutations/createBoard.md) | The `OWNER` | A `WRITER` or `READER` gets `AUTH_NOT_AUTHORIZED`, a non-member `NOT_FOUND` |

- A non-member gets exactly the same `NOT_FOUND` as for an id that doesn't exist, so nobody can find out which projects, boards or tasks exist by trying ids.
- Fields inside a result (`Project.boards`, `Board.columns`, `Task.assignees`, `Task.blocks`, …) always belong to the same project, so the check on the operation covers them.
- A removed member loses access with their next request.
- [`createProject`](mutations/createProject.md) is open to every logged-in user, who becomes the owner. [`me`](queries/me.md), [`register`](mutations/register.md), [`login`](mutations/login.md) and [`logout`](mutations/logout.md) aren't about projects.

## How the schema fits together

Queries are the entry points. From what they return, a request follows fields to related data:

```
me ──► User
projects ─────────► Project ──► boards ──► Board ──► columns ──► Column
board(id) ────────────────────────────────► Board ──► columns ──► Column
tasks(boardId) ──► Task ──► column, status, assignees, blocks, blockedBy
backlog(projectId, search, where, page, pageSize) ──► BacklogPage ──► items ──► Task
```

The `Board` reached through `projects { boards }` and the one from `board(id)` is the same type, so its fields work the same either way.

Related fields (`Task.column`, `Task.assignees`, `Task.blocks`, `Task.blockedBy`, `Project.boards`, `Board.columns`, …) are loaded with DataLoaders: one SQL query for all the items in the response, and only when the request asks for that field.

## Errors

Errors come back in the GraphQL `errors` list, with a code in `extensions.code`. When a request fails, `data` is `null` (or the failed field is `null`).

| Code | Meaning |
| --- | --- |
| `NOT_FOUND` | Something the request points to doesn't exist, or belongs to a project the user isn't a member of. For example a board id, or a column that isn't on the task's board |
| `BAD_USER_INPUT` | The request is understood but breaks a rule, for example an empty title |
| `INVALID_CREDENTIALS` | `login` got a wrong email or password. The message is always the same, so it never says which one was wrong |
| `AUTH_NOT_AUTHENTICATED` | The operation needs a token, and the request has none or an invalid one |
| `AUTH_NOT_AUTHORIZED` | The user is a member of the project, but their role isn't allowed to do this, for example a `READER` creating a task. Also: `projects` with someone else's `userId` |
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
