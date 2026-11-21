using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Features.Tasks;
using TaskTracker.API.Features.Tasks.CreateTask;
using TaskTracker.API.Features.Tasks.GetTasks;
using TaskTracker.API.Features.Tasks.MoveTask;
using TaskTracker.API.Shared.Completion;
using TaskTracker.API.Shared.Dependencies;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.Membership;
using TaskTracker.API.Shared.Positions;
using TaskTracker.API.Shared.Tasks;
using TaskTracker.API.Tests.Infrastructure;

namespace TaskTracker.API.Tests.Features.Tasks;

[Collection(nameof(PostgresCollection))]
public class MoveTaskBlockerTests(PostgresFixture database)
{
    [Fact]
    public async Task Starting_a_task_blocked_by_an_unfinished_task_is_refused_and_its_status_stays()
    {
        var project = await GivenProjectAsync();
        var a = await CreateTaskAsync(project, "Design the API");
        var b = await CreateTaskAsync(project, "Build the API");
        await BlockAsync(a, b);

        var error = await Assert.ThrowsAsync<BlockedTaskException>(() => MoveAsync(b, project.InProgressColumnId));

        Assert.Equal(
            $"{b.ReadableId} is blocked by this unfinished task: {a.ReadableId} (Design the API). It can't be started until that task is done.",
            error.Message);
        var blocker = Assert.Single(error.Blockers);
        Assert.Equal((a.Id, a.ReadableId, "Design the API"), (blocker.Id, blocker.ReadableId, blocker.Title));
        Assert.Equal(project.BacklogColumnId, await ColumnOfAsync(b));
    }

    [Fact]
    public async Task Moving_a_blocked_task_straight_to_done_is_refused_too()
    {
        var project = await GivenProjectAsync();
        var a = await CreateTaskAsync(project, "A");
        var b = await CreateTaskAsync(project, "B");
        await BlockAsync(a, b);

        await Assert.ThrowsAsync<BlockedTaskException>(() => MoveAsync(b, project.DoneColumnId));

        Assert.Equal(project.BacklogColumnId, await ColumnOfAsync(b));
    }

    [Fact]
    public async Task Every_unfinished_blocker_is_listed_in_task_order_and_finished_ones_are_not()
    {
        var project = await GivenProjectAsync();
        var first = await CreateTaskAsync(project, "First");
        var finished = await CreateTaskAsync(project, "Finished", project.DoneColumnId);
        var third = await CreateTaskAsync(project, "Third", project.InProgressColumnId);
        var blocked = await CreateTaskAsync(project, "Blocked");
        await BlockAsync(third, blocked);
        await BlockAsync(first, blocked);
        await BlockAsync(finished, blocked);

        var error = await Assert.ThrowsAsync<BlockedTaskException>(() => MoveAsync(blocked, project.InProgressColumnId));

        Assert.Equal(
            $"{blocked.ReadableId} is blocked by these 2 unfinished tasks: {first.ReadableId} (First), {third.ReadableId} (Third). " +
            "It can't be started until they are done.",
            error.Message);
        Assert.Equal(new[] { first.Id, third.Id }, error.Blockers.Select(x => x.Id));
    }

    [Fact]
    public async Task Once_every_blocker_is_done_the_task_can_be_started()
    {
        var project = await GivenProjectAsync();
        var a = await CreateTaskAsync(project, "A");
        var c = await CreateTaskAsync(project, "C");
        var b = await CreateTaskAsync(project, "B");
        await BlockAsync(a, b);
        await BlockAsync(c, b);

        await MoveAsync(a, project.DoneColumnId);
        await Assert.ThrowsAsync<BlockedTaskException>(() => MoveAsync(b, project.InProgressColumnId));
        await MoveAsync(c, project.DoneColumnId);
        var started = await MoveAsync(b, project.InProgressColumnId);

        Assert.Equal(project.InProgressColumnId, started.ColumnId);
    }

    [Fact]
    public async Task A_cancelled_blocker_still_blocks()
    {
        var project = await GivenProjectAsync();
        var cancelledColumn = await AddColumnAsync(project, ColumnCategory.Cancelled);
        var a = await CreateTaskAsync(project, "A", cancelledColumn);
        var b = await CreateTaskAsync(project, "B");
        await BlockAsync(a, b);

        var error = await Assert.ThrowsAsync<BlockedTaskException>(() => MoveAsync(b, project.InProgressColumnId));

        Assert.Equal(a.Id, Assert.Single(error.Blockers).Id);
    }

    [Fact]
    public async Task A_deleted_blocker_no_longer_blocks()
    {
        var project = await GivenProjectAsync();
        var a = await CreateTaskAsync(project, "A");
        var b = await CreateTaskAsync(project, "B");
        await BlockAsync(a, b);
        await using (var db = database.CreateDbContext())
            await db.Set<TaskItem>().Where(t => t.Id == a.Id).ExecuteUpdateAsync(s => s.SetProperty(t => t.IsDeleted, true));

        var started = await MoveAsync(b, project.InProgressColumnId);

        Assert.Equal(project.InProgressColumnId, started.ColumnId);
    }

    [Theory]
    [InlineData(ColumnCategory.ToDo)]
    [InlineData(ColumnCategory.Cancelled)]
    [InlineData(ColumnCategory.Backlog)]
    public async Task A_blocked_task_can_still_move_between_statuses_that_are_not_started(ColumnCategory category)
    {
        var project = await GivenProjectAsync();
        var toDoColumn = await AddColumnAsync(project, ColumnCategory.ToDo);
        var target = category switch
        {
            ColumnCategory.ToDo => toDoColumn,
            ColumnCategory.Backlog => project.BacklogColumnId,
            _ => await AddColumnAsync(project, category)
        };
        var a = await CreateTaskAsync(project, "A");
        var b = await CreateTaskAsync(project, "B", category == ColumnCategory.Backlog ? toDoColumn : project.BacklogColumnId);
        await BlockAsync(a, b);

        var moved = await MoveAsync(b, target);

        Assert.Equal(target, moved.ColumnId);
    }

    [Fact]
    public async Task The_task_that_blocks_others_can_be_started()
    {
        var project = await GivenProjectAsync();
        var a = await CreateTaskAsync(project, "A");
        var b = await CreateTaskAsync(project, "B");
        await BlockAsync(a, b);

        var started = await MoveAsync(a, project.InProgressColumnId);

        Assert.Equal(project.InProgressColumnId, started.ColumnId);
    }

    [Fact]
    public async Task Starting_a_task_while_its_blocker_is_completed_at_the_same_time_ends_in_a_valid_state()
    {
        var project = await GivenProjectAsync();
        var a = await CreateTaskAsync(project, "A", project.InProgressColumnId);
        var b = await CreateTaskAsync(project, "B");
        await BlockAsync(a, b);

        var results = await Task.WhenAll(TryMoveAsync(a, project.DoneColumnId), TryMoveAsync(b, project.InProgressColumnId));

        Assert.Null(results[0]);
        Assert.True(results[1] is null or BlockedTaskException, results[1]?.ToString());
        Assert.Equal(project.DoneColumnId, await ColumnOfAsync(a));
        Assert.Equal(results[1] is null ? project.InProgressColumnId : project.BacklogColumnId, await ColumnOfAsync(b));
    }

    [Fact]
    public async Task Two_tasks_of_one_project_moved_at_the_same_time_both_move()
    {
        var project = await GivenProjectAsync();
        var a = await CreateTaskAsync(project, "A");
        var b = await CreateTaskAsync(project, "B");

        var results = await Task.WhenAll(TryMoveAsync(a, project.InProgressColumnId), TryMoveAsync(b, project.DoneColumnId));

        Assert.All(results, r => Assert.Null(r));
        Assert.Equal(project.InProgressColumnId, await ColumnOfAsync(a));
        Assert.Equal(project.DoneColumnId, await ColumnOfAsync(b));
    }

    private async Task<Exception?> TryMoveAsync(TaskDto task, Guid columnId)
    {
        try
        {
            await MoveAsync(task, columnId);
            return null;
        }
        catch (Exception ex)
        {
            return ex;
        }
    }

    private async Task<TestProject> GivenProjectAsync()
    {
        await using var db = database.CreateDbContext();
        return await TestData.CreateProjectAsync(db);
    }

    private async Task<Guid> AddColumnAsync(TestProject project, ColumnCategory category)
    {
        await using var db = database.CreateDbContext();
        var column = new BoardColumn
        {
            BoardId = project.BoardId,
            Name = category.ToString(),
            Category = category,
            Color = "#8A90A0",
            Position = "z" + category
        };
        db.boardColumns.Add(column);
        await db.SaveChangesAsync();
        return column.Id;
    }

    private async Task<TaskDto> CreateTaskAsync(TestProject project, string title, Guid? columnId = null)
    {
        await using var db = database.CreateDbContext();
        return await new CreateTaskHandler(db, new TaskPositionService(db), new ProjectMembershipService(database)).HandleAsync(
            new CreateTaskInput(project.BoardId, columnId, title, null, null, null, null), project.MemberId, CancellationToken.None);
    }

    private async Task BlockAsync(TaskDto blocking, TaskDto blocked)
    {
        await using var db = database.CreateDbContext();
        db.taskDependencies.Add(new TaskDependency(blocking.Id, blocked.Id));
        await db.SaveChangesAsync();
    }

    private async Task<TaskNode> MoveAsync(TaskDto task, Guid columnId)
    {
        await using var db = database.CreateDbContext();
        var ownerId = await TestData.OwnerOfTaskAsync(db, task.Id);
        var handler = new MoveTaskHandler(
            db,
            new TaskLookupService(db, new ProjectMembershipService(database)),
            new TaskPositionService(db),
            new TaskCompletionGuard(db),
            new TaskBlockerGuard(db));
        return await handler.HandleAsync(new MoveTaskInput(task.Id, columnId), ownerId, CancellationToken.None);
    }

    private async Task<Guid> ColumnOfAsync(TaskDto task)
    {
        await using var db = database.CreateDbContext();
        return await db.Set<TaskItem>().Where(t => t.Id == task.Id).Select(t => t.ColumnId).SingleAsync();
    }
}
