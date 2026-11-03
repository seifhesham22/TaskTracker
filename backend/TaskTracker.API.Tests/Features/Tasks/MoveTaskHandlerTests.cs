using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Features.Tasks;
using TaskTracker.API.Features.Tasks.CreateTask;
using TaskTracker.API.Features.Tasks.GetTasks;
using TaskTracker.API.Features.Tasks.MoveTask;
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
        return await new MoveTaskHandler(db, new TaskPositionService(db)).HandleAsync(new MoveTaskInput(taskId, columnId), CancellationToken.None);
    }
}