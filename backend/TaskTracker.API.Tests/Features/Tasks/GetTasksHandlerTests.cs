using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Features.Tasks;
using TaskTracker.API.Features.Tasks.CreateTask;
using TaskTracker.API.Features.Tasks.GetTasks;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.Positions;
using TaskTracker.API.Tests.Infrastructure;

namespace TaskTracker.API.Tests.Features.Tasks;

[Collection(nameof(PostgresCollection))]
public class GetTasksHandlerTests(PostgresFixture database)
{
    [Fact]
    public async Task Returns_an_empty_list_for_a_board_without_tasks()
    {
        var project = await GivenProjectAsync();

        var tasks = await GetTasksAsync(boardId: project.BoardId);

        Assert.Empty(tasks);
    }

    [Fact]
    public async Task Returns_the_tasks_of_the_board_in_the_order_they_were_created()
    {
        var project = await GivenProjectAsync();
        await CreateTaskAsync(project.BoardId, "First");
        await CreateTaskAsync(project.BoardId, "Second");

        var tasks = await GetTasksAsync(boardId: project.BoardId);

        Assert.Equal(new[] { "First", "Second" }, tasks.Select(t => t.Title));
        Assert.Equal(new[] { $"{project.Key}-1", $"{project.Key}-2" }, tasks.Select(t => t.ReadableId));
    }

    [Fact]
    public async Task Returns_every_field_of_a_task()
    {
        var project = await GivenProjectAsync();
        var dueDate = new DateTimeOffset(2026, 11, 5, 0, 0, 0, TimeSpan.Zero);
        var created = await CreateTaskAsync(new CreateTaskInput(
            project.BoardId, null, "Full task", "Some details", project.MemberId, TaskPriority.High, dueDate));

        var task = Assert.Single(await GetTasksAsync(boardId: project.BoardId));

        Assert.Equal(created.Id, task.Id);
        Assert.Equal("Full task", task.Title);
        Assert.Equal("Some details", task.Description);
        Assert.Equal(TaskPriority.High, task.Priority);
        Assert.Equal(dueDate.UtcDateTime, task.DueDate);
        Assert.Equal(project.BoardId, task.BoardId);
        Assert.Equal(project.BacklogColumnId, task.ColumnId);
    }

    [Fact]
    public async Task Leaves_the_fields_that_were_not_set_empty()
    {
        var project = await GivenProjectAsync();
        await CreateTaskAsync(project.BoardId, "Title only");

        var task = Assert.Single(await GetTasksAsync(boardId: project.BoardId));

        Assert.Null(task.Description);
        Assert.Null(task.Priority);
        Assert.Null(task.DueDate);
    }

    [Fact]
    public async Task Does_not_return_the_tasks_of_another_board()
    {
        var project = await GivenProjectAsync();
        Guid otherBoardId;
        await using (var db = database.CreateDbContext())
            (otherBoardId, _) = await TestData.CreateBoardWithColumnAsync(db, project.ProjectId);
        await CreateTaskAsync(project.BoardId, "Mine");
        await CreateTaskAsync(otherBoardId, "Other board");

        var tasks = await GetTasksAsync(boardId: project.BoardId);

        Assert.Equal("Mine", Assert.Single(tasks).Title);
    }

    [Fact]
    public async Task Returns_the_tasks_of_all_boards_when_no_board_is_given()
    {
        var first = await GivenProjectAsync();
        var second = await GivenProjectAsync();
        var firstTask = await CreateTaskAsync(first.BoardId, "First project");
        var secondTask = await CreateTaskAsync(second.BoardId, "Second project");

        var ids = (await GetTasksAsync()).Select(t => t.Id).ToList();

        Assert.Contains(firstTask.Id, ids);
        Assert.Contains(secondTask.Id, ids);
    }

    [Fact]
    public async Task Returns_not_found_for_a_board_that_does_not_exist()
    {
        var boardId = Guid.NewGuid();

        var error = await Assert.ThrowsAsync<NotFoundException>(() => GetTasksAsync(boardId: boardId));

        Assert.Equal($"Board '{boardId}' was not found.", error.Message);
    }

    [Fact]
    public async Task Returns_the_parent_of_each_subtask()
    {
        var project = await GivenProjectAsync();
        var parent = await CreateTaskAsync(project.BoardId, "Parent");
        await CreateTaskAsync(new CreateTaskInput(project.BoardId, null, "Child", null, null, null, null, parent.Id));

        var tasks = await GetTasksAsync(boardId: project.BoardId);

        Assert.Null(tasks.Single(t => t.Title == "Parent").ParentTaskId);
        Assert.Equal(parent.Id, tasks.Single(t => t.Title == "Child").ParentTaskId);
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

    private Task<IReadOnlyList<TaskNode>> GetTasksAsync(Guid? boardId = null) =>
        new GetTasksHandler(database).HandleAsync(boardId, CancellationToken.None);
}