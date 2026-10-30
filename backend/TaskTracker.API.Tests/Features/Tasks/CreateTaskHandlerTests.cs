using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Domain.Exceptions;
using TaskTracker.API.Features.Tasks;
using TaskTracker.API.Features.Tasks.CreateTask;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Tests.Infrastructure;

namespace TaskTracker.API.Tests.Features.Tasks;

[Collection(nameof(PostgresCollection))]
public class CreateTaskHandlerTests(PostgresFixture database)
{
    [Fact]
    public async Task Creates_a_task_with_only_a_board_and_a_title()
    {
        var project = await GivenProjectAsync();

        var task = await CreateTaskAsync(TitleOnly(project.BoardId));

        Assert.NotEqual(Guid.Empty, task.Id);
        Assert.Equal(ColumnCategory.Backlog, task.Status);
        Assert.Equal(project.BacklogColumnId, task.ColumnId);
        Assert.Equal(1, task.Number);
        Assert.Equal($"{project.Key}-1", task.ReadableId);
    }

    [Fact]
    public async Task Trims_the_title()
    {
        var project = await GivenProjectAsync();

        var task = await CreateTaskAsync(TitleOnly(project.BoardId, "   Fix login   "));

        Assert.Equal("Fix login", task.Title);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Refuses_an_empty_title(string title)
    {
        var project = await GivenProjectAsync();

        var error = await Assert.ThrowsAsync<DomainException>(() => CreateTaskAsync(TitleOnly(project.BoardId, title)));

        Assert.Equal("Title cannot be empty or only spaces.", error.Message);
    }

    [Fact]
    public async Task Refuses_a_title_longer_than_200_characters()
    {
        var project = await GivenProjectAsync();
        var tooLong = new string('x', TaskItem.TitleMaxLength + 1);

        var error = await Assert.ThrowsAsync<DomainException>(() => CreateTaskAsync(TitleOnly(project.BoardId, tooLong)));

        Assert.Equal("Title cannot be longer than 200 characters.", error.Message);
    }

    [Fact]
    public async Task Saves_and_returns_all_optional_fields()
    {
        var project = await GivenProjectAsync();
        var dueDate = new DateTimeOffset(2026, 11, 5, 0, 0, 0, TimeSpan.Zero);

        var task = await CreateTaskAsync(new CreateTaskInput(
            project.BoardId, null, "Full task", "Some details", project.MemberId, TaskPriority.High, dueDate));

        Assert.Equal("Some details", task.Description);
        Assert.Equal(project.MemberId, Assert.Single(task.AssigneeIds));
        Assert.Equal(TaskPriority.High, task.Priority);
        Assert.Equal(dueDate, task.DueDate);

        await using var db = database.CreateDbContext();
        var saved = await db.Set<TaskItem>().Include(t => t.Assignees).SingleAsync(t => t.Id == task.Id);
        Assert.Equal("Some details", saved.GetDescription());
        Assert.Equal(project.MemberId, Assert.Single(saved.Assignees).UserId);
        Assert.Equal(TaskPriority.High, saved.Priority);
        Assert.Equal(dueDate.UtcDateTime, saved.DueDate);
    }

    [Fact]
    public async Task Refuses_an_assignee_who_is_not_in_the_project()
    {
        var project = await GivenProjectAsync();
        Guid outsiderId;
        await using (var db = database.CreateDbContext())
            outsiderId = await TestData.CreateUserAsync(db);

        var error = await Assert.ThrowsAsync<BadUserInputException>(() =>
            CreateTaskAsync(TitleOnly(project.BoardId) with { AssigneeId = outsiderId }));

        Assert.Equal(
            $"User '{outsiderId}' is not a member of project {project.Key}, so they can't be assigned to this task.",
            error.Message);
    }

    [Fact]
    public async Task Returns_not_found_for_a_board_that_does_not_exist()
    {
        var boardId = Guid.NewGuid();

        var error = await Assert.ThrowsAsync<NotFoundException>(() => CreateTaskAsync(TitleOnly(boardId)));

        Assert.Equal($"Board '{boardId}' was not found.", error.Message);
    }

    [Fact]
    public async Task Gives_the_task_the_category_of_the_column_it_is_created_in()
    {
        var project = await GivenProjectAsync();

        var task = await CreateTaskAsync(TitleOnly(project.BoardId) with { ColumnId = project.InProgressColumnId });

        Assert.Equal(project.InProgressColumnId, task.ColumnId);
        Assert.Equal("In requirement state", task.ColumnName);
        Assert.Equal(ColumnCategory.InProgress, task.Status);
    }

    [Fact]
    public async Task Returns_not_found_for_a_column_of_another_board()
    {
        var project = await GivenProjectAsync();
        Guid otherColumnId;
        await using (var db = database.CreateDbContext())
            (_, otherColumnId) = await TestData.CreateBoardWithColumnAsync(db, project.ProjectId);

        var error = await Assert.ThrowsAsync<NotFoundException>(() =>
            CreateTaskAsync(TitleOnly(project.BoardId) with { ColumnId = otherColumnId }));

        Assert.Equal($"Column '{otherColumnId}' was not found on board '{project.BoardId}'.", error.Message);
    }

    [Fact]
    public async Task Refuses_a_board_without_columns()
    {
        var project = await GivenProjectAsync();
        Guid emptyBoardId;
        await using (var db = database.CreateDbContext())
            emptyBoardId = await TestData.CreateEmptyBoardAsync(db, project.ProjectId);

        var error = await Assert.ThrowsAsync<BadUserInputException>(() => CreateTaskAsync(TitleOnly(emptyBoardId)));

        Assert.Equal("This board has no columns, so the task can't get a status.", error.Message);
    }

    [Fact]
    public async Task Numbers_tasks_separately_in_each_project()
    {
        var first = await GivenProjectAsync();
        var second = await GivenProjectAsync();

        var firstTask = await CreateTaskAsync(TitleOnly(first.BoardId));
        var secondTask = await CreateTaskAsync(TitleOnly(first.BoardId));
        var otherProjectTask = await CreateTaskAsync(TitleOnly(second.BoardId));

        Assert.Equal(1, firstTask.Number);
        Assert.Equal(2, secondTask.Number);
        Assert.Equal(1, otherProjectTask.Number);
    }

    [Fact]
    public async Task Tasks_created_at_the_same_moment_get_different_numbers()
    {
        var project = await GivenProjectAsync();

        var tasks = await Task.WhenAll(Enumerable.Range(1, 20)
            .Select(i => CreateTaskAsync(TitleOnly(project.BoardId, $"Task {i}"))));

        Assert.Equal(Enumerable.Range(1, 20), tasks.Select(t => t.Number).Order());
    }

    [Fact]
    public async Task Puts_new_tasks_at_the_bottom_of_the_column()
    {
        var project = await GivenProjectAsync();

        await CreateTaskAsync(TitleOnly(project.BoardId, "First"));
        await CreateTaskAsync(TitleOnly(project.BoardId, "Second"));

        await using var db = database.CreateDbContext();
        var titlesInOrder = await db.Set<TaskItem>()
            .Where(t => t.ColumnId == project.BacklogColumnId)
            .OrderBy(t => t.Position)
            .Select(t => t.Title)
            .ToListAsync();

        Assert.Equal(new[] { "First", "Second" }, titlesInOrder);
    }

    private async Task<TestProject> GivenProjectAsync()
    {
        await using var db = database.CreateDbContext();
        return await TestData.CreateProjectAsync(db);
    }

    private async Task<TaskDto> CreateTaskAsync(CreateTaskInput input)
    {
        await using var db = database.CreateDbContext();
        return await new CreateTaskHandler(db).HandleAsync(input, CancellationToken.None);
    }

    private static CreateTaskInput TitleOnly(Guid boardId, string title = "A task") =>
        new(boardId, null, title, null, null, null, null);
}