using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Domain.Exceptions;
using TaskTracker.API.Features.Projects.AddProjectMember;
using TaskTracker.API.Features.Projects.Nodes;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Tests.Infrastructure;

namespace TaskTracker.API.Tests.Features.Projects;

[Collection(nameof(PostgresCollection))]
public class AddProjectMemberHandlerTests(PostgresFixture database) : IDisposable
{
    private readonly WebApplicationFactory<Program> _factory = TestApp.Create(database.ConnectionString);

    public void Dispose() => _factory.Dispose();

    [Theory]
    [InlineData(ProjectRole.Reader)]
    [InlineData(ProjectRole.Writer)]
    public async Task The_owner_adds_an_existing_account_with_the_chosen_role(ProjectRole role)
    {
        var project = await GivenProjectAsync();
        var account = await GivenAccountAsync();

        var added = await AddAsync(new AddProjectMemberInput(project.ProjectId, account.Email, role), project.MemberId);

        Assert.Equal(account.Id, added.userId);
        Assert.Equal(project.ProjectId, added.projectId);
        Assert.Equal(account.Email, added.userName);
        Assert.Equal(role, added.role);
        Assert.Equal(role, await SavedRoleAsync(project.ProjectId, account.Id));
    }

    [Fact]
    public async Task The_role_is_writer_when_none_is_chosen()
    {
        var project = await GivenProjectAsync();
        var account = await GivenAccountAsync();

        var added = await AddAsync(new AddProjectMemberInput(project.ProjectId, account.Email), project.MemberId);

        Assert.Equal(ProjectRole.Writer, added.role);
    }

    [Fact]
    public async Task The_email_is_found_in_any_case_and_with_spaces_around_it()
    {
        var project = await GivenProjectAsync();
        var account = await GivenAccountAsync();

        var added = await AddAsync(
            new AddProjectMemberInput(project.ProjectId, $"  {account.Email.ToUpperInvariant()}  "), project.MemberId);

        Assert.Equal(account.Id, added.userId);
    }

    [Theory]
    [InlineData(ProjectRole.Reader)]
    [InlineData(ProjectRole.Writer)]
    public async Task A_writer_can_add_readers_and_writers(ProjectRole role)
    {
        var project = await GivenProjectAsync();
        var writerId = await GivenMemberAsync(project, ProjectRole.Writer);
        var account = await GivenAccountAsync();

        await AddAsync(new AddProjectMemberInput(project.ProjectId, account.Email, role), writerId);

        Assert.Equal(role, await SavedRoleAsync(project.ProjectId, account.Id));
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Nobody_can_add_a_second_owner(bool askedByTheOwner)
    {
        var project = await GivenProjectAsync();
        var writerId = await GivenMemberAsync(project, ProjectRole.Writer);
        var account = await GivenAccountAsync();

        var error = await Assert.ThrowsAsync<DomainException>(() => AddAsync(
            new AddProjectMemberInput(project.ProjectId, account.Email, ProjectRole.Owner),
            askedByTheOwner ? project.MemberId : writerId));

        Assert.Equal("A project has only one owner. New members can be readers or writers.", error.Message);
        Assert.Null(await SavedRoleAsync(project.ProjectId, account.Id));
    }

    [Fact]
    public async Task A_reader_cannot_add_members()
    {
        var project = await GivenProjectAsync();
        var readerId = await GivenMemberAsync(project, ProjectRole.Reader);
        var account = await GivenAccountAsync();

        var error = await Assert.ThrowsAsync<ForbiddenException>(
            () => AddAsync(new AddProjectMemberInput(project.ProjectId, account.Email, ProjectRole.Reader), readerId));

        Assert.Equal("Only writers and owners of the project can add members.", error.Message);
        Assert.Null(await SavedRoleAsync(project.ProjectId, account.Id));
    }

    [Fact]
    public async Task A_user_who_is_not_a_member_gets_not_found()
    {
        var project = await GivenProjectAsync();
        var outsider = await GivenAccountAsync();
        var account = await GivenAccountAsync();

        var error = await Assert.ThrowsAsync<NotFoundException>(
            () => AddAsync(new AddProjectMemberInput(project.ProjectId, account.Email), outsider.Id));

        Assert.Equal($"Project '{project.ProjectId}' was not found.", error.Message);
    }

    [Fact]
    public async Task An_email_without_an_account_comes_back_as_not_found()
    {
        var project = await GivenProjectAsync();
        var email = $"{Guid.NewGuid():N}@nobody.local";

        var error = await Assert.ThrowsAsync<NotFoundException>(
            () => AddAsync(new AddProjectMemberInput(project.ProjectId, email), project.MemberId));

        Assert.Equal($"No account with the email '{email}' was found.", error.Message);
    }

    [Fact]
    public async Task An_existing_member_is_refused_and_not_added_twice()
    {
        var project = await GivenProjectAsync();
        var account = await GivenAccountAsync();
        await AddAsync(new AddProjectMemberInput(project.ProjectId, account.Email, ProjectRole.Reader), project.MemberId);

        var error = await Assert.ThrowsAsync<BadUserInputException>(
            () => AddAsync(new AddProjectMemberInput(project.ProjectId, account.Email, ProjectRole.Writer), project.MemberId));

        Assert.Equal($"{account.Email} is already a member of this project.", error.Message);
        Assert.Equal(ProjectRole.Reader, await SavedRoleAsync(project.ProjectId, account.Id));
    }

    [Fact]
    public async Task Two_managers_adding_the_same_account_at_the_same_time_add_it_once()
    {
        var project = await GivenProjectAsync();
        var writerId = await GivenMemberAsync(project, ProjectRole.Writer);
        var account = await GivenAccountAsync();

        var results = await Task.WhenAll(
            TryAddAsync(new AddProjectMemberInput(project.ProjectId, account.Email, ProjectRole.Reader), project.MemberId),
            TryAddAsync(new AddProjectMemberInput(project.ProjectId, account.Email, ProjectRole.Reader), writerId));

        Assert.Single(results, r => r is null);
        var error = Assert.IsType<BadUserInputException>(Assert.Single(results, r => r is not null));
        Assert.Equal($"{account.Email} is already a member of this project.", error.Message);
        await using var db = database.CreateDbContext();
        Assert.Equal(1, await db.projectMembers.CountAsync(m => m.ProjectId == project.ProjectId && m.UserId == account.Id));
    }

    private async Task<Exception?> TryAddAsync(AddProjectMemberInput input, Guid userId)
    {
        try
        {
            await AddAsync(input, userId);
            return null;
        }
        catch (Exception ex)
        {
            return ex;
        }
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task An_empty_email_is_refused(string email)
    {
        var project = await GivenProjectAsync();

        var error = await Assert.ThrowsAsync<BadUserInputException>(
            () => AddAsync(new AddProjectMemberInput(project.ProjectId, email), project.MemberId));

        Assert.Equal("Email is required.", error.Message);
    }

    private async Task<TestProject> GivenProjectAsync()
    {
        await using var db = database.CreateDbContext();
        return await TestData.CreateProjectAsync(db);
    }

    private async Task<(Guid Id, string Email)> GivenAccountAsync()
    {
        await using var db = database.CreateDbContext();
        return await TestData.CreateAccountAsync(db);
    }

    private async Task<Guid> GivenMemberAsync(TestProject project, ProjectRole role)
    {
        await using var db = database.CreateDbContext();
        return await TestData.AddMemberAsync(db, project.ProjectId, role);
    }

    private async Task<ProjectMemberNode> AddAsync(AddProjectMemberInput input, Guid userId)
    {
        using var scope = _factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<AddProjectMemberHandler>()
            .HandleAsync(input, userId, CancellationToken.None);
    }

    private async Task<ProjectRole?> SavedRoleAsync(Guid projectId, Guid userId)
    {
        await using var db = database.CreateDbContext();
        return await db.projectMembers
            .Where(m => m.ProjectId == projectId && m.UserId == userId)
            .Select(m => (ProjectRole?)m.ProjectRole)
            .SingleOrDefaultAsync();
    }
}