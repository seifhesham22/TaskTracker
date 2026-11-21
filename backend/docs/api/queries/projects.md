# projects

Returns the projects of the logged-in user (the user in the token), sorted by name, each with the role the user has in it. Deleted projects never come back. A user who is in no project gets an empty list.

This is what the sidebar asks for: every project with its boards, in one request.

**Needs a token**: send `Authorization: Bearer <accessToken>` (see [Authentication](../README.md#authentication)).

[Back to the API index](../README.md)

## Arguments

| Argument | Type    | Required | Notes |
| -------- | ------- | -------- | ----- |
| `userId` | `UUID`  | no       | Leave it out. Kept so older clients keep working: if it is sent, it must be the logged-in user's own id |

## Returns

A list of [`Project`](../types.md#project).

## Example

```graphql
query {
  projects {
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
| `userId` is someone else's id | `AUTH_NOT_AUTHORIZED` | You can only list your own projects. |
| No token, or an expired or invalid token | `AUTH_NOT_AUTHENTICATED` | The current user is not authorized to access this resource. |

## Notes

- `boards` and `projectMembers` are loaded with DataLoaders: one SQL query each for all the projects in the response, and only when the query asks for them.
- Boards also have `columns` (see [`Board`](../types.md#board)), but the sidebar doesn't need them.
