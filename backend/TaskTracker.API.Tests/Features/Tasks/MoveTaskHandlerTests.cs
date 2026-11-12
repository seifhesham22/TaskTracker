using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Features.Tasks;
using TaskTracker.API.Features.Tasks.CreateTask;
using TaskTracker.API.Features.Tasks.GetTasks;
using TaskTracker.API.Features.Tasks.MoveTask;
using TaskTracker.API.Shared.Completion;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.Positions;
using TaskTracker.API.Tests.Infrastructure;

namespace TaskTracker.API.Tests.Features.Tasks;

[Collection(nameof(PostgresCollection))]
public class MoveTaskHandlerTests(PostgresFixture database)
{
    [Fact]
    public async Task Moves_the_task_to_another_column_of_its_board()
    {
        var project = await GivenProjectAsync();
        var task = await CreateTaskAsync(project.BoardId, "Move me");

        var moved = await MoveTaskAsync(task.Id, project.InProgressColumnId);

        Assert.Equal(task.Id, moved.Id);
        Assert.Equal(project.InProgressColumnId, moved.ColumnId);
        Assert.Equal($"{project.Key}-1", moved.ReadableId);
        await using var db = database.CreateDbContext();
        var saved = await db.Set<TaskItem>().SingleAsync(t => t.Id == task.Id);
        Assert.Equal(project.InProgressColumnId, saved.ColumnId);
    }

    [Fact]
    public async Task Puts_the_task_at_the_bottom_of_the_new_column()
    {
        var project = await GivenProjectAsync();
        await CreateTaskAsync(new CreateTaskInput(project.BoardId, project.InProgressColumnId, "Already there", null, null, null, null));
        var task = await CreateTaskAsync(project.BoardId, "Moved");

        await MoveTaskAsync(task.Id, project.InProgressColumnId);

        await using var db = database.CreateDbContext();
        var titlesInOrder = await db.Set<TaskItem>()
            .Where(t => t.ColumnId == project.InProgressColumnId)
            .OrderBy(t => t.Position)
            .Select(t => t.Title)
            .ToListAsync();
        Assert.Equal(new[] { "Already there", "Moved" }, titlesInOrder);
    }

    [Fact]
    public async Task Moving_a_task_to_the_column_it_is_in_changes_nothing()
    {
        var project = await GivenProjectAsync();
        var task = await CreateTaskAsync(project.BoardId, "Stay");
        string positionBefore;
        await using (var db = database.CreateDbContext())
            positionBefore = (await db.Set<TaskItem>().SingleAsync(t => t.Id == task.Id)).Position;

        var moved = await MoveTaskAsync(task.Id, project.BacklogColumnId);

        Assert.Equal(project.BacklogColumnId, moved.ColumnId);
        Assert.Equal(positionBefore, moved.Position);
    }

    [Fact]
    public async Task Returns_not_found_for_a_task_that_does_not_exist()
    {
        var project = await GivenProjectAsync();
        var taskId = Guid.NewGuid();

        var error = await Assert.ThrowsAsync<NotFoundException>(() => MoveTaskAsync(taskId, project.InProgressColumnId));

        Assert.Equal($"Task '{taskId}' was not found.", error.Message);
    }

    [Fact]
    public async Task Returns_not_found_for_a_column_of_another_board_and_leaves_the_task_where_it_was()
    {
        var project = await GivenProjectAsync();
        Guid otherColumnId;
        await using (var db = database.CreateDbContext())
            (_, otherColumnId) = await TestData.CreateBoardWithColumnAsync(db, project.ProjectId);
        var task = await CreateTaskAsync(project.BoardId, "Stay on my board");

        var error = await Assert.ThrowsAsync<NotFoundException>(() => MoveTaskAsync(task.Id, otherColumnId));

        Assert.Equal($"Column '{otherColumnId}' was not found on board '{project.BoardId}'.", error.Message);
        await using var check = database.CreateDbContext();
        Assert.Equal(project.BacklogColumnId, (await check.Set<TaskItem>().SingleAsync(t => t.Id == task.Id)).ColumnId);
    }

    [Fact]
    public async Task Refuses_to_complete_a_parent_with_an_incomplete_subtask_and_names_it()
    {
        var project = await GivenProjectAsync();
        var parent = await CreateTaskAsync(project.BoardId, "Parent");
        var child = await CreateSubtaskAsync(project.BoardId, parent.Id, "Write tests");

        var error = await Assert.ThrowsAsync<IncompleteSubtasksException>(() => MoveTaskAsync(parent.Id, project.DoneColumnId));

        Assert.Equal(
            $"{parent.ReadableId} can't be completed while this subtask is not done: {child.ReadableId} (Write tests).",
            error.Message);
        var open = Assert.Single(error.Subtasks);
        Assert.Equal(new IncompleteSubtask(child.Id, child.ReadableId, "Write tests"), open);
        Assert.Equal(project.BacklogColumnId, await SavedColumnAsync(parent.Id));
    }

    [Fact]
    public async Task Names_every_incomplete_subtask_and_only_those()
    {
        var project = await GivenProjectAsync();
        var parent = await CreateTaskAsync(project.BoardId, "Parent");
        var first = await CreateSubtaskAsync(project.BoardId, parent.Id, "First");
        var done = await CreateSubtaskAsync(project.BoardId, parent.Id, "Already done");
        var third = await CreateSubtaskAsync(project.BoardId, parent.Id, "Third");
        await MoveTaskAsync(done.Id, project.DoneColumnId);

        var error = await Assert.ThrowsAsync<IncompleteSubtasksException>(() => MoveTaskAsync(parent.Id, project.DoneColumnId));

        Assert.Equal(new[] { first.ReadableId, third.ReadableId }, error.Subtasks.Select(s => s.ReadableId));
        Assert.Equal(
            $"{parent.ReadableId} can't be completed while these 2 subtasks are not done: {first.ReadableId} (First), {third.ReadableId} (Third).",
            error.Message);
    }

    [Fact]
    public async Task Completes_the_parent_once_every_subtask_is_done()
    {
        var project = await GivenProjectAsync();
        var parent = await CreateTaskAsync(project.BoardId, "Parent");
        var first = await CreateSubtaskAsync(project.BoardId, parent.Id, "First");
        var second = await CreateSubtaskAsync(project.BoardId, parent.Id, "Second");
        await MoveTaskAsync(first.Id, project.DoneColumnId);
        await MoveTaskAsync(second.Id, project.DoneColumnId);

        var moved = await MoveTaskAsync(parent.Id, project.DoneColumnId);

        Assert.Equal(project.DoneColumnId, moved.ColumnId);
        Assert.Equal(project.DoneColumnId, await SavedColumnAsync(parent.Id));
    }

    [Fact]
    public async Task Completes_a_task_that_has_no_subtasks()
    {
        var project = await GivenProjectAsync();
        var task = await CreateTaskAsync(project.BoardId, "No subtasks");

        var moved = await MoveTaskAsync(task.Id, project.DoneColumnId);

        Assert.Equal(project.DoneColumnId, moved.ColumnId);
    }

    [Fact]
    public async Task Moving_a_parent_to_a_column_that_is_not_done_ignores_its_subtasks()
    {
        var project = await GivenProjectAsync();
        var parent = await CreateTaskAsync(project.BoardId, "Parent");
        await CreateSubtaskAsync(project.BoardId, parent.Id, "Still open");

        var moved = await MoveTaskAsync(parent.Id, project.InProgressColumnId);

        Assert.Equal(project.InProgressColumnId, moved.ColumnId);
    }

    [Fact]
    public async Task A_subtask_on_another_board_of_the_project_still_blocks_its_parent()
    {
        var project = await GivenProjectAsync();
        Guid otherBoardId;
        await using (var db = database.CreateDbContext())
            (otherBoardId, _) = await TestData.CreateBoardWithColumnAsync(db, project.ProjectId);
        var parent = await CreateTaskAsync(project.BoardId, "Parent");
        var child = await CreateSubtaskAsync(otherBoardId, parent.Id, "Elsewhere");

        var error = await Assert.ThrowsAsync<IncompleteSubtasksException>(() => MoveTaskAsync(parent.Id, project.DoneColumnId));

        Assert.Equal(child.ReadableId, Assert.Single(error.Subtasks).ReadableId);
    }

    private Task<TaskDto> CreateSubtaskAsync(Guid boardId, Guid parentId, string title) =>
        CreateTaskAsync(new CreateTaskInput(boardId, null, title, null, null, null, null, parentId));

    private async Task<Guid> SavedColumnAsync(Guid taskId)
    {
        await using var db = database.CreateDbContext();
        return (await db.Set<TaskItem>().SingleAsync(t => t.Id == taskId)).ColumnId;
    }

    private async Task<TestProject> GivenProjectAsync()
    {
        await using var db = database.CreateDbContext();
        return await TestData.CreateProjectAsync(db);
    }

    private Task<TaskDto> CreateTaskAsync(Guid boardId, string title) =>
        CreateTaskAsync(new CreateTaskInput(boardId, null, title, null, null, null, null));

    private async Task<TaskDto> CreateTaskAsync(CreateTaskInput input)
    {
        await using var db = database.CreateDbContext();
        return await new CreateTaskHandler(db, new TaskPositionService(db)).HandleAsync(input, CancellationToken.None);
    }

    private async Task<TaskNode> MoveTaskAsync(Guid taskId, Guid columnId)
    {
        await using var db = database.CreateDbContext();
        return await new MoveTaskHandler(db, new TaskPositionService(db), new TaskCompletionGuard(db)).HandleAsync(new MoveTaskInput(taskId, columnId), CancellationToken.None);
    }
}