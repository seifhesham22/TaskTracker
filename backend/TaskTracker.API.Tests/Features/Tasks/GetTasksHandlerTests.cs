using System.Linq.Expressions;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Features.Tasks;
using TaskTracker.API.Features.Tasks.CreateTask;
using TaskTracker.API.Features.Tasks.GetTasks;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.Positions;
using TaskTracker.API.Shared.Membership;
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
    public async Task Without_a_board_returns_the_tasks_of_every_project_of_the_user_and_no_others()
    {
        var mine = await GivenProjectAsync();
        var shared = await GivenProjectAsync();
        var theirs = await GivenProjectAsync();
        await using (var db = database.CreateDbContext())
            await TestData.AddMemberAsync(db, shared.ProjectId, ProjectRole.Reader, mine.MemberId);
        var myTask = await CreateTaskAsync(mine.BoardId, "Mine");
        var sharedTask = await CreateTaskAsync(shared.BoardId, "Shared with me");
        await CreateTaskAsync(theirs.BoardId, "Not mine");

        var ids = (await GetTasksAsync(userId: mine.MemberId)).Select(t => t.Id).ToList();

        Assert.Equal(new[] { myTask.Id, sharedTask.Id }.Order(), ids.Order());
    }

    [Fact]
    public async Task A_user_who_is_not_a_member_of_the_board_gets_not_found()
    {
        var project = await GivenProjectAsync();
        var other = await GivenProjectAsync();
        await CreateTaskAsync(project.BoardId, "Private");

        var error = await Assert.ThrowsAsync<NotFoundException>(
            () => GetTasksAsync(boardId: project.BoardId, userId: other.MemberId));

        Assert.Equal($"Board '{project.BoardId}' was not found.", error.Message);
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

    [Fact]
    public async Task Search_finds_the_board_tasks_whose_title_contains_the_text_in_any_case()
    {
        var project = await GivenProjectAsync();
        await CreateTaskAsync(project.BoardId, "Fix the LOGIN bug");
        await CreateTaskAsync(project.BoardId, "Design the login page");
        await CreateTaskAsync(project.BoardId, "Write the docs");

        var tasks = await GetTasksAsync(boardId: project.BoardId, search: "  Login ");

        Assert.Equal(new[] { "Fix the LOGIN bug", "Design the login page" }, tasks.Select(t => t.Title));
    }

    [Fact]
    public async Task Search_and_filters_combine_and_only_matching_tasks_are_returned()
    {
        var project = await GivenProjectAsync();
        await CreateTaskAsync(new CreateTaskInput(project.BoardId, null, "Login API", null, null, TaskPriority.High, null));
        await CreateTaskAsync(new CreateTaskInput(project.BoardId, null, "Login page", null, null, TaskPriority.Low, null));
        await CreateTaskAsync(new CreateTaskInput(project.BoardId, null, "Signup API", null, null, TaskPriority.High, null));

        var tasks = await GetTasksAsync(boardId: project.BoardId, search: "login", where: t => t.Priority == TaskPriority.High);

        Assert.Equal("Login API", Assert.Single(tasks).Title);
    }

    [Fact]
    public async Task A_search_without_match_returns_an_empty_list_and_no_search_returns_everything()
    {
        var project = await GivenProjectAsync();
        await CreateTaskAsync(project.BoardId, "First");
        await CreateTaskAsync(project.BoardId, "Second");

        Assert.Empty(await GetTasksAsync(boardId: project.BoardId, search: "nothing like this"));
        Assert.Equal(2, (await GetTasksAsync(boardId: project.BoardId, search: "   ")).Count);
        Assert.Equal(2, (await GetTasksAsync(boardId: project.BoardId)).Count);
    }

    [Fact]
    public async Task Search_and_filters_never_show_tasks_of_another_board()
    {
        var project = await GivenProjectAsync();
        Guid otherBoardId;
        await using (var db = database.CreateDbContext())
            (otherBoardId, _) = await TestData.CreateBoardWithColumnAsync(db, project.ProjectId);
        await CreateTaskAsync(project.BoardId, "Login on this board");
        await CreateTaskAsync(otherBoardId, "Login on the other board");

        var tasks = await GetTasksAsync(boardId: project.BoardId, search: "login", where: t => t.Priority == null);

        Assert.Equal("Login on this board", Assert.Single(tasks).Title);
    }

    [Fact]
    public async Task A_user_who_is_not_a_member_gets_not_found_even_with_a_search()
    {
        var project = await GivenProjectAsync();
        var other = await GivenProjectAsync();
        await CreateTaskAsync(project.BoardId, "Secret plan");

        var error = await Assert.ThrowsAsync<NotFoundException>(
            () => GetTasksAsync(boardId: project.BoardId, userId: other.MemberId, search: "secret"));

        Assert.Equal($"Board '{project.BoardId}' was not found.", error.Message);
    }

    [Fact]
    public async Task A_search_longer_than_a_title_can_be_is_refused()
    {
        var project = await GivenProjectAsync();

        var error = await Assert.ThrowsAsync<BadUserInputException>(
            () => GetTasksAsync(boardId: project.BoardId, search: new string('a', TaskItem.TitleMaxLength + 1)));

        Assert.Equal("Search cannot be longer than 200 characters.", error.Message);
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
        return await new CreateTaskHandler(db, new TaskPositionService(db), new ProjectMembershipService(database)).HandleAsync(input, await TestData.OwnerOfBoardAsync(db, input.BoardId), CancellationToken.None);
    }

    private async Task<IReadOnlyList<TaskNode>> GetTasksAsync(
        Guid? boardId = null,
        Guid? userId = null,
        string? search = null,
        Expression<Func<TaskItem, bool>>? where = null)
    {
        await using var db = database.CreateDbContext();
        var reader = userId ?? await TestData.OwnerOfBoardAsync(db, boardId ?? Guid.Empty);
        return await new GetTasksHandler(database, new ProjectMembershipService(database))
            .HandleAsync(boardId, reader, search, where, CancellationToken.None);
    }
}