using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Shared.Membership;
using TaskTracker.API.Tests.Infrastructure;

namespace TaskTracker.API.Tests.Shared;

[Collection(nameof(PostgresCollection))]
public class ProjectMembershipServiceTests(PostgresFixture database)
{
    private ProjectMembershipService Membership => new(database);

    [Theory]
    [InlineData(ProjectRole.Reader)]
    [InlineData(ProjectRole.Writer)]
    public async Task Gives_the_role_of_a_member_by_project_and_by_board(ProjectRole role)
    {
        var project = await GivenProjectAsync();
        var memberId = await GivenMemberAsync(project, role);

        Assert.Equal(role, await Membership.GetRoleAsync(project.ProjectId, memberId, CancellationToken.None));
        Assert.Equal(role, await Membership.GetRoleOnBoardAsync(project.BoardId, memberId, CancellationToken.None));
        Assert.Equal(ProjectRole.Owner, await Membership.GetRoleOnBoardAsync(project.BoardId, project.MemberId, CancellationToken.None));
    }

    [Fact]
    public async Task Gives_no_role_to_someone_who_is_not_a_member()
    {
        var project = await GivenProjectAsync();
        var other = await GivenProjectAsync();

        Assert.Null(await Membership.GetRoleAsync(project.ProjectId, other.MemberId, CancellationToken.None));
        Assert.Null(await Membership.GetRoleOnBoardAsync(project.BoardId, other.MemberId, CancellationToken.None));
    }

    [Fact]
    public async Task Gives_no_role_on_a_board_that_does_not_exist_or_was_deleted()
    {
        var project = await GivenProjectAsync();
        await using (var db = database.CreateDbContext())
            await db.boards.Where(b => b.Id == project.BoardId)
                .ExecuteUpdateAsync(s => s.SetProperty(b => b.IsDeleted, true));

        Assert.Null(await Membership.GetRoleOnBoardAsync(project.BoardId, project.MemberId, CancellationToken.None));
        Assert.Null(await Membership.GetRoleOnBoardAsync(Guid.NewGuid(), project.MemberId, CancellationToken.None));
    }

    [Fact]
    public async Task Gives_no_role_in_a_deleted_project()
    {
        var project = await GivenProjectAsync();
        await using (var db = database.CreateDbContext())
            await db.projects.Where(p => p.Id == project.ProjectId)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.IsDeleted, true));

        Assert.Null(await Membership.GetRoleAsync(project.ProjectId, project.MemberId, CancellationToken.None));
        Assert.Null(await Membership.GetRoleOnBoardAsync(project.BoardId, project.MemberId, CancellationToken.None));
    }

    [Fact]
    public async Task Lists_the_projects_the_user_is_a_member_of_and_no_others()
    {
        var mine = await GivenProjectAsync();
        var shared = await GivenProjectAsync();
        await GivenProjectAsync();
        await using (var db = database.CreateDbContext())
            await TestData.AddMemberAsync(db, shared.ProjectId, ProjectRole.Reader, mine.MemberId);

        var projectIds = await Membership.GetProjectIdsAsync(mine.MemberId, CancellationToken.None);

        Assert.Equal(new[] { mine.ProjectId, shared.ProjectId }.Order(), projectIds.Order());
    }

    private async Task<TestProject> GivenProjectAsync()
    {
        await using var db = database.CreateDbContext();
        return await TestData.CreateProjectAsync(db);
    }

    private async Task<Guid> GivenMemberAsync(TestProject project, ProjectRole role)
    {
        await using var db = database.CreateDbContext();
        return await TestData.AddMemberAsync(db, project.ProjectId, role);
    }
}
