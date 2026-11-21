# createBoard

Adds a board to an existing project. The board gets the default columns Backlog, To do, In progress and Done, and goes after the project's other boards. The board, its columns and its place are saved together: either all of them or none.

The response is the saved [`Board`](../types.md#board) with its columns, so the frontend can open it right away (its `id` is what [`board`](../queries/board.md) and [`tasks`](../queries/tasks.md) take).

**Needs a token**: send `Authorization: Bearer <accessToken>` (see [Authentication](../README.md#authentication)).

**Owner only**: the user in the token must be the `OWNER` of the project. A `WRITER` or `READER` gets `AUTH_NOT_AUTHORIZED`. For anyone who isn't a member, the project doesn't seem to exist (`NOT_FOUND`). See [Project access](../README.md#project-access).

The frontend can show the "Create board" button only when the project's `role` is `OWNER` (from [`projects`](../queries/projects.md)). The API refuses everyone else anyway.

[Back to the API index](../README.md)

## Input

| Field       | Type      | Required | Notes |
| ----------- | --------- | -------- | ----- |
| `projectId` | `UUID!`   | yes      | |
| `name`      | `String!` | yes      | Spaces around it are removed. 1 to 100 characters. Must not be the name of another board in the project, in any case (`Sprint 2` and `sprint 2` are the same). A deleted board's name can be used again |

## Returns

The new [`Board`](../types.md#board).

## Example

```graphql
mutation {
  createBoard(input: { projectId: "01a182a9-9195-783d-baa3-8ffde80a5072", name: "Sprint 2" }) {
    id
    projectId
    name
    columns {
      id
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
    "createBoard": {
      "id": "01a20a14-6c2d-7e8f-9a01-b2c3d4e5f607",
      "projectId": "01a182a9-9195-783d-baa3-8ffde80a5072",
      "name": "Sprint 2",
      "columns": [
        { "id": "01a20a14-6c2e-7a10-8b21-c3d4e5f60718", "name": "Backlog", "category": "BACKLOG" },
        { "id": "01a20a14-6c2e-7a11-8c32-d4e5f6071829", "name": "To do", "category": "TO_DO" },
        { "id": "01a20a14-6c2e-7a12-8d43-e5f60718293a", "name": "In progress", "category": "IN_PROGRESS" },
        { "id": "01a20a14-6c2e-7a13-8e54-f60718293a4b", "name": "Done", "category": "DONE" }
      ]
    }
  }
}
```

## Errors

| Case | `extensions.code` | Message |
| ---- | ----------------- | ------- |
| `name` is empty or only spaces | `BAD_USER_INPUT` | Board name cannot be empty or only spaces. |
| `name` is longer than 100 characters | `BAD_USER_INPUT` | Board name cannot be longer than 100 characters. |
| The project already has a board with that name | `BAD_USER_INPUT` | A board named 'Sprint 2' already exists in this project. |
| The project doesn't exist, or the user isn't a member of it | `NOT_FOUND` | Project '…' was not found. |
| The user is a `WRITER` or `READER` | `AUTH_NOT_AUTHORIZED` | Only the owner of the project can create boards. |
| `name` or `projectId` is missing | (none) | Refused by the schema: the field is required |
| No token, or an expired or invalid token | `AUTH_NOT_AUTHENTICATED` | The current user is not authorized to access this resource. |

## Notes

- If the project changes while the request is running, the request is checked again against the new data before it saves. So two requests at the same moment can't create two boards with the same name: the second one answers "already exists".
- Every new project already gets one board, called `Board`, from [`createProject`](createProject.md).
