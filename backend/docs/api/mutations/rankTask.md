# rankTask

Changes the place of a task in the project's [`backlog`](../queries/backlog.md): this is what a drag and drop in the backlog list sends. The new order is saved and every member of the project sees it.

The backlog order is the task's **rank**. It belongs to the backlog only: moving a task in the backlog doesn't change its status, its column or its place on the board. In the same way, moving a task on the board with [`moveTask`](moveTask.md) doesn't change its place in the backlog.

**Needs a token**: send `Authorization: Bearer <accessToken>` (see [Authentication](../README.md#authentication)).

**Writers and the owner only**: the user in the token must be a `WRITER` or the `OWNER` of the task's project. A `READER` gets `AUTH_NOT_AUTHORIZED`. For anyone who isn't a member, the task doesn't seem to exist (`NOT_FOUND`). See [Project access](../README.md#project-access).

[Back to the API index](../README.md)

## Input

| Field         | Type    | Required | Notes |
| ------------- | ------- | -------- | ----- |
| `taskId`      | `UUID!` | yes      | The task to move |
| `afterTaskId` | `UUID`  | no       | The task it should come right after. Left out or `null`: the task goes to the top of the backlog |

**Why "after a task" and not a position number:** the backlog has search, filters and pages, so "position 5" means something different on every screen. "After TES-7" always means the same place. To move a task to the bottom, send the last task of the backlog as `afterTaskId`.

## Returns

The moved [`Task`](../types.md#task).

## Example

Put TES-9 right after TES-2:

```graphql
mutation {
  rankTask(input: { taskId: "01a1c3d4-9e0f-7a1b-8c2d-3e4f5a6b7c8d", afterTaskId: "01a18766-8315-7c9c-90fd-5657de973481" }) {
    id
    readableId
  }
}
```

## Response

```json
{
  "data": {
    "rankTask": {
      "id": "01a1c3d4-9e0f-7a1b-8c2d-3e4f5a6b7c8d",
      "readableId": "TES-9"
    }
  }
}
```

Then read the new order with [`backlog`](../queries/backlog.md).

## Errors

| Case | `extensions.code` | Message |
| ---- | ----------------- | ------- |
| `afterTaskId` is the task itself | `BAD_USER_INPUT` | A task can't be placed after itself. |
| `afterTaskId` isn't a task of the same project | `NOT_FOUND` | Task '…' was not found in this project. |
| The task doesn't exist, was deleted, or the user isn't a member of its project | `NOT_FOUND` | Task '…' was not found. |
| The user is a `READER` | `AUTH_NOT_AUTHORIZED` | Only writers and owners of the project can change the backlog order. |
| `taskId` is missing | (none) | Refused by the schema: the field is required |
| No token, or an expired or invalid token | `AUTH_NOT_AUTHENTICATED` | The current user is not authorized to access this resource. |

## Notes

- Moving a task to the place it already has changes nothing, so the request is safe to repeat.
- Only the moved task gets a new rank; the others keep theirs. Very rarely, after a very large number of moves into the same spot, the whole backlog is renumbered in its current order. Nothing changes for the user.
- If the project changes while the request is running, the request is checked again against the new data before it saves, so two moves at the same moment are both applied in a consistent order.
- When sprints are added later, the same rank and the same mutation will order the tasks inside a sprint too.
