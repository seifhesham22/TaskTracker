# tasks

Returns tasks in the order they were created (`TES-1`, `TES-2`, …). Give a `boardId` for the tasks of one board, or leave it out for all tasks. A board with no tasks returns an empty list.

[Back to the API index](../README.md)

## Arguments

| Argument  | Type   | Required | Notes |
| --------- | ------ | -------- | ----- |
| `boardId` | `UUID` | no       | Only the tasks of this board |

## Returns

A list of [`Task`](../types.md#task).

## Example

```graphql
query {
  tasks(boardId: "01a18766-48b5-7fb8-a04c-13e1bf648def") {
    readableId
    title
    description
    priority
    dueDate
    status
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

## Response

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
        "status": "BACKLOG",
        "column": { "name": "Backlog", "category": "BACKLOG" },
        "assignees": []
      },
      {
        "readableId": "TES-2",
        "title": "Full task",
        "description": "Some details",
        "priority": "HIGH",
        "dueDate": "2026-11-05T00:00:00Z",
        "status": "BACKLOG",
        "column": { "name": "Backlog", "category": "BACKLOG" },
        "assignees": [{ "id": "01a18766-479c-7ec2-be3f-3c3a00989ad6", "userName": "user1@local.test" }]
      }
    ]
  }
}
```

## Errors

| Case                 | `extensions.code` | Message |
| -------------------- | ----------------- | ------- |
| Board does not exist | `NOT_FOUND`       | Board '…' was not found. |

## Notes

- Get a board id with `SELECT "Id" FROM boards;`.
- `status`, `column` and `assignees` are loaded with DataLoaders: one SQL query each for all the tasks in the response, and only when the query asks for them.
