# addProjectMember

Adds an existing account to a project, found by its email, as a reader or a writer. From then on the account sees the project in its [`projects`](../queries/projects.md) list and can use everything members can, like [`backlog`](../queries/backlog.md).

A project has **only one owner**: the user who created it with [`createProject`](createProject.md). Everyone added later is a `READER` or a `WRITER`.

**Needs a token**: send `Authorization: Bearer <accessToken>` (see [Authentication](../README.md#authentication)).

**Who can do it**: the managers of the project, its `WRITER`s and its `OWNER`.

| The user in the token is | Can add a `READER` | Can add a `WRITER` | Can add an `OWNER` |
| ------------------------ | ------------------ | ------------------ | ------------------ |
| `OWNER`                  | yes | yes | no, nobody can |
| `WRITER`                 | yes | yes | no, nobody can |
| `READER`                 | no  | no  | no |
| not a member             | no, the project doesn't seem to exist (`NOT_FOUND`) | | |

[Back to the API index](../README.md)

## Input

| Field       | Type                                      | Required | Notes |
| ----------- | ----------------------------------------- | -------- | ----- |
| `projectId` | `UUID!`                                   | yes      | |
| `email`     | `String!`                                 | yes      | The email of a registered account. Any case; spaces around it are ignored |
| `role`      | [`ProjectRole!`](../types.md#projectrole) | no, default `WRITER` | `READER` or `WRITER`. `OWNER` is refused |

## Returns

The new [`ProjectMember`](../types.md#projectmember).

## Example

```graphql
mutation {
  addProjectMember(
    input: { projectId: "01a182a9-9195-783d-baa3-8ffde80a5072", email: "new.member@local.test", role: WRITER }
  ) {
    projectId
    userId
    userName
    role
    joinedAt
  }
}
```

## Response

```json
{
  "data": {
    "addProjectMember": {
      "projectId": "01a182a9-9195-783d-baa3-8ffde80a5072",
      "userId": "01a1f6c2-7d1e-7a3b-9c4d-5e6f708192a3",
      "userName": "new.member@local.test",
      "role": "WRITER",
      "joinedAt": "2026-11-21T10:15:00Z"
    }
  }
}
```

## Errors

| Case | `extensions.code` | Message |
| ---- | ----------------- | ------- |
| `email` is empty | `BAD_USER_INPUT` | Email is required. |
| `role` is `OWNER` | `BAD_USER_INPUT` | A project has only one owner. New members can be readers or writers. |
| The account is already a member of the project | `BAD_USER_INPUT` | new.member@local.test is already a member of this project. |
| No account has that email | `NOT_FOUND` | No account with the email '…' was found. |
| The project doesn't exist, or the user isn't a member of it | `NOT_FOUND` | Project '…' was not found. |
| The user is a `READER` | `AUTH_NOT_AUTHORIZED` | Only writers and owners of the project can add members. |
| No token, or an expired or invalid token | `AUTH_NOT_AUTHENTICATED` | The current user is not authorized to access this resource. |

## Notes

- To change the role of a member, remove them with [`removeProjectMember`](removeProjectMember.md) and add them again.
- If the project changes while the request is running, the request is checked again against the new data before it saves. So two requests at the same moment can't add the same account twice: the second one answers "already a member".
