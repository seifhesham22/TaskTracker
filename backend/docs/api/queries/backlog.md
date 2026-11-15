# backlog

Returns every task of one project as a single list, one page at a time. The list can be searched by title and filtered by status, priority, board and parent. Search and filters can be combined.

**Needs a token**: send `Authorization: Bearer <accessToken>` (see [Authentication](../README.md#authentication)).

**Members only**: the user in the token must be a member of the project, with any role (`READER`, `WRITER` or `OWNER`). For anyone else the project doesn't seem to exist: they get the same `NOT_FOUND` as for an unknown id, so nobody can find out which projects exist by trying ids.

[Back to the API index](../README.md)

## Arguments

| Argument   | Type                  | Required | Notes |
| ---------- | --------------------- | -------- | ----- |
| `projectId`| `UUID!`               | yes      | Only the tasks of this project |
| `search`   | `String`              | no       | Part of the title, any case. `%` and `_` are plain characters. Spaces around it are ignored; an empty search lists everything. At most 200 characters |
| `where`    | [`BacklogFilterInput`](#filters) | no | The filters, written by the client. See [Filters](#filters) |
| `page`     | `Int!`                | no, default `1` | 1 or more |
| `pageSize` | `Int!`                | no, default `20` | From 1 to 100 |

## Order

The order is always the same, so pages never repeat or skip a task: board by board (in board order), column by column (in column order), then the task's position in its column. That is the order the boards show, read left to right and top to bottom.

Tasks on deleted boards are not listed. Tasks of other projects never are.

## Filters

`where` is a HotChocolate filter. The client writes it; the server turns it into one SQL query.

| Field          | Operations             | Example |
| -------------- | ---------------------- | ------- |
| `status`       | `eq`, `neq`, `in`, `nin` with [`ColumnCategory`](../types.md#columncategory) values | `{ status: { eq: IN_PROGRESS } }` |
| `priority`     | `eq`, `neq`, `in`, `nin` with [`TaskPriority`](../types.md#taskpriority) values, or `null` | `{ priority: { in: [HIGH, CRITICAL] } }` |
| `boardId`      | `eq`, `neq`, `in`, `nin` | `{ boardId: { eq: "01a1…" } }` |
| `parentTaskId` | `eq`, `neq`, `in`, `nin` | `{ parentTaskId: { eq: null } }` for tasks that aren't subtasks |
| `and`, `or`    | a list of filters      | `{ or: [{ status: { eq: BACKLOG } }, { priority: { eq: CRITICAL } }] }` |

Fields in the same object must all match (AND):

```graphql
where: { status: { neq: DONE }, priority: { eq: HIGH } }
```

Other fields of a task can't be filtered on. The schema refuses them before the query runs.

## Returns

A [`BacklogPage`](../types.md#backlogpage): the tasks of the page in `items`, and the page details.

## Example

The frontend sends the filters as variables:

```graphql
query Backlog($projectId: UUID!, $search: String, $where: BacklogFilterInput, $page: Int!, $pageSize: Int!) {
  backlog(projectId: $projectId, search: $search, where: $where, page: $page, pageSize: $pageSize) {
    items {
      id
      readableId
      title
      priority
      status
      column { name }
      assignees { id userName }
      blocks { readableId }
      blockedBy { readableId }
    }
    totalCount
    page
    pageSize
    totalPages
    hasNextPage
    hasPreviousPage
  }
}
```

```json
{
  "projectId": "01a18766-48a1-7b2e-9c3f-5d6e7f809a1b",
  "search": "login",
  "where": { "status": { "in": ["TO_DO", "IN_PROGRESS"] }, "priority": { "in": ["HIGH", "CRITICAL"] } },
  "page": 1,
  "pageSize": 20
}
```

The same request without variables:

```graphql
query {
  backlog(
    projectId: "01a18766-48a1-7b2e-9c3f-5d6e7f809a1b"
    search: "login"
    where: { status: { in: [TO_DO, IN_PROGRESS] }, priority: { in: [HIGH, CRITICAL] } }
    page: 1
    pageSize: 20
  ) {
    items { readableId title priority status }
    totalCount
    totalPages
  }
}
```

## Response

```json
{
  "data": {
    "backlog": {
      "items": [
        {
          "id": "01a18766-8315-7c9c-90fd-5657de973481",
          "readableId": "TES-4",
          "title": "Login API",
          "priority": "HIGH",
          "status": "IN_PROGRESS",
          "column": { "name": "In progress" },
          "assignees": [],
          "blocks": [{ "readableId": "TES-5" }],
          "blockedBy": [{ "readableId": "TES-1" }]
        }
      ],
      "totalCount": 1,
      "page": 1,
      "pageSize": 20,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    }
  }
}
```

## Errors

| Case | `extensions.code` | Message |
| ---- | ----------------- | ------- |
| Project does not exist, was deleted, or the user isn't a member of it | `NOT_FOUND` | Project '…' was not found. |
| `page` is 0 or less | `BAD_USER_INPUT` | Page must be 1 or more. |
| `pageSize` is under 1 or over 100 | `BAD_USER_INPUT` | Page size must be between 1 and 100. |
| `search` is longer than 200 characters | `BAD_USER_INPUT` | Search cannot be longer than 200 characters. |
| A filter on a field that isn't offered, or a wrong enum value | (none) | Refused by the schema; the message names the field |
| No token, or an expired or invalid token | `AUTH_NOT_AUTHENTICATED` | The current user is not authorized to access this resource. |

## Notes

- A page after the last one is not an error: `items` is empty and `totalCount` and `totalPages` still tell the real size.
- An empty project returns `totalCount: 0` and `totalPages: 0`.
- `totalCount` counts only what matches the search and the filters.
- Each item is a full [`Task`](../types.md#task), so `blocks` and `blockedBy` show its dependencies here too (see [`addTaskDependency`](../mutations/addTaskDependency.md)). Like `column` and `assignees`, they are loaded with DataLoaders: one SQL query each for the whole page.
- Get a project id from the [`projects`](projects.md) query, or `SELECT "Id", "Key" FROM projects;`. To try it in Nitro, [`login`](../mutations/login.md) as a member of that project and use that token. The seeded users are members of the seeded `TES` project (see [Seed data](../../../README.md#seed-data)).
- Page, page size and search are checked before membership, so a wrong value comes back as `BAD_USER_INPUT` for anyone. That tells nothing about the project.
- The [`tasks`](tasks.md) query stays as it is for the board screen: a board needs all of its tasks at once, not pages.
