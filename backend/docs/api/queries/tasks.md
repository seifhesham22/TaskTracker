# tasks

Returns tasks in the order they were created (`TES-1`, `TES-2`, …). Give a `boardId` for the tasks of one board, or leave it out for the tasks of every project the user is a member of. A board with no tasks returns an empty list.

The board screen can **search** the titles and **filter** by status, priority and assignee. Without `search` and `where`, the full list comes back.

**Needs a token**: send `Authorization: Bearer <accessToken>` (see [Authentication](../README.md#authentication)).

**Members only**: with a `boardId`, the user in the token must be a member of the board's project, with any role (`READER`, `WRITER` or `OWNER`). For anyone else the board doesn't seem to exist (`NOT_FOUND`). See [Project access](../README.md#project-access).

[Back to the API index](../README.md)

## Arguments

| Argument  | Type   | Required | Notes |
| --------- | ------ | -------- | ----- |
| `boardId` | `UUID` | no       | Only the tasks of this board. Left out: the tasks of all the user's projects, never anyone else's |
| `search`  | `String` | no     | Part of the title, any case. `%` and `_` are plain characters. Spaces around it are ignored; an empty search lists everything. At most 200 characters |
| `where`   | `TaskFilterInput` | no | The filters, written by the client. See [Filters](#filters) |

## Filters

`where` is a HotChocolate filter: the client writes it and the server turns it into one SQL query. It has the same fields as the [`backlog`](backlog.md) filter.

| Field          | Operations | Example |
| -------------- | ---------- | ------- |
| `status`       | `eq`, `neq`, `in`, `nin` with [`ColumnCategory`](../types.md#columncategory) values | `{ status: { eq: IN_PROGRESS } }` |
| `priority`     | `eq`, `neq`, `in`, `nin` with [`TaskPriority`](../types.md#taskpriority) values, or `null` | `{ priority: { in: [HIGH, CRITICAL] } }` |
| `assignees`    | `some`, `none`, `all` with `{ userId: { eq / neq / in / nin } }`, or `any: true / false` | `{ assignees: { some: { userId: { eq: "01a1…" } } } }` for the tasks of one member; `{ assignees: { any: false } }` for unassigned tasks |
| `boardId`, `parentTaskId` | `eq`, `neq`, `in`, `nin` | `{ parentTaskId: { eq: null } }` for tasks that aren't subtasks |
| `and`, `or`    | a list of filters | `{ or: [{ status: { eq: BACKLOG } }, { priority: { eq: CRITICAL } }] }` |

**How filters combine:** `search` and every field in `where` must all match (AND). Inside one field, `in` means any of the values (OR). A task with several assignees matches the assignee filter of each of them.

**No pages:** a board shows all its tasks at once, so this list isn't paged; filters make it shorter. The [`backlog`](backlog.md) has pages.

Filters only narrow what the user may already see: they never show tasks of another board or project.

## Returns

A list of [`Task`](../types.md#task).

## Example

```graphql
query {
  tasks(boardId: "01a18766-48b5-7fb8-a04c-13e1bf648def") {
    readableId
    title
    description
    priority
    dueDate
    status
    column {
      name
      category
    }
    assignees {
      id
      userName
    }
    blocks {
      readableId
      title
    }
    blockedBy {
      readableId
      title
    }
  }
}
```

## Response

```json
{
  "data": {
    "tasks": [
      {
        "readableId": "TES-1",
        "title": "Title only",
        "description": null,
        "priority": null,
        "dueDate": null,
        "status": "BACKLOG",
        "column": { "name": "Backlog", "category": "BACKLOG" },
        "assignees": [],
        "blocks": [{ "readableId": "TES-2", "title": "Full task" }],
        "blockedBy": []
      },
      {
        "readableId": "TES-2",
        "title": "Full task",
        "description": "Some details",
        "priority": "HIGH",
        "dueDate": "2026-11-05T00:00:00Z",
        "status": "BACKLOG",
        "column": { "name": "Backlog", "category": "BACKLOG" },
        "assignees": [{ "id": "01a18766-479c-7ec2-be3f-3c3a00989ad6", "userName": "user1@local.test" }],
        "blocks": [],
        "blockedBy": [{ "readableId": "TES-1", "title": "Title only" }]
      }
    ]
  }
}
```

## Filtered example

The board screen sends the search and the filters as variables:

```graphql
query Board($boardId: UUID!, $search: String, $where: TaskFilterInput) {
  tasks(boardId: $boardId, search: $search, where: $where) {
    readableId
    title
    status
    priority
    assignees { id userName }
  }
}
```

```json
{
  "boardId": "01a18766-48b5-7fb8-a04c-13e1bf648def",
  "search": "login",
  "where": {
    "status": { "in": ["TO_DO", "IN_PROGRESS"] },
    "assignees": { "some": { "userId": { "eq": "01a16d7c-210a-782a-92dc-0a300819c069" } } }
  }
}
```

## Errors

| Case                 | `extensions.code` | Message |
| -------------------- | ----------------- | ------- |
| Board does not exist, was deleted, or the user isn't a member of its project | `NOT_FOUND` | Board '…' was not found. |
| `search` is longer than 200 characters | `BAD_USER_INPUT` | Search cannot be longer than 200 characters. |
| A filter on a field that isn't offered, or a wrong enum value | (none) | Refused by the schema; the message names the field |
| No token, or an expired or invalid token | `AUTH_NOT_AUTHENTICATED` | The current user is not authorized to access this resource. |

## Notes

- Get a board id with `SELECT "Id" FROM boards;`.
- `status`, `column`, `assignees`, `blocks` and `blockedBy` are loaded with DataLoaders: one SQL query each for all the tasks in the response, and only when the query asks for them.
- `blocks` lists the tasks this task blocks (its dependents), and `blockedBy` lists the tasks that block it (its predecessors). Here TES-1 blocks TES-2. Dependencies are added with [`addTaskDependency`](../mutations/addTaskDependency.md).
