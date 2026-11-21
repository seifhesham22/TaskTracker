using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Domain.Exceptions;
using TaskTracker.API.Features.Boards.CreateBoard;
using TaskTracker.API.Features.Boards.Nodes;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.Membership;
using TaskTracker.API.Tests.Infrastructure;

namespace TaskTracker.API.Tests.Features.Boards;

[Collection(nameof(PostgresCollection))]
public class CreateBoardHandlerTests(PostgresFixture database)
{
    [Fact]
    public async Task The_owner_creates_a_board_with_the_default_columns()
    {
        var project = await GivenProjectAsync();

        var created = await CreateAsync(project, "Sprint 2");

        Assert.Equal("Sprint 2", created.Name);
        Assert.Equal(project.ProjectId, created.ProjectId);
        await using var db = database.CreateDbContext();
        var saved = await db.boards.Include(b => b.Columns).SingleAsync(b => b.Id == created.Id);
        Assert.Equal(
            new[] { "Backlog", "To do", "In progress", "Done" },
            saved.Columns.OrderBy(c => c.Position, StringComparer.Ordinal).Select(c => c.Name));
    }

    [Fact]
    public async Task New_boards_go_after_the_existing_boards_in_order()
    {
        var project = await GivenProjectAsync();

        await CreateAsync(project, "Second");
        await CreateAsync(project, "Third");

        Assert.Equal(new[] { "Board", "Second", "Third" }, await BoardNamesInOrderAsync(project));
    }

    [Fact]
    public async Task The_name_is_trimmed()
    {
        var project = await GivenProjectAsync();

        var created = await CreateAsync(project, "   Sprint 2   ");

        Assert.Equal("Sprint 2", created.Name);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task An_empty_name_is_refused_and_nothing_is_saved(string name)
    {
        var project = await GivenProjectAsync();

        var error = await Assert.ThrowsAsync<DomainException>(() => CreateAsync(project, name));

        Assert.Equal("Board name cannot be empty or only spaces.", error.Message);
        Assert.Equal(new[] { "Board" }, await BoardNamesInOrderAsync(project));
    }

    [Fact]
    public async Task A_name_longer_than_100_characters_is_refused()
    {
        var project = await GivenProjectAsync();

        var error = await Assert.ThrowsAsync<DomainException>(() => CreateAsync(project, new string('a', 101)));

        Assert.Equal("Board name cannot be longer than 100 characters.", error.Message);
    }

    [Theory]
    [InlineData("Board")]
    [InlineData("board")]
    [InlineData("  BOARD  ")]
    public async Task A_name_already_used_in_the_project_is_refused_in_any_case(string name)
    {
        var project = await GivenProjectAsync();

        var error = await Assert.ThrowsAsync<BadUserInputException>(() => CreateAsync(project, name));

        Assert.Equal($"A board named '{name.Trim()}' already exists in this project.", error.Message);
        Assert.Equal(new[] { "Board" }, await BoardNamesInOrderAsync(project));
    }

    [Fact]
    public async Task The_same_name_can_be_used_in_another_project()
    {
        var project = await GivenProjectAsync();
        var other = await GivenProjectAsync();
        await CreateAsync(other, "Sprint 2");

        var created = await CreateAsync(project, "Sprint 2");

        Assert.Equal("Sprint 2", created.Name);
    }

    [Fact]
    public async Task The_name_of_a_deleted_board_can_be_used_again()
    {
        var project = await GivenProjectAsync();
        await using (var db = database.CreateDbContext())
            await db.boards.Where(b => b.Id == project.BoardId)
                .ExecuteUpdateAsync(s => s.SetProperty(b => b.IsDeleted, true));

        var created = await CreateAsync(project, "Board");

        Assert.NotEqual(project.BoardId, created.Id);
    }

    [Theory]
    [InlineData(ProjectRole.Writer)]
    [InlineData(ProjectRole.Reader)]
    public async Task Only_the_owner_can_create_boards(ProjectRole role)
    {
        var project = await GivenProjectAsync();
        Guid memberId;
        await using (var db = database.CreateDbContext())
            memberId = await TestData.AddMemberAsync(db, project.ProjectId, role);

        var error = await Assert.ThrowsAsync<ForbiddenException>(() => CreateAsAsync(project.ProjectId, "Sprint 2", memberId));

        Assert.Equal("Only the owner of the project can create boards.", error.Message);
        Assert.Equal(new[] { "Board" }, await BoardNamesInOrderAsync(project));
    }

    [Fact]
    public async Task A_user_who_is_not_a_member_gets_not_found()
    {
        var project = await GivenProjectAsync();
        var other = await GivenProjectAsync();

        var error = await Assert.ThrowsAsync<NotFoundException>(() => CreateAsAsync(project.ProjectId, "Sprint 2", other.MemberId));

        Assert.Equal($"Project '{project.ProjectId}' was not found.", error.Message);
        Assert.Equal(new[] { "Board" }, await BoardNamesInOrderAsync(project));
    }

    [Fact]
    public async Task An_unknown_project_comes_back_as_not_found()
    {
        var project = await GivenProjectAsync();
        var projectId = Guid.NewGuid();

        var error = await Assert.ThrowsAsync<NotFoundException>(() => CreateAsAsync(projectId, "Sprint 2", project.MemberId));

        Assert.Equal($"Project '{projectId}' was not found.", error.Message);
    }

    [Fact]
    public async Task Two_boards_with_the_same_name_at_the_same_time_are_created_once()
    {
        var project = await GivenProjectAsync();

        var results = await Task.WhenAll(TryCreateAsync(project, "Sprint 2"), TryCreateAsync(project, "Sprint 2"));

        Assert.Single(results, r => r is null);
        var error = Assert.IsType<BadUserInputException>(Assert.Single(results, r => r is not null));
        Assert.Equal("A board named 'Sprint 2' already exists in this project.", error.Message);
        Assert.Equal(new[] { "Board", "Sprint 2" }, await BoardNamesInOrderAsync(project));
    }

    private async Task<Exception?> TryCreateAsync(TestProject project, string name)
    {
        try
        {
            await CreateAsync(project, name);
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

    private Task<BoardNode> CreateAsync(TestProject project, string name) =>
        CreateAsAsync(project.ProjectId, name, project.MemberId);

    private async Task<BoardNode> CreateAsAsync(Guid projectId, string name, Guid userId)
    {
        await using var db = database.CreateDbContext();
        return await new CreateBoardHandler(db, new ProjectMembershipService(database))
            .HandleAsync(new CreateBoardInput(projectId, name), userId, CancellationToken.None);
    }

    private async Task<string[]> BoardNamesInOrderAsync(TestProject project)
    {
        await using var db = database.CreateDbContext();
        var boards = await db.boards
            .Where(b => b.ProjectId == project.ProjectId && !b.IsDeleted)
            .Select(b => new { b.Name, b.Position, b.Id })
            .ToListAsync();
        return boards
            .OrderBy(b => b.Position, StringComparer.Ordinal)
            .ThenBy(b => b.Id)
            .Select(b => b.Name)
            .ToArray();
    }
}
