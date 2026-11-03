# board

Returns one board with its columns. This is what the board screen asks for when it opens, also from a link or after a refresh. The same [`Board`](../types.md#board) type comes back from `projects { boards }`, so `columns` works there too.

[Back to the API index](../README.md)

## Arguments

| Argument | Type    | Required | Notes |
| -------- | ------- | -------- | ----- |
| `id`     | `UUID!` | yes      | The board id |

## Returns

A [`Board`](../types.md#board).

## Example

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

## Response

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

## Errors

| Case                                 | `extensions.code` | Message |
| ------------------------------------ | ----------------- | ------- |
| Board does not exist, or was deleted | `NOT_FOUND`       | Board '…' was not found. |

## Notes

- Get a board id with `SELECT "Id" FROM boards;`.
- The board screen can send `board(id)` and [`tasks(boardId)`](tasks.md) in the same request.
- `columns` is loaded with a DataLoader: one SQL query for all the boards in the response, and only when the query asks for it.
