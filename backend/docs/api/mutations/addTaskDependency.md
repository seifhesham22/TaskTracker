# addTaskDependency

Says that one task blocks another: the blocked task can't be done before the blocking one. In planning words, the blocking task is the **predecessor** and the blocked task is the **dependent**.

Both tasks then show the link: the blocking task lists the other in [`blocks`](../types.md#task), and the blocked task lists the first in [`blockedBy`](../types.md#task). The response returns both tasks, so the frontend can update them at once.

**Needs a token**: send `Authorization: Bearer <accessToken>` (see [Authentication](../README.md#authentication)).

**Members only**: the user in the token must be a `WRITER` or `OWNER` of the tasks' project. For a user who isn't a member, the tasks don't seem to exist (`NOT_FOUND`). A `READER` gets `AUTH_NOT_AUTHORIZED`.

[Back to the API index](../README.md)

## Rules

- Both tasks must be in the **same project** (they can be on different boards of it).
- A task can't block **itself**.
- **No cycles.** If TES-1 blocks TES-2 and TES-2 blocks TES-3, then TES-3 can't block TES-1, and TES-2 can't block TES-1. That would mean every task waits for another one forever. The check follows the existing links through any number of tasks. A refused dependency is not saved, and the existing ones don't change.
- Adding a dependency that already exists changes nothing and returns the tasks as they are.

## Input

| Field            | Type    | Required | Notes |
| ---------------- | ------- | -------- | ----- |
| `blockingTaskId` | `UUID!` | yes      | The task that must be done first |
| `blockedTaskId`  | `UUID!` | yes      | The task that waits for it |

## Returns

A [`TaskDependencyPayload`](../types.md#taskdependencypayload): `blockingTask` and `blockedTask`, both [`Task`](../types.md#task).

## Example

```graphql
mutation {
  addTaskDependency(
    input: {
      blockingTaskId: "01a18766-8315-7c9c-90fd-5657de973481"
      blockedTaskId: "01a18766-9a20-7d11-8c3e-6f7a8b9c0d12"
    }
  ) {
    blockingTask {
      readableId
      blocks { readableId title }
    }
    blockedTask {
      readableId
      blockedBy { readableId title }
    }
  }
}
```

## Response

```json
{
  "data": {
    "addTaskDependency": {
      "blockingTask": {
        "readableId": "TES-1",
        "blocks": [{ "readableId": "TES-2", "title": "Write the login page" }]
      },
      "blockedTask": {
        "readableId": "TES-2",
        "blockedBy": [{ "readableId": "TES-1", "title": "Build the login API" }]
      }
    }
  }
}
```

## Errors

| Case | `extensions.code` | Message |
| ---- | ----------------- | ------- |
| A task doesn't exist, was deleted, or is in a project the user isn't a member of | `NOT_FOUND` | Task '…' was not found. |
| Both ids are the same task | `BAD_USER_INPUT` | A task can't block itself. |
| The tasks are in different projects | `BAD_USER_INPUT` | TES-1 and ABC-3 are in different projects. A task can only block a task of the same project. |
| The new link would close a cycle | `BAD_USER_INPUT` | TES-3 can't block TES-1: TES-1 already blocks TES-3 (TES-1 → TES-2 → TES-3), so this would create a cycle. |
| The user is a `READER` of the project | `AUTH_NOT_AUTHORIZED` | Only writers and owners of the project can add dependencies. |
| No token, or an expired or invalid token | `AUTH_NOT_AUTHENTICATED` | The current user is not authorized to access this resource. |

In the cycle message, `→` means "blocks", and the chain is the existing path that the new link would close.

## Notes

- The blocked task can't be started, that is moved to `IN_PROGRESS` or `DONE` with [`moveTask`](moveTask.md), until every task that blocks it is done.
- Read the dependencies back with `blocks` and `blockedBy` on any [`Task`](../types.md#task), for example in [`tasks`](../queries/tasks.md) or [`backlog`](../queries/backlog.md):

  ```graphql
  query {
    tasks {
      readableId
      blocks { readableId }
      blockedBy { readableId }
    }
  }
  ```

- Two requests that would close a cycle together, sent at the same moment, can't both succeed. If the project changes while a request is running, the request is checked again against the new data before it saves, and then finds the cycle.
- There is no mutation to remove a dependency yet.
