# unassignTask

Removes one assignee from a task. The other assignees stay. When the last assignee is removed, the task has no assignee until someone assigns a member again with [`assignTask`](assignTask.md). Unassigning someone who isn't an assignee of the task changes nothing, so the request is safe to repeat.

The response is the updated [`Task`](../types.md#task), with the remaining assignees.

**Needs a token**: send `Authorization: Bearer <accessToken>` (see [Authentication](../README.md#authentication)).

**Writers and the owner only**: the user in the token must be a `WRITER` or the `OWNER` of the task's project. A `READER` gets `AUTH_NOT_AUTHORIZED`. For anyone who isn't a member, the task doesn't seem to exist (`NOT_FOUND`). See [Project access](../README.md#project-access).

[Back to the API index](../README.md)

## Input

| Field    | Type    | Required | Notes |
| -------- | ------- | -------- | ----- |
| `taskId` | `UUID!` | yes      | |
| `userId` | `UUID!` | yes      | The assignee to remove. This also works for someone who has left the project but is still assigned |

## Returns

The updated [`Task`](../types.md#task).

## Example

```graphql
mutation {
  unassignTask(
    input: { taskId: "01a18766-8315-7c9c-90fd-5657de973481", userId: "01a16d7c-206a-7a6e-8d2e-eefb47c4dc77" }
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

admin is removed; user1 is still assigned:

```json
{
  "data": {
    "unassignTask": {
      "id": "01a18766-8315-7c9c-90fd-5657de973481",
      "readableId": "TES-2",
      "assignees": [{ "id": "01a16d7c-210a-782a-92dc-0a300819c069", "userName": "user1@local.test" }]
    }
  }
}
```

## Errors

| Case | `extensions.code` | Message |
| ---- | ----------------- | ------- |
| The task doesn't exist, was deleted, or the user isn't a member of its project | `NOT_FOUND` | Task '…' was not found. |
| The user is a `READER` | `AUTH_NOT_AUTHORIZED` | Only writers and owners of the project can unassign tasks. |
| `taskId` or `userId` is missing | (none) | Refused by the schema: the field is required |
| No token, or an expired or invalid token | `AUTH_NOT_AUTHENTICATED` | The current user is not authorized to access this resource. |
