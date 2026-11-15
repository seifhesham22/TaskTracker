using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Features.Tasks;
using TaskTracker.API.Features.Tasks.CreateTask;
using TaskTracker.API.Features.Tasks.GetBacklog;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.Positions;
using TaskTracker.API.Shared.Membership;
using TaskTracker.API.Tests.Infrastructure;

namespace TaskTracker.API.Tests.Features.Tasks;

[Collection(nameof(PostgresCollection))]
public class GetBacklogHandlerTests(PostgresFixture database)
{
    [Fact]
    public async Task Lists_the_tasks_board_by_board_column_by_column_in_their_position_order()
    {
        var project = await GivenProjectAsync();
        var otherBoard = await GivenOtherBoardAsync(project);
        await CreateTaskAsync(project.BoardId, "Done 1", project.DoneColumnId);
        await CreateTaskAsync(otherBoard.BoardId, "Other board 1", otherBoard.ColumnId);
        await CreateTaskAsync(project.BoardId, "Backlog 1", project.BacklogColumnId);
        await CreateTaskAsync(project.BoardId, "In progress 1", project.InProgressColumnId);
        await CreateTaskAsync(project.BoardId, "Backlog 2", project.BacklogColumnId);

        var backlog = await GetBacklogAsync(project);

        Assert.Equal(
            new[] { "Backlog 1", "Backlog 2", "In progress 1", "Done 1", "Other board 1" },
            backlog.Items.Select(t => t.Title));
    }

    [Fact]
    public async Task Lists_only_the_tasks_of_the_selected_project()
    {
        var mine = await GivenProjectAsync();
        var other = await GivenProjectAsync();
        await CreateTaskAsync(mine.BoardId, "Mine");
        await CreateTaskAsync(other.BoardId, "Not mine");

        var backlog = await GetBacklogAsync(mine);

        var task = Assert.Single(backlog.Items);
        Assert.Equal("Mine", task.Title);
        Assert.Equal($"{mine.Key}-1", task.ReadableId);
        Assert.Equal(1, backlog.TotalCount);
    }

    [Fact]
    public async Task Leaves_out_the_tasks_of_a_deleted_board()
    {
        var project = await GivenProjectAsync();
        var deletedBoard = await GivenOtherBoardAsync(project);
        await CreateTaskAsync(project.BoardId, "Kept");
        await CreateTaskAsync(deletedBoard.BoardId, "On a deleted board", deletedBoard.ColumnId);
        await using (var db = database.CreateDbContext())
            await db.boards.Where(b => b.Id == deletedBoard.BoardId)
                .ExecuteUpdateAsync(s => s.SetProperty(b => b.IsDeleted, true));

        var backlog = await GetBacklogAsync(project);

        Assert.Equal("Kept", Assert.Single(backlog.Items).Title);
        Assert.Equal(1, backlog.TotalCount);
    }

    [Fact]
    public async Task Search_finds_the_titles_that_contain_the_text_in_any_case()
    {
        var project = await GivenProjectAsync();
        await CreateTaskAsync(project.BoardId, "Fix the LOGIN bug");
        await CreateTaskAsync(project.BoardId, "Design the login page");
        await CreateTaskAsync(project.BoardId, "Write the docs");

        var backlog = await GetBacklogAsync(project, search: "  Login ");

        Assert.Equal(new[] { "Fix the LOGIN bug", "Design the login page" }, backlog.Items.Select(t => t.Title));
        Assert.Equal(2, backlog.TotalCount);
    }

    [Theory]
    [InlineData("100%", "100% done")]
    [InlineData("a_b", "a_b")]
    [InlineData(@"C:\temp", @"C:\temp")]
    public async Task Search_treats_wildcards_as_plain_characters(string search, string expected)
    {
        var project = await GivenProjectAsync();
        foreach (var title in new[] { "100% done", "100 done", "a_b", "axb", @"C:\temp", "C:temp" })
            await CreateTaskAsync(project.BoardId, title);

        var backlog = await GetBacklogAsync(project, search: search);

        Assert.Equal(expected, Assert.Single(backlog.Items).Title);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task An_empty_search_lists_every_task(string? search)
    {
        var project = await GivenProjectAsync();
        await CreateTaskAsync(project.BoardId, "First");
        await CreateTaskAsync(project.BoardId, "Second");

        var backlog = await GetBacklogAsync(project, search: search);

        Assert.Equal(2, backlog.TotalCount);
    }

    [Fact]
    public async Task Filters_by_status()
    {
        var project = await GivenProjectAsync();
        await CreateTaskAsync(project.BoardId, "Waiting", project.BacklogColumnId);
        await CreateTaskAsync(project.BoardId, "Working", project.InProgressColumnId);
        await CreateTaskAsync(project.BoardId, "Finished", project.DoneColumnId);

        var backlog = await GetBacklogAsync(project, where: t => t.Column.Category == ColumnCategory.InProgress);

        Assert.Equal("Working", Assert.Single(backlog.Items).Title);
    }

    [Fact]
    public async Task Filters_by_priority()
    {
        var project = await GivenProjectAsync();
        await CreateTaskAsync(project.BoardId, "Low", priority: TaskPriority.Low);
        await CreateTaskAsync(project.BoardId, "High", priority: TaskPriority.High);
        await CreateTaskAsync(project.BoardId, "Critical", priority: TaskPriority.Critical);

        var backlog = await GetBacklogAsync(
            project,
            where: t => t.Priority == TaskPriority.High || t.Priority == TaskPriority.Critical);

        Assert.Equal(new[] { "High", "Critical" }, backlog.Items.Select(t => t.Title));
    }

    [Fact]
    public async Task Combines_the_search_with_the_filters_and_counts_only_what_matches()
    {
        var project = await GivenProjectAsync();
        await CreateTaskAsync(project.BoardId, "Login API", project.InProgressColumnId, TaskPriority.High);
        await CreateTaskAsync(project.BoardId, "Login page", project.InProgressColumnId, TaskPriority.Low);
        await CreateTaskAsync(project.BoardId, "Login tests", project.DoneColumnId, TaskPriority.High);
        await CreateTaskAsync(project.BoardId, "Signup API", project.InProgressColumnId, TaskPriority.High);

        var backlog = await GetBacklogAsync(
            project,
            search: "login",
            where: t => t.Column.Category == ColumnCategory.InProgress && t.Priority == TaskPriority.High);

        Assert.Equal("Login API", Assert.Single(backlog.Items).Title);
        Assert.Equal(1, backlog.TotalCount);
    }

    [Fact]
    public async Task Pages_go_through_every_task_once_in_the_same_order()
    {
        var project = await GivenProjectAsync();
        var titles = new[] { "One", "Two", "Three", "Four", "Five" };
        foreach (var title in titles)
            await CreateTaskAsync(project.BoardId, title);

        var first = await GetBacklogAsync(project, page: 1, pageSize: 2);
        var second = await GetBacklogAsync(project, page: 2, pageSize: 2);
        var third = await GetBacklogAsync(project, page: 3, pageSize: 2);

        Assert.Equal(new[] { "One", "Two" }, first.Items.Select(t => t.Title));
        Assert.Equal(new[] { "Three", "Four" }, second.Items.Select(t => t.Title));
        Assert.Equal(new[] { "Five" }, third.Items.Select(t => t.Title));
        Assert.Equal(titles, first.Items.Concat(second.Items).Concat(third.Items).Select(t => t.Title));
    }

    [Fact]
    public async Task Each_page_tells_the_total_and_where_it_is()
    {
        var project = await GivenProjectAsync();
        foreach (var title in new[] { "One", "Two", "Three", "Four", "Five" })
            await CreateTaskAsync(project.BoardId, title);

        var first = await GetBacklogAsync(project, page: 1, pageSize: 2);
        var middle = await GetBacklogAsync(project, page: 2, pageSize: 2);
        var last = await GetBacklogAsync(project, page: 3, pageSize: 2);

        Assert.All(new[] { first, middle, last }, p =>
        {
            Assert.Equal(5, p.TotalCount);
            Assert.Equal(3, p.TotalPages);
            Assert.Equal(2, p.PageSize);
        });
        Assert.Equal((1, false, true), (first.Page, first.HasPreviousPage, first.HasNextPage));
        Assert.Equal((2, true, true), (middle.Page, middle.HasPreviousPage, middle.HasNextPage));
        Assert.Equal((3, true, false), (last.Page, last.HasPreviousPage, last.HasNextPage));
    }

    [Fact]
    public async Task A_page_after_the_last_one_is_empty_but_keeps_the_total()
    {
        var project = await GivenProjectAsync();
        await CreateTaskAsync(project.BoardId, "Only");

        var backlog = await GetBacklogAsync(project, page: 5, pageSize: 10);

        Assert.Empty(backlog.Items);
        Assert.Equal(1, backlog.TotalCount);
        Assert.Equal(1, backlog.TotalPages);
        Assert.False(backlog.HasNextPage);
    }

    [Fact]
    public async Task A_project_without_tasks_has_an_empty_first_page()
    {
        var project = await GivenProjectAsync();

        var backlog = await GetBacklogAsync(project);

        Assert.Empty(backlog.Items);
        Assert.Equal(0, backlog.TotalCount);
        Assert.Equal(0, backlog.TotalPages);
        Assert.Equal(1, backlog.Page);
        Assert.Equal(GetBacklogHandler.DefaultPageSize, backlog.PageSize);
        Assert.False(backlog.HasNextPage);
        Assert.False(backlog.HasPreviousPage);
    }

    [Fact]
    public async Task A_page_size_of_100_is_allowed()
    {
        var project = await GivenProjectAsync();
        await CreateTaskAsync(project.BoardId, "Only");

        var backlog = await GetBacklogAsync(project, pageSize: GetBacklogHandler.MaxPageSize);

        Assert.Single(backlog.Items);
    }

    [Theory]
    [InlineData(0, 20, "Page must be 1 or more.")]
    [InlineData(-1, 20, "Page must be 1 or more.")]
    [InlineData(1, 0, "Page size must be between 1 and 100.")]
    [InlineData(1, 101, "Page size must be between 1 and 100.")]
    public async Task A_wrong_page_or_page_size_is_refused(int page, int pageSize, string message)
    {
        var project = await GivenProjectAsync();

        var error = await Assert.ThrowsAsync<BadUserInputException>(
            () => GetBacklogAsync(project, page: page, pageSize: pageSize));

        Assert.Equal(message, error.Message);
    }

    [Fact]
    public async Task A_search_longer_than_a_title_can_be_is_refused()
    {
        var project = await GivenProjectAsync();

        var error = await Assert.ThrowsAsync<BadUserInputException>(
            () => GetBacklogAsync(project, search: new string('a', TaskItem.TitleMaxLength + 1)));

        Assert.Equal("Search cannot be longer than 200 characters.", error.Message);
    }

    [Fact]
    public async Task An_unknown_project_comes_back_as_not_found()
    {
        var project = await GivenProjectAsync();
        var projectId = Guid.NewGuid();

        var error = await Assert.ThrowsAsync<NotFoundException>(() => GetBacklogAsync(projectId, project.MemberId));

        Assert.Equal($"Project '{projectId}' was not found.", error.Message);
    }

    [Fact]
    public async Task A_user_who_is_not_a_member_gets_not_found_as_if_the_project_did_not_exist()
    {
        var project = await GivenProjectAsync();
        await CreateTaskAsync(project.BoardId, "Private");
        Guid outsiderId;
        await using (var db = database.CreateDbContext())
            outsiderId = await TestData.CreateUserAsync(db);

        var error = await Assert.ThrowsAsync<NotFoundException>(() => GetBacklogAsync(project.ProjectId, outsiderId));

        Assert.Equal($"Project '{project.ProjectId}' was not found.", error.Message);
    }

    [Fact]
    public async Task A_member_of_another_project_gets_not_found()
    {
        var mine = await GivenProjectAsync();
        var theirs = await GivenProjectAsync();
        await CreateTaskAsync(theirs.BoardId, "Theirs");

        var error = await Assert.ThrowsAsync<NotFoundException>(() => GetBacklogAsync(theirs.ProjectId, mine.MemberId));

        Assert.Equal($"Project '{theirs.ProjectId}' was not found.", error.Message);
    }

    [Theory]
    [InlineData(ProjectRole.Reader)]
    [InlineData(ProjectRole.Writer)]
    [InlineData(ProjectRole.Owner)]
    public async Task Every_member_can_read_the_backlog_whatever_their_role(ProjectRole role)
    {
        var project = await GivenProjectAsync();
        await CreateTaskAsync(project.BoardId, "Shared");
        Guid memberId;
        await using (var db = database.CreateDbContext())
            memberId = await TestData.AddMemberAsync(db, project.ProjectId, role);

        var backlog = await GetBacklogAsync(project.ProjectId, memberId);

        Assert.Equal("Shared", Assert.Single(backlog.Items).Title);
    }

    [Fact]
    public async Task A_deleted_project_comes_back_as_not_found_even_for_a_member()
    {
        var project = await GivenProjectAsync();
        await CreateTaskAsync(project.BoardId, "In a deleted project");
        await using (var db = database.CreateDbContext())
            await db.projects.Where(p => p.Id == project.ProjectId)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.IsDeleted, true));

        var error = await Assert.ThrowsAsync<NotFoundException>(() => GetBacklogAsync(project));

        Assert.Equal($"Project '{project.ProjectId}' was not found.", error.Message);
    }

    private async Task<TestProject> GivenProjectAsync()
    {
        await using var db = database.CreateDbContext();
        return await TestData.CreateProjectAsync(db);
    }

    private async Task<(Guid BoardId, Guid ColumnId)> GivenOtherBoardAsync(TestProject project)
    {
        await using var db = database.CreateDbContext();
        return await TestData.CreateBoardWithColumnAsync(db, project.ProjectId);
    }

    private async Task<TaskDto> CreateTaskAsync(
        Guid boardId, string title, Guid? columnId = null, TaskPriority? priority = null)
    {
        await using var db = database.CreateDbContext();
        return await new CreateTaskHandler(db, new TaskPositionService(db), new ProjectMembershipService(database)).HandleAsync(
            new CreateTaskInput(boardId, columnId, title, null, null, priority, null),
            CancellationToken.None);
    }

    private Task<BacklogPage> GetBacklogAsync(
        TestProject project,
        string? search = null,
        Expression<Func<TaskItem, bool>>? where = null,
        int page = 1,
        int pageSize = GetBacklogHandler.DefaultPageSize) =>
        GetBacklogAsync(project.ProjectId, project.MemberId, search, where, page, pageSize);

    private Task<BacklogPage> GetBacklogAsync(
        Guid projectId,
        Guid userId,
        string? search = null,
        Expression<Func<TaskItem, bool>>? where = null,
        int page = 1,
        int pageSize = GetBacklogHandler.DefaultPageSize) =>
        new GetBacklogHandler(database, new ProjectMembershipService(database)).HandleAsync(
            projectId, userId, search, where, page, pageSize, CancellationToken.None);
}
