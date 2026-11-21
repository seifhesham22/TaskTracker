# Types

Every type the [GraphQL API](README.md) returns, described once. Operation pages link here instead of repeating the fields.

A `!` after a type means it is never `null`. `UUID` is a string like `01a18766-48b5-7fb8-a04c-13e1bf648def`. `DateTime` is ISO 8601 in UTC, for example `2026-11-05T00:00:00Z`.

- [Task](#task)
- [TaskDependencyPayload](#taskdependencypayload)
- [BacklogPage](#backlogpage)
- [ProjectWorkload](#projectworkload)
- [MemberWorkload](#memberworkload)
- [TaskDto](#taskdto)
- [Board](#board)
- [Column](#column)
- [Project](#project)
- [ProjectMember](#projectmember)
- [Assignee](#assignee)
- [User](#user)
- [LoginPayload](#loginpayload)
- [Enums](#enums): [ColumnCategory](#columncategory), [TaskPriority](#taskpriority), [ProjectRole](#projectrole)

## Task

A task on a board. Returned by [`tasks`](queries/tasks.md), [`backlog`](queries/backlog.md) (in `items`), [`moveTask`](mutations/moveTask.md), [`updateTask`](mutations/updateTask.md) and [`addTaskDependency`](mutations/addTaskDependency.md).

| Field          | Type                 | Notes |
| -------------- | -------------------- | ----- |
| `id`           | `UUID!`              | |
| `number`       | `Int!`               | Number of the task in its project |
| `readableId`   | `String!`            | Project key and number, e.g. `TES-1` |
| `title`        | `String!`            | |
| `description`  | `String`             | `null` when not set |
| `priority`     | [`TaskPriority`](#taskpriority) | `null` when not set |
| `startDate`    | `DateTime`           | `null` when not set |
| `dueDate`      | `DateTime`           | `null` when not set |
| `boardId`      | `UUID!`              | |
| `columnId`     | `UUID!`              | |
| `position`     | `String!`            | Order of the task inside its column |
| `parentTaskId` | `UUID`               | The parent's id for a subtask, `null` for a task without a parent |
| `status`       | [`ColumnCategory!`](#columncategory) | The category of the task's column |
| `column`       | [`Column!`](#column) | The column the task is in. `status` is the same as `column.category` |
| `assignees`    | [`[Assignee!]!`](#assignee) | Everyone assigned to the task; several people can work on it. An empty list when nobody is assigned. Changed with [`assignTask`](mutations/assignTask.md) and [`unassignTask`](mutations/unassignTask.md) |
| `blocks`       | [`[Task!]!`](#task)  | The tasks this one blocks: they can't be done before it (its dependents). See [`addTaskDependency`](mutations/addTaskDependency.md) |
| `blockedBy`    | [`[Task!]!`](#task)  | The tasks that block this one: they must be done first (its predecessors) |

`status`, `column`, `assignees`, `blocks` and `blockedBy` are loaded with DataLoaders (`status` and `column` share one).

## TaskDependencyPayload

Returned by [`addTaskDependency`](mutations/addTaskDependency.md).

| Field          | Type             | Notes |
| -------------- | ---------------- | ----- |
| `blockingTask` | [`Task!`](#task) | The task that must be done first. Its `blocks` now lists the other task |
| `blockedTask`  | [`Task!`](#task) | The task that waits. Its `blockedBy` now lists the other task |

## BacklogPage

One page of a project's tasks. Returned by [`backlog`](queries/backlog.md).

| Field             | Type                 | Notes |
| ----------------- | -------------------- | ----- |
| `items`           | [`[Task!]!`](#task)  | The tasks of this page, in backlog order. Empty after the last page |
| `totalCount`      | `Int!`               | All the tasks that match the search and the filters, on every page |
| `page`            | `Int!`               | The page that was asked for, from 1 |
| `pageSize`        | `Int!`               | The page size that was asked for |
| `totalPages`      | `Int!`               | `0` when nothing matches |
| `hasNextPage`     | `Boolean!`           | `page < totalPages` |
| `hasPreviousPage` | `Boolean!`           | `page > 1` |

## ProjectWorkload

Returned by [`workload`](queries/workload.md).

| Field              | Type                                    | Notes |
| ------------------ | --------------------------------------- | ----- |
| `members`          | [`[MemberWorkload!]!`](#memberworkload) | Every member of the project, the most open tasks first |
| `unassigned`       | [`[Task!]!`](#task)                     | Open tasks no member is assigned to |
| `averageOpenTasks` | `Float!`                                | Open tasks per member on average, rounded to 2 decimals. `0` when nothing is open |

## MemberWorkload

One member in [`ProjectWorkload`](#projectworkload).

| Field           | Type                           | Notes |
| --------------- | ------------------------------ | ----- |
| `userId`        | `UUID!`                        | |
| `userName`      | `String!`                      | |
| `role`          | [`ProjectRole!`](#projectrole) | |
| `openTaskCount` | `Int!`                         | Tasks in `BACKLOG`, `TO_DO` or `IN_PROGRESS` assigned to this member |
| `openTasks`     | [`[Task!]!`](#task)            | Those tasks, in backlog order |

## TaskDto

The task as returned by [`createTask`](mutations/createTask.md). It is a flat shape: related data comes as ids and names instead of nested objects.

| Field          | Type                 | Notes |
| -------------- | -------------------- | ----- |
| `id`           | `UUID!`              | |
| `readableId`   | `String!`            | e.g. `TES-2` |
| `number`       | `Int!`               | |
| `boardId`      | `UUID!`              | |
| `title`        | `String!`            | |
| `description`  | `String`             | `null` when not set |
| `status`       | [`ColumnCategory!`](#columncategory) | |
| `columnId`     | `UUID!`              | |
| `columnName`   | `String!`            | |
| `priority`     | [`TaskPriority`](#taskpriority) | `null` when not set |
| `assigneeIds`  | `[UUID!]!`           | An empty list when nobody is assigned |
| `dueDate`      | `DateTime`           | `null` when not set |
| `createdAt`    | `DateTime!`          | |
| `parentTaskId` | `UUID`               | `null` for a task without a parent |
| `startDate`    | `DateTime`           | `null` when not set |

## Board

Returned by [`board`](queries/board.md) and [`createBoard`](mutations/createBoard.md), and by `Project.boards` in [`projects`](queries/projects.md).

| Field       | Type                   | Notes |
| ----------- | ---------------------- | ----- |
| `id`        | `UUID!`                | |
| `projectId` | `UUID!`                | |
| `name`      | `String!`              | Unique in its project, in any case |
| `columns`   | [`[Column!]!`](#column) | In board order. An empty list when the board has no columns |

`columns` is loaded with a DataLoader.

## Column

A column of a board. Its category is the status of every task in it.

| Field      | Type                 | Notes |
| ---------- | -------------------- | ----- |
| `id`       | `UUID!`              | |
| `name`     | `String!`            | e.g. "In progress" |
| `position` | `String!`            | Order of the column on its board |
| `category` | [`ColumnCategory!`](#columncategory) | The status the column stands for |

## Project

Returned by [`projects`](queries/projects.md) and [`createProject`](mutations/createProject.md).

| Field            | Type                              | Notes |
| ---------------- | --------------------------------- | ----- |
| `id`             | `UUID!`                           | |
| `key`            | `String!`                         | e.g. `TES`. The start of every task's `readableId` |
| `name`           | `String!`                         | |
| `description`    | `String`                          | `null` when not set |
| `role`           | [`ProjectRole!`](#projectrole)    | The role of the user the projects were asked for. Always `OWNER` from `createProject` |
| `boards`         | [`[Board!]!`](#board)             | In board order. Deleted boards are left out |
| `projectMembers` | [`[ProjectMember!]!`](#projectmember) | Sorted by user name |

`boards` and `projectMembers` are loaded with DataLoaders.

## ProjectMember

A member of a project. Returned inside [`Project`](#project), and by [`addProjectMember`](mutations/addProjectMember.md) and [`removeProjectMember`](mutations/removeProjectMember.md).

| Field       | Type                           | Notes |
| ----------- | ------------------------------ | ----- |
| `projectId` | `UUID!`                        | |
| `userId`    | `UUID!`                        | |
| `userName`  | `String!`                      | |
| `role`      | [`ProjectRole!`](#projectrole) | |
| `joinedAt`  | `DateTime!`                    | |

## Assignee

| Field      | Type     | Notes |
| ---------- | -------- | ----- |
| `id`       | `UUID!`  | The user's id |
| `userName` | `String` | |

## User

A user account. Returned by [`register`](mutations/register.md), [`me`](queries/me.md) and inside [`LoginPayload`](#loginpayload). It has no password field of any kind.

| Field   | Type      | Notes |
| ------- | --------- | ----- |
| `id`    | `UUID!`   | |
| `email` | `String!` | Also the account's user name |

## LoginPayload

Returned by [`login`](mutations/login.md).

| Field         | Type                | Notes |
| ------------- | ------------------- | ----- |
| `accessToken` | `String!`           | A JWT. Send it as `Authorization: Bearer <accessToken>` |
| `tokenType`   | `String!`           | Always `Bearer` |
| `expiresAt`   | `DateTime!`         | When the token stops working (60 minutes after login) |
| `user`        | [`User!`](#user)    | The user who logged in |

## Enums

### ColumnCategory

`BACKLOG`, `TO_DO`, `IN_PROGRESS`, `DONE`, `CANCELLED`

### TaskPriority

`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`

### ProjectRole

`READER`, `WRITER`, `OWNER`

| Role     | Who | Can do |
| -------- | --- | ------ |
| `OWNER`  | Exactly one per project: the user who created it. Can't be removed | Everything a writer can |
| `WRITER` | Added with [`addProjectMember`](mutations/addProjectMember.md) | Manage members (readers and writers), add task dependencies, read the project |
| `READER` | Added with [`addProjectMember`](mutations/addProjectMember.md) | Read the project, for example its [`backlog`](queries/backlog.md) |
