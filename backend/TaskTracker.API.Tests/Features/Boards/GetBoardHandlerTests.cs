using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Features.Boards.GetBoard;
using TaskTracker.API.Features.Boards.Nodes;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.Membership;
using TaskTracker.API.Tests.Infrastructure;

namespace TaskTracker.API.Tests.Features.Boards;

[Collection(nameof(PostgresCollection))]
public class GetBoardHandlerTests(PostgresFixture database)
{
    [Fact]
    public async Task Returns_the_board_with_its_name_and_project()
    {
        var project = await GivenProjectAsync();

        var board = await GetBoardAsync(project.BoardId);

        Assert.Equal(project.BoardId, board.Id);
        Assert.Equal(project.ProjectId, board.ProjectId);
        Assert.Equal("Board", board.Name);
    }

    [Fact]
    public async Task Returns_not_found_for_a_board_that_does_not_exist()
    {
        var boardId = Guid.NewGuid();

        var error = await Assert.ThrowsAsync<NotFoundException>(() => GetBoardAsync(boardId));

        Assert.Equal($"Board '{boardId}' was not found.", error.Message);
    }

    [Fact]
    public async Task Returns_not_found_for_a_deleted_board()
    {
        var project = await GivenProjectAsync();
        await using (var db = database.CreateDbContext())
            await db.boards
                .Where(b => b.Id == project.BoardId)
                .ExecuteUpdateAsync(s => s.SetProperty(b => b.IsDeleted, true));

        var error = await Assert.ThrowsAsync<NotFoundException>(() => GetBoardAsync(project.BoardId));

        Assert.Equal($"Board '{project.BoardId}' was not found.", error.Message);
    }

    [Fact]
    public async Task A_reader_can_open_the_board()
    {
        var project = await GivenProjectAsync();
        Guid readerId;
        await using (var db = database.CreateDbContext())
            readerId = await TestData.AddMemberAsync(db, project.ProjectId, ProjectRole.Reader);

        var board = await GetBoardAsync(project.BoardId, readerId);

        Assert.Equal(project.BoardId, board.Id);
    }

    [Fact]
    public async Task A_user_who_is_not_a_member_gets_not_found()
    {
        var project = await GivenProjectAsync();
        var other = await GivenProjectAsync();

        var error = await Assert.ThrowsAsync<NotFoundException>(() => GetBoardAsync(project.BoardId, other.MemberId));

        Assert.Equal($"Board '{project.BoardId}' was not found.", error.Message);
    }

    private async Task<TestProject> GivenProjectAsync()
    {
        await using var db = database.CreateDbContext();
        return await TestData.CreateProjectAsync(db);
    }

    private async Task<BoardNode> GetBoardAsync(Guid boardId, Guid? userId = null)
    {
        await using var db = database.CreateDbContext();
        var reader = userId ?? await TestData.OwnerOfBoardAsync(db, boardId);
        return await new GetBoardHandler(database, new ProjectMembershipService(database)).HandleAsync(boardId, reader, CancellationToken.None);
    }
}