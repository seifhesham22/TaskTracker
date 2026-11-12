# moveTask

Moves a task to another column of its board. Because a task's status is the category of its column, this is how a task's status changes. The task goes to the bottom of the new column. Moving a task to the column it is already in changes nothing.

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
| No token, or an expired or invalid token | `AUTH_NOT_AUTHENTICATED` | The current user is not authorized to access this resource. |

## Notes

- Get the columns of a board with the [`board`](../queries/board.md) query, or `SELECT "Id", "Name" FROM board_columns ORDER BY "Position";`.
