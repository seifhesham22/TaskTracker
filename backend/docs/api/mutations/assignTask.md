# assignTask

Adds a project member to the assignees of an existing task. A task can have **several assignees**, so more than one person can work on it: assigning someone keeps the people who are already assigned. Assigning someone who is already an assignee changes nothing, so the request is safe to repeat.

The response is the updated [`Task`](../types.md#task), so the frontend can show the assignees at once. [`unassignTask`](unassignTask.md) removes one assignee again.

**Needs a token**: send `Authorization: Bearer <accessToken>` (see [Authentication](../README.md#authentication)).

**Writers and the owner only**: the user in the token must be a `WRITER` or the `OWNER` of the task's project. A `READER` gets `AUTH_NOT_AUTHORIZED`. For anyone who isn't a member, the task doesn't seem to exist (`NOT_FOUND`). See [Project access](../README.md#project-access).

**Who can be assigned**: any member of the task's project, with any role (a `READER` too). Someone outside the project is refused.

[Back to the API index](../README.md)

## Input

| Field    | Type    | Required | Notes |
| -------- | ------- | -------- | ----- |
| `taskId` | `UUID!` | yes      | |
| `userId` | `UUID!` | yes      | The member to add. Member ids are in [`Project.projectMembers`](../types.md#projectmember) |

## Returns

The updated [`Task`](../types.md#task), with every assignee in `assignees`.

## Example

```graphql
mutation {
  assignTask(
    input: { taskId: "01a18766-8315-7c9c-90fd-5657de973481", userId: "01a16d7c-210a-782a-92dc-0a300819c069" }
  ) {
    id
    readableId
    assignees {
      id
      userName
    }
  }
}
```

## Response

The task already had admin as an assignee; user1 is added next to them:

```json
{
  "data": {
    "assignTask": {
      "id": "01a18766-8315-7c9c-90fd-5657de973481",
      "readableId": "TES-2",
      "assignees": [
        { "id": "01a16d7c-206a-7a6e-8d2e-eefb47c4dc77", "userName": "admin@local.test" },
        { "id": "01a16d7c-210a-782a-92dc-0a300819c069", "userName": "user1@local.test" }
      ]
    }
  }
}
```

## Errors

| Case | `extensions.code` | Message |
| ---- | ----------------- | ------- |
| `userId` isn't a member of the task's project | `BAD_USER_INPUT` | User '…' is not a member of project TES, so they can't be assigned to this task. |
| The task doesn't exist, was deleted, or the user isn't a member of its project | `NOT_FOUND` | Task '…' was not found. |
| The user is a `READER` | `AUTH_NOT_AUTHORIZED` | Only writers and owners of the project can assign tasks. |
| `taskId` or `userId` is missing | (none) | Refused by the schema: the field is required |
| No token, or an expired or invalid token | `AUTH_NOT_AUTHENTICATED` | The current user is not authorized to access this resource. |

## Notes

- A task can also get its first assignee when it is created, with `assigneeId` in [`createTask`](createTask.md).
- Two assignments of the same task at the same moment are both saved. The same member assigned twice at the same moment is saved once.
- A member who is later removed from the project stays an assignee until someone unassigns them.
