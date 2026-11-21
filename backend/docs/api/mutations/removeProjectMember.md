# removeProjectMember

Removes a member from a project. Their access ends at once: the project leaves their [`projects`](../queries/projects.md) list, and operations that check membership, like [`backlog`](../queries/backlog.md) and [`addTaskDependency`](addTaskDependency.md), answer them with `NOT_FOUND`.

**Needs a token**: send `Authorization: Bearer <accessToken>` (see [Authentication](../README.md#authentication)).

**Who can do it**: the managers of the project, its `WRITER`s and its `OWNER`.

| The user in the token is | Can remove a `READER` | Can remove a `WRITER` | Can remove the `OWNER` |
| ------------------------ | --------------------- | --------------------- | ---------------------- |
| `OWNER`                  | yes | yes | no, nobody can |
| `WRITER`                 | yes | yes | no, nobody can |
| `READER`                 | no  | no  | no |
| not a member             | no, the project doesn't seem to exist (`NOT_FOUND`) | | |

A writer can leave a project by removing themselves. A reader can't remove anyone, so the owner or a writer removes them.

**The owner can't be removed**, not even by themselves. A project has exactly one owner, the user who created it, so it always keeps a manager.

[Back to the API index](../README.md)

## Input

| Field       | Type    | Required | Notes |
| ----------- | ------- | -------- | ----- |
| `projectId` | `UUID!` | yes      | |
| `userId`    | `UUID!` | yes      | The member to remove, from [`Project.projectMembers`](../types.md#projectmember) |

## Returns

The removed [`ProjectMember`](../types.md#projectmember), as it was before the removal, so the client knows whom to take off the list.

## Example

```graphql
mutation {
  removeProjectMember(
    input: { projectId: "01a182a9-9195-783d-baa3-8ffde80a5072", userId: "01a1f6c2-7d1e-7a3b-9c4d-5e6f708192a3" }
  ) {
    userId
    userName
    role
  }
}
```

## Response

```json
{
  "data": {
    "removeProjectMember": {
      "userId": "01a1f6c2-7d1e-7a3b-9c4d-5e6f708192a3",
      "userName": "new.member@local.test",
      "role": "WRITER"
    }
  }
}
```

## Errors

| Case | `extensions.code` | Message |
| ---- | ----------------- | ------- |
| The member is the project's owner | `BAD_USER_INPUT` | admin@local.test is the owner of this project and can't be removed. |
| `userId` isn't a member of the project | `NOT_FOUND` | User '…' is not a member of this project. |
| The project doesn't exist, or the user isn't a member of it | `NOT_FOUND` | Project '…' was not found. |
| The user is a `READER` | `AUTH_NOT_AUTHORIZED` | Only writers and owners of the project can remove members. |
| No token, or an expired or invalid token | `AUTH_NOT_AUTHENTICATED` | The current user is not authorized to access this resource. |

## Notes

- If the project changes while the request is running, the request is checked again against the new data before it saves. So when two managers remove the same member at the same moment, the first removal goes through and the second answers "not a member".
- Tasks assigned to the removed member keep them as an assignee.
