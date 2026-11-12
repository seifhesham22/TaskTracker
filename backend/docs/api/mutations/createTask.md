# createTask

Creates a task in a column of a board. The task's status is the category of that column (a column "In review" with category `IN_PROGRESS` gives the task status `IN_PROGRESS`). Without a `columnId`, the task goes into the board's first column, at the bottom. The database gives the task the next number in its project. With a `parentTaskId`, the new task is a subtask of that task.

**Needs a token**: send `Authorization: Bearer <accessToken>` (see [Authentication](../README.md#authentication)).

[Back to the API index](../README.md)

## Input

| Field          | Type           | Required | Notes |
| -------------- | -------------- | -------- | ----- |
| `boardId`      | `UUID`         | yes      | Must be an existing board |
| `columnId`     | `UUID`         | no       | A column of that board. Default: the board's first column |
| `title`        | `String`       | yes      | Not empty or only spaces, max 200 characters |
| `description`  | `String`       | no       | |
| `assigneeId`   | `UUID`         | no       | Must be a member of the board's project |
| `priority`     | [`TaskPriority`](../types.md#taskpriority) | no | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `startDate`    | `DateTime`     | no       | ISO 8601, e.g. `2026-11-02T00:00:00Z` |
| `dueDate`      | `DateTime`     | no       | ISO 8601, e.g. `2026-11-05T00:00:00Z`. Not before `startDate` |
| `parentTaskId` | `UUID`         | no       | Makes the task a subtask. The parent must be in the same project (it can be on another board of that project) |

## Returns

A [`TaskDto`](../types.md#taskdto).

## Example

```graphql
mutation {
  createTask(
    input: {
      boardId: "01a18766-48b5-7fb8-a04c-13e1bf648def"
      title: "Full task"
      description: "Some details"
      assigneeId: "01a18766-479c-7ec2-be3f-3c3a00989ad6"
      priority: HIGH
      startDate: "2026-11-02T00:00:00Z"
      dueDate: "2026-11-05T00:00:00Z"
    }
  ) {
    id
    readableId
    status
    columnName
    title
    description
    priority
    assigneeIds
    startDate
    dueDate
    parentTaskId
  }
}
```

## Response

```json
{
  "data": {
    "createTask": {
      "id": "01a18766-8315-7c9c-90fd-5657de973481",
      "readableId": "TES-2",
      "status": "BACKLOG",
      "columnName": "Backlog",
      "title": "Full task",
      "description": "Some details",
      "priority": "HIGH",
      "assigneeIds": ["01a18766-479c-7ec2-be3f-3c3a00989ad6"],
      "startDate": "2026-11-02T00:00:00Z",
      "dueDate": "2026-11-05T00:00:00Z",
      "parentTaskId": null
    }
  }
}
```

## Errors

| Case                                              | `extensions.code` | Message |
| ------------------------------------------------- | ----------------- | ------- |
| Title is empty or only spaces                     | `BAD_USER_INPUT`  | Title cannot be empty or only spaces. |
| Title longer than 200 characters                  | `BAD_USER_INPUT`  | Title cannot be longer than 200 characters. |
| Assignee is not in the project                    | `BAD_USER_INPUT`  | User '…' is not a member of project TES, so they can't be assigned to this task. |
| Board does not exist                              | `NOT_FOUND`       | Board '…' was not found. |
| Column is not on that board                       | `NOT_FOUND`       | Column '…' was not found on board '…'. |
| Board has no columns (and no `columnId` was sent) | `BAD_USER_INPUT`  | This board has no columns, so the task can't get a status. |
| Parent task does not exist, or was deleted        | `NOT_FOUND`       | Parent task '…' was not found. |
| Parent task is in another project                 | `BAD_USER_INPUT`  | Parent task '…' is in another project. A subtask must be in the same project as its parent. |
| Due date before the start date                    | `BAD_USER_INPUT`  | The due date cannot be before the start date. |
| Title missing completely                          | (none)            | Refused by the schema: `title` is a required field and cannot be null. |
| No token, or an expired or invalid token | `AUTH_NOT_AUTHENTICATED` | The current user is not authorized to access this resource. |

## Notes

- Get a board id with `SELECT "Id" FROM boards;` and a user id with `SELECT "Id", "UserName" FROM "AspNetUsers";`.
- Several `createTask` calls in one request run one after another, so they get their numbers in that order.
