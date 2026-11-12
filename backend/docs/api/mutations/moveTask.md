# moveTask

Moves a task to another column of its board. Because a task's status is the category of its column, this is how a task's status changes. The task goes to the bottom of the new column. Moving a task to the column it is already in changes nothing.

**Completing a parent task:** moving a task into a column of category `DONE` is refused while any of its subtasks is not in a `DONE` column. That includes a subtask in a `CANCELLED` column. The error lists every open subtask. Once they are all done, the parent can be completed. The check runs in the API, so no client can skip it.

The response is the same [`Task`](../types.md#task) type the [`tasks`](../queries/tasks.md) query returns, so a GraphQL client can update the task everywhere it is shown.

**Needs a token**: send `Authorization: Bearer <accessToken>` (see [Authentication](../README.md#authentication)).

[Back to the API index](../README.md)

## Input

| Field      | Type   | Required | Notes |
| ---------- | ------ | -------- | ----- |
| `taskId`   | `UUID` | yes      | Must be an existing task |
| `columnId` | `UUID` | yes      | Must be a column of the task's board |

## Returns

A [`Task`](../types.md#task).

## Example

```graphql
mutation {
  moveTask(
    input: {
      taskId: "01a18766-8315-7c9c-90fd-5657de973481"
      columnId: "01a18766-48b6-7c11-9a2e-1f2a3b4c5d03"
    }
  ) {
    id
    readableId
    status
    columnId
    column {
      name
      category
    }
  }
}
```

## Response

```json
{
  "data": {
    "moveTask": {
      "id": "01a18766-8315-7c9c-90fd-5657de973481",
      "readableId": "TES-2",
      "status": "IN_PROGRESS",
      "columnId": "01a18766-48b6-7c11-9a2e-1f2a3b4c5d03",
      "column": { "name": "In progress", "category": "IN_PROGRESS" }
    }
  }
}
```

## Errors

| Case                              | `extensions.code` | Message |
| --------------------------------- | ----------------- | ------- |
| Task does not exist               | `NOT_FOUND`       | Task '…' was not found. |
| Column is not on the task's board | `NOT_FOUND`       | Column '…' was not found on board '…'. |
| Moving a parent into a Done column while a subtask is not done | `BAD_USER_INPUT` | TES-5 can't be completed while these 2 subtasks are not done: TES-6 (Write tests), TES-7 (Review). |
| No token, or an expired or invalid token | `AUTH_NOT_AUTHENTICATED` | The current user is not authorized to access this resource. |

When the parent can't be completed yet, the error also lists the open subtasks in `extensions.incompleteSubtasks`, so the frontend can show or link them:

```json
{
  "errors": [
    {
      "message": "TES-5 can't be completed while these 2 subtasks are not done: TES-6 (Write tests), TES-7 (Review).",
      "path": ["moveTask"],
      "extensions": {
        "code": "BAD_USER_INPUT",
        "incompleteSubtasks": [
          { "id": "01a1d2c0-5e3b-7a41-9f02-6b7c8d9e0a11", "readableId": "TES-6", "title": "Write tests" },
          { "id": "01a1d2c0-6f4c-7b52-8e13-7c8d9e0f1a22", "readableId": "TES-7", "title": "Review" }
        ]
      }
    }
  ],
  "data": null
}
```

## Notes

- Get the columns of a board with the [`board`](../queries/board.md) query, or `SELECT "Id", "Name" FROM board_columns ORDER BY "Position";`.
