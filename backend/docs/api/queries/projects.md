# projects

Returns the projects a user is a member of, sorted by name, each with the role that user has in it. Deleted projects never come back. A user who is in no project gets an empty list.

This is what the sidebar asks for: every project with its boards, in one request.

[Back to the API index](../README.md)

## Arguments

| Argument | Type    | Required | Notes |
| -------- | ------- | -------- | ----- |
| `userId` | `UUID!` | yes      | The user whose projects you get. Temporary until login |

## Returns

A list of [`Project`](../types.md#project).

## Example

```graphql
query {
  projects(userId: "01a18766-479c-7ec2-be3f-3c3a00989ad6") {
    id
    key
    name
    role
    boards {
      id
      name
    }
    projectMembers {
      userName
      role
    }
  }
}
```

## Response

```json
{
  "data": {
    "projects": [
      {
        "id": "01a18766-48a1-7b2e-9c3f-5d6e7f809a1b",
        "key": "TES",
        "name": "Test Project",
        "role": "OWNER",
        "boards": [{ "id": "01a18766-48b5-7fb8-a04c-13e1bf648def", "name": "Test Board" }],
        "projectMembers": [
          { "userName": "admin@local.test", "role": "OWNER" },
          { "userName": "user1@local.test", "role": "OWNER" },
          { "userName": "user2@local.test", "role": "OWNER" },
          { "userName": "user3@local.test", "role": "OWNER" },
          { "userName": "user4@local.test", "role": "OWNER" }
        ]
      }
    ]
  }
}
```

## Errors

| Case                | `extensions.code` | Message |
| ------------------- | ----------------- | ------- |
| User does not exist | `NOT_FOUND`       | User '…' was not found. |

## Notes

- Get a user id with `SELECT "UserId" FROM project_members;`.
- `boards` and `projectMembers` are loaded with DataLoaders: one SQL query each for all the projects in the response, and only when the query asks for them.
- Boards also have `columns` (see [`Board`](../types.md#board)), but the sidebar doesn't need them.
