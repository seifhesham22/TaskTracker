# workload

The workload view of a project: every member with the number of **open tasks** assigned to them and which tasks those are, so the owner can compare members and see who has much more work than the others.

It uses the assignments and statuses as they are right now: assigning, unassigning, moving a task or removing a member changes the next answer at once. Nothing is stored for it.

**Needs a token**: send `Authorization: Bearer <accessToken>` (see [Authentication](../README.md#authentication)).

**Owner only**: the user in the token must be the `OWNER` of the project. A `WRITER` or `READER` gets `AUTH_NOT_AUTHORIZED`. For anyone who isn't a member, the project doesn't seem to exist (`NOT_FOUND`). See [Project access](../README.md#project-access).

[Back to the API index](../README.md)

## What counts

| Rule | Meaning |
| ---- | ------- |
| Open task | A task in a column of category `BACKLOG`, `TO_DO` or `IN_PROGRESS`. Tasks in `DONE` or `CANCELLED` columns never count |
| Several assignees | A task assigned to two members counts once for each of them, so the counts can add up to more than the number of tasks |
| Members | Every current member is listed, also with 0 open tasks. Someone who left the project is not listed |
| Unassigned | Open tasks with no assignee who is still a member are in `unassigned`, for example the tasks of someone who left |
| Not counted | Deleted tasks, tasks on deleted boards, and tasks of other projects |

## Arguments

| Argument    | Type    | Required | Notes |
| ----------- | ------- | -------- | ----- |
| `projectId` | `UUID!` | yes      | |

## Returns

A [`ProjectWorkload`](../types.md#projectworkload):

- `members`: one [`MemberWorkload`](../types.md#memberworkload) per member, the most open tasks first (then by user name).
- `unassigned`: the open tasks nobody in the project is assigned to.
- `averageOpenTasks`: the average number of open tasks per member, rounded to 2 decimals.

**Finding members with much more work:** compare each `openTaskCount` with `averageOpenTasks`. How far above the average counts as "significantly more" (for example 1.5 times the average) is decided by the design of the workload screen.

## Example

```graphql
query {
  workload(projectId: "01a182a9-9195-783d-baa3-8ffde80a5072") {
    averageOpenTasks
    members {
      userName
      role
      openTaskCount
      openTasks { readableId title status }
    }
    unassigned { readableId title }
  }
}
```

## Response

```json
{
  "data": {
    "workload": {
      "averageOpenTasks": 1.33,
      "members": [
        {
          "userName": "user1@local.test",
          "role": "WRITER",
          "openTaskCount": 3,
          "openTasks": [
            { "readableId": "TES-2", "title": "Build login page", "status": "IN_PROGRESS" },
            { "readableId": "TES-3", "title": "Set up CI pipeline", "status": "TO_DO" },
            { "readableId": "TES-7", "title": "Email notifications", "status": "BACKLOG" }
          ]
        },
        {
          "userName": "admin@local.test",
          "role": "OWNER",
          "openTaskCount": 1,
          "openTasks": [{ "readableId": "TES-4", "title": "Write API docs", "status": "TO_DO" }]
        },
        { "userName": "user2@local.test", "role": "READER", "openTaskCount": 0, "openTasks": [] }
      ],
      "unassigned": [{ "readableId": "TES-5", "title": "Add dark mode" }]
    }
  }
}
```

## Errors

| Case | `extensions.code` | Message |
| ---- | ----------------- | ------- |
| The project doesn't exist, or the user isn't a member of it | `NOT_FOUND` | Project '…' was not found. |
| The user is a `WRITER` or `READER` | `AUTH_NOT_AUTHORIZED` | Only the owner of the project can see the workload. |
| No token, or an expired or invalid token | `AUTH_NOT_AUTHENTICATED` | The current user is not authorized to access this resource. |

## Notes

- Each task in `openTasks` and `unassigned` is a full [`Task`](../types.md#task), in [backlog](backlog.md) order, so the screen can show and link it.
- Assignments are changed with [`assignTask`](../mutations/assignTask.md) and [`unassignTask`](../mutations/unassignTask.md), statuses with [`moveTask`](../mutations/moveTask.md).
