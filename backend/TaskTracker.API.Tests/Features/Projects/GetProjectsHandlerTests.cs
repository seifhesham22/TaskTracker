using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Features.Projects.GetProjects;
using TaskTracker.API.Features.Projects.Nodes;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Tests.Infrastructure;

namespace TaskTracker.API.Tests.Features.Projects;

[Collection(nameof(PostgresCollection))]
public class GetProjectsHandlerTests(PostgresFixture database)
{
    [Fact]
    public async Task Returns_the_project_the_user_is_a_member_of_with_their_role()
    {
        var project = await GivenProjectAsync();

        var result = Assert.Single(await GetProjectsAsync(project.MemberId));

        Assert.Equal(project.ProjectId, result.Id);
        Assert.Equal(project.Key, result.Key);
        Assert.Equal("Test project", result.Name);
        Assert.Equal(ProjectRole.Owner, result.Role);
    }

    [Fact]
    public async Task Returns_every_project_of_the_user_with_the_role_they_have_in_each()
    {
        var owned = await GivenProjectAsync();
        var other = await GivenProjectAsync();
        await AddMemberAsync(other.ProjectId, owned.MemberId, ProjectRole.Reader);

        var projects = await GetProjectsAsync(owned.MemberId);

        Assert.Equal(2, projects.Count);
        Assert.Equal(ProjectRole.Owner, projects.Single(p => p.Id == owned.ProjectId).Role);
        Assert.Equal(ProjectRole.Reader, projects.Single(p => p.Id == other.ProjectId).Role);
    }

    [Fact]
    public async Task Does_not_return_projects_the_user_is_not_a_member_of()
    {
        var mine = await GivenProjectAsync();
        await GivenProjectAsync();

        var projects = await GetProjectsAsync(mine.MemberId);

        Assert.Equal(mine.ProjectId, Assert.Single(projects).Id);
    }

    [Fact]
    public async Task Returns_an_empty_list_for_a_user_who_is_in_no_project()
    {
        Guid userId;
        await using (var db = database.CreateDbContext())
            userId = await TestData.CreateUserAsync(db);

        Assert.Empty(await GetProjectsAsync(userId));
    }

    [Fact]
    public async Task Does_not_return_deleted_projects()
    {
        var project = await GivenProjectAsync();
        await DeleteProjectAsync(project.ProjectId);

        Assert.Empty(await GetProjectsAsync(project.MemberId));
    }

    [Fact]
    public async Task Returns_not_found_for_a_user_that_does_not_exist()
    {
        var userId = Guid.NewGuid();

        var error = await Assert.ThrowsAsync<NotFoundException>(() => GetProjectsAsync(userId));

        Assert.Equal($"User '{userId}' was not found.", error.Message);
    }

    private async Task<TestProject> GivenProjectAsync()
    {
        await using var db = database.CreateDbContext();
        return await TestData.CreateProjectAsync(db);
    }

    private async Task AddMemberAsync(Guid projectId, Guid userId, ProjectRole role)
    {
        await using var db = database.CreateDbContext();
        db.Add(new ProjectMember { ProjectId = projectId, UserId = userId, ProjectRole = role, JoinedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
    }

    private async Task DeleteProjectAsync(Guid projectId)
    {
        await using var db = database.CreateDbContext();
        await db.projects
            .IgnoreQueryFilters()
            .Where(p => p.Id == projectId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.IsDeleted, true));
    }

    private Task<IReadOnlyList<ProjectNode>> GetProjectsAsync(Guid userId) =>
        new GetProjectsHandler(database).HandleAsync(userId, CancellationToken.None);
}
