# createProject

Creates a project. The logged-in user becomes its `OWNER`, and the project gets one board, **Board**, with the default columns Backlog, To do, In progress and Done, so tasks can be added right away. The project, the owner and the board are saved together: either all of them are saved or none.

The new project then shows in the user's [`projects`](../queries/projects.md) list.

**Needs a token**: send `Authorization: Bearer <accessToken>` (see [Authentication](../README.md#authentication)). The owner is always the user in the token; the input has no user id.

[Back to the API index](../README.md)

## Input

| Field         | Type      | Required | Notes |
| ------------- | --------- | -------- | ----- |
| `name`        | `String!` | yes      | Spaces around it are removed. 1 to 100 characters. Two projects may have the same name |
| `key`         | `String`  | no       | 2 to 10 letters or digits (A-Z, 0-9), saved in capitals. Must not be used by another project. See [The key](#the-key) |
| `description` | `String`  | no       | At most 2000 characters. Spaces around it are removed; a blank one is saved as `null` |

## The key

The key starts every task's readable id: in project `WEB`, tasks are `WEB-1`, `WEB-2`, …

- **Sent:** it is used as it is, in capitals (`web` becomes `WEB`). If another project already has it, the request is refused.
- **Left out, `null` or blank:** it is made from the first 4 letters or digits of the name, in capitals. Spaces and symbols are skipped:

  | Name | Key |
  | ---- | --- |
  | Task Tracker | `TASK` |
  | my app | `MYAP` |
  | Web | `WEB` |
  | 2026 plan | `2026` |

  If that key is taken, a number is added: `TASK2`, then `TASK3`, … A name with fewer than 2 letters or digits (for example a name in Arabic letters) gets the key `PROJ` (or `PROJ2`, …).

Keys of deleted projects stay taken.

## Returns

The new [`Project`](../types.md#project), with `role: OWNER`.

## Example

```graphql
mutation {
  createProject(input: { name: "Task Tracker", description: "Our student project" }) {
    id
    key
    name
    description
    role
    boards {
      id
      name
      columns { id name category }
    }
    projectMembers { userName role }
  }
}
```

## Response

```json
{
  "data": {
    "createProject": {
      "id": "01a1f0a2-3b4c-7d5e-8f60-718293a4b5c6",
      "key": "TASK",
      "name": "Task Tracker",
      "description": "Our student project",
      "role": "OWNER",
      "boards": [
        {
          "id": "01a1f0a2-3b4d-7e6f-9a70-8293a4b5c6d7",
          "name": "Board",
          "columns": [
            { "id": "01a1f0a2-3b4d-7f70-8a81-93a4b5c6d7e8", "name": "Backlog", "category": "BACKLOG" },
            { "id": "01a1f0a2-3b4d-7f71-8b92-a4b5c6d7e8f9", "name": "To do", "category": "TO_DO" },
            { "id": "01a1f0a2-3b4d-7f72-8ca3-b5c6d7e8f90a", "name": "In progress", "category": "IN_PROGRESS" },
            { "id": "01a1f0a2-3b4d-7f73-8db4-c6d7e8f90a1b", "name": "Done", "category": "DONE" }
          ]
        }
      ],
      "projectMembers": [{ "userName": "user1@local.test", "role": "OWNER" }]
    }
  }
}
```

## Errors

| Case | `extensions.code` | Message |
| ---- | ----------------- | ------- |
| `name` is empty or only spaces | `BAD_USER_INPUT` | Project name cannot be empty or only spaces. |
| `name` is longer than 100 characters | `BAD_USER_INPUT` | Project name cannot be longer than 100 characters. |
| `description` is longer than 2000 characters | `BAD_USER_INPUT` | Project description cannot be longer than 2000 characters. |
| `key` isn't 2 to 10 letters or digits | `BAD_USER_INPUT` | Project key must be 2 to 10 letters or digits (A-Z, 0-9). |
| `key` is used by another project | `BAD_USER_INPUT` | The key 'WEB' is already used by another project. |
| `name` is missing | (none) | Refused by the schema: `name` is a required field |
| No token, or an expired or invalid token | `AUTH_NOT_AUTHENTICATED` | The current user is not authorized to access this resource. |

## Notes

- The key can't be changed later, because every task's readable id is built from it.
- To see the new project in the list: `query { projects { id key name role } }`.
