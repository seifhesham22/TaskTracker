using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Features.Projects.Nodes;
using TaskTracker.API.Features.Projects.RemoveProjectMember;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.Membership;
using TaskTracker.API.Tests.Infrastructure;

namespace TaskTracker.API.Tests.Features.Projects;

[Collection(nameof(PostgresCollection))]
public class RemoveProjectMemberHandlerTests(PostgresFixture database) : IDisposable
{
    private readonly WebApplicationFactory<Program> _factory = TestApp.Create(database.ConnectionString);

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task The_owner_removes_a_member_and_their_access_ends()
    {
        var project = await GivenProjectAsync();
        var writerId = await GivenMemberAsync(project, ProjectRole.Writer);

        var removed = await RemoveAsync(project.ProjectId, writerId, project.MemberId);

        Assert.Equal(writerId, removed.userId);
        Assert.Equal(ProjectRole.Writer, removed.role);
        Assert.Null(await new ProjectMembershipService(database).GetRoleAsync(project.ProjectId, writerId, CancellationToken.None));
        Assert.Equal(1, await MemberCountAsync(project));
    }

    [Theory]
    [InlineData(ProjectRole.Reader)]
    [InlineData(ProjectRole.Writer)]
    public async Task A_writer_can_remove_readers_and_writers(ProjectRole role)
    {
        var project = await GivenProjectAsync();
        var writerId = await GivenMemberAsync(project, ProjectRole.Writer);
        var memberId = await GivenMemberAsync(project, role);

        await RemoveAsync(project.ProjectId, memberId, writerId);

        Assert.Null(await SavedRoleAsync(project, memberId));
    }

    [Fact]
    public async Task A_member_can_leave_the_project()
    {
        var project = await GivenProjectAsync();
        var writerId = await GivenMemberAsync(project, ProjectRole.Writer);

        await RemoveAsync(project.ProjectId, writerId, writerId);

        Assert.Null(await SavedRoleAsync(project, writerId));
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task The_owner_cannot_be_removed(bool byThemselves)
    {
        var project = await GivenProjectAsync();
        var writerId = await GivenMemberAsync(project, ProjectRole.Writer);
        var ownerEmail = await EmailOfAsync(project.MemberId);

        var error = await Assert.ThrowsAsync<BadUserInputException>(
            () => RemoveAsync(project.ProjectId, project.MemberId, byThemselves ? project.MemberId : writerId));

        Assert.Equal($"{ownerEmail} is the owner of this project and can't be removed.", error.Message);
        Assert.Equal(ProjectRole.Owner, await SavedRoleAsync(project, project.MemberId));
        Assert.Equal(2, await MemberCountAsync(project));
    }

    [Fact]
    public async Task A_reader_cannot_remove_members()
    {
        var project = await GivenProjectAsync();
        var readerId = await GivenMemberAsync(project, ProjectRole.Reader);
        var writerId = await GivenMemberAsync(project, ProjectRole.Writer);

        var error = await Assert.ThrowsAsync<ForbiddenException>(
            () => RemoveAsync(project.ProjectId, writerId, readerId));

        Assert.Equal("Only writers and owners of the project can remove members.", error.Message);
        Assert.Equal(ProjectRole.Writer, await SavedRoleAsync(project, writerId));
    }

    [Fact]
    public async Task Removing_someone_who_is_not_a_member_comes_back_as_not_found()
    {
        var project = await GivenProjectAsync();
        var stranger = Guid.NewGuid();

        var error = await Assert.ThrowsAsync<NotFoundException>(
            () => RemoveAsync(project.ProjectId, stranger, project.MemberId));

        Assert.Equal($"User '{stranger}' is not a member of this project.", error.Message);
    }

    [Fact]
    public async Task A_user_who_is_not_a_member_gets_not_found()
    {
        var project = await GivenProjectAsync();
        var writerId = await GivenMemberAsync(project, ProjectRole.Writer);
        Guid outsiderId;
        await using (var db = database.CreateDbContext())
            outsiderId = await TestData.CreateUserAsync(db);

        var error = await Assert.ThrowsAsync<NotFoundException>(
            () => RemoveAsync(project.ProjectId, writerId, outsiderId));

        Assert.Equal($"Project '{project.ProjectId}' was not found.", error.Message);
        Assert.Equal(ProjectRole.Writer, await SavedRoleAsync(project, writerId));
    }

    [Fact]
    public async Task Two_managers_removing_the_same_member_at_the_same_time_remove_it_once()
    {
        var project = await GivenProjectAsync();
        var writerId = await GivenMemberAsync(project, ProjectRole.Writer);
        var readerId = await GivenMemberAsync(project, ProjectRole.Reader);

        var results = await Task.WhenAll(
            TryRemoveAsync(project.ProjectId, readerId, project.MemberId),
            TryRemoveAsync(project.ProjectId, readerId, writerId));

        Assert.Single(results, r => r is null);
        var error = Assert.IsType<NotFoundException>(Assert.Single(results, r => r is not null));
        Assert.Equal($"User '{readerId}' is not a member of this project.", error.Message);
        Assert.Null(await SavedRoleAsync(project, readerId));
        Assert.Equal(2, await MemberCountAsync(project));
    }

    private async Task<Exception?> TryRemoveAsync(Guid projectId, Guid memberId, Guid userId)
    {
        try
        {
            await RemoveAsync(projectId, memberId, userId);
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

    private async Task<Guid> GivenMemberAsync(TestProject project, ProjectRole role)
    {
        await using var db = database.CreateDbContext();
        return await TestData.AddMemberAsync(db, project.ProjectId, role);
    }

    private async Task<ProjectMemberNode> RemoveAsync(Guid projectId, Guid memberId, Guid userId)
    {
        using var scope = _factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<RemoveProjectMemberHandler>()
            .HandleAsync(new RemoveProjectMemberInput(projectId, memberId), userId, CancellationToken.None);
    }

    private async Task<ProjectRole?> SavedRoleAsync(TestProject project, Guid userId)
    {
        await using var db = database.CreateDbContext();
        return await db.projectMembers
            .Where(m => m.ProjectId == project.ProjectId && m.UserId == userId)
            .Select(m => (ProjectRole?)m.ProjectRole)
            .SingleOrDefaultAsync();
    }

    private async Task<int> MemberCountAsync(TestProject project)
    {
        await using var db = database.CreateDbContext();
        return await db.projectMembers.CountAsync(m => m.ProjectId == project.ProjectId);
    }

    private async Task<string> EmailOfAsync(Guid userId)
    {
        await using var db = database.CreateDbContext();
        return await db.Users.Where(u => u.Id == userId).Select(u => u.UserName!).SingleAsync();
    }
}
