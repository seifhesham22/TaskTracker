# updateTask

Changes the title, description, priority and dates of an existing task. **Needs a token** (see [Authentication](../README.md#authentication)).

Only the fields you send change:

- **Left out**: the field keeps its saved value.
- **Sent with a value**: the field gets the new value.
- **Sent as `null`**: the field is cleared. This works for `description`, `priority`, `startDate` and `dueDate`, but not `title`, which every task must have.

Everything is checked before anything is saved, so a refused update changes nothing, not even the fields that were valid.

The response is the same [`Task`](../types.md#task) type the [`tasks`](../queries/tasks.md) query returns.

[Back to the API index](../README.md)

## Input

| Field         | Type           | Required | Notes |
| ------------- | -------------- | -------- | ----- |
| `taskId`      | `UUID`         | yes      | Must be an existing task |
| `title`       | `String`       | no       | Not empty or only spaces, max 200 characters. Spaces around it are removed |
| `description` | `String`       | no       | `null` clears it |
| `priority`    | [`TaskPriority`](../types.md#taskpriority) | no | `null` clears it |
| `startDate`   | `DateTime`     | no       | ISO 8601. `null` clears it |
| `dueDate`     | `DateTime`     | no       | ISO 8601. Not before the start date. `null` clears it |

When only one of the dates is sent, the other one is the saved value, and the due date still can't be before the start date.

## Returns

A [`Task`](../types.md#task).

## Example

```graphql
mutation {
  updateTask(
    input: {
      taskId: "01a18766-8315-7c9c-90fd-5657de973481"
      title: "Updated title"
      description: "Updated description"
      priority: HIGH
      startDate: "2026-11-02T00:00:00Z"
      dueDate: "2026-11-09T00:00:00Z"
    }
  ) {
    id
    readableId
    title
    description
    priority
    startDate
    dueDate
  }
}
```

## Response

```json
{
  "data": {
    "updateTask": {
      "id": "01a18766-8315-7c9c-90fd-5657de973481",
      "readableId": "TES-2",
      "title": "Updated title",
      "description": "Updated description",
      "priority": "HIGH",
      "startDate": "2026-11-02T00:00:00Z",
      "dueDate": "2026-11-09T00:00:00Z"
    }
  }
}
```

To clear the description and keep everything else:

```graphql
mutation {
  updateTask(input: { taskId: "01a18766-8315-7c9c-90fd-5657de973481", description: null }) {
    title
    description
  }
}
```

## Errors

| Case                                  | `extensions.code`        | Message |
| ------------------------------------- | ------------------------ | ------- |
| Title is empty, only spaces, or `null` | `BAD_USER_INPUT`        | Title cannot be empty or only spaces. |
| Title longer than 200 characters      | `BAD_USER_INPUT`         | Title cannot be longer than 200 characters. |
| Due date before the start date        | `BAD_USER_INPUT`         | The due date cannot be before the start date. |
| Task does not exist                   | `NOT_FOUND`              | Task '…' was not found. |
| `taskId` missing                      | (none)                   | Refused by the schema: the field is required and cannot be null. |
| No token, or an expired or invalid token | `AUTH_NOT_AUTHENTICATED` | The current user is not authorized to access this resource. |
