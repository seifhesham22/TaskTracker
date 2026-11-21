using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Domain.Exceptions;
using TaskTracker.API.Features.Projects.CreateProject;
using TaskTracker.API.Features.Projects.GetProjects;
using TaskTracker.API.Features.Projects.Nodes;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Tests.Infrastructure;

namespace TaskTracker.API.Tests.Features.Projects;

[Collection(nameof(PostgresCollection))]
public class CreateProjectHandlerTests(PostgresFixture database)
{
    [Fact]
    public async Task Saves_the_project_with_the_creator_as_its_only_owner()
    {
        var userId = await GivenUserAsync();
        var prefix = UniquePrefix();

        var created = await CreateAsync(new CreateProjectInput($"  {prefix} Website  ", null, "Our website"), userId);

        await using var db = database.CreateDbContext();
        var saved = await db.projects.Include(p => p.ProjectMembers).SingleAsync(p => p.Id == created.Id);
        Assert.Equal($"{prefix} Website", saved.Name);
        Assert.Equal("Our website", saved.Description);
        var member = Assert.Single(saved.ProjectMembers);
        Assert.Equal(userId, member.UserId);
        Assert.Equal(ProjectRole.Owner, member.ProjectRole);
        Assert.Equal(ProjectRole.Owner, created.Role);
    }

    [Fact]
    public async Task Saves_a_default_board_with_the_four_default_columns()
    {
        var userId = await GivenUserAsync();

        var created = await CreateAsync(new CreateProjectInput($"{UniquePrefix()} Website"), userId);

        await using var db = database.CreateDbContext();
        var board = await db.boards.Include(b => b.Columns).SingleAsync(b => b.ProjectId == created.Id);
        Assert.Equal("Board", board.Name);
        Assert.Equal(
            new[] { "Backlog", "To do", "In progress", "Done" },
            board.Columns.OrderBy(c => c.Position, StringComparer.Ordinal).Select(c => c.Name));
    }

    [Fact]
    public async Task The_new_project_shows_in_the_project_list_of_its_creator_as_owner()
    {
        var userId = await GivenUserAsync();

        var created = await CreateAsync(new CreateProjectInput($"{UniquePrefix()} Website"), userId);

        var listed = Assert.Single(await new GetProjectsHandler(database).HandleAsync(userId, CancellationToken.None));
        Assert.Equal(created.Id, listed.Id);
        Assert.Equal(ProjectRole.Owner, listed.Role);
    }

    [Fact]
    public async Task Without_a_key_the_key_is_the_first_four_characters_of_the_name_in_capitals()
    {
        var userId = await GivenUserAsync();
        var prefix = UniquePrefix();

        var created = await CreateAsync(new CreateProjectInput($"{prefix.ToLowerInvariant()} tracker"), userId);

        Assert.Equal(prefix, created.Key);
    }

    [Fact]
    public async Task A_number_is_added_when_the_generated_key_is_taken()
    {
        var userId = await GivenUserAsync();
        var prefix = UniquePrefix();

        var first = await CreateAsync(new CreateProjectInput($"{prefix} one"), userId);
        var second = await CreateAsync(new CreateProjectInput($"{prefix} two"), userId);
        var third = await CreateAsync(new CreateProjectInput($"{prefix} three"), userId);

        Assert.Equal(new[] { prefix, $"{prefix}2", $"{prefix}3" }, new[] { first.Key, second.Key, third.Key });
    }

    [Fact]
    public async Task A_given_key_is_saved_in_capitals()
    {
        var userId = await GivenUserAsync();
        var key = UniqueKey();

        var created = await CreateAsync(new CreateProjectInput("Website", key.ToLowerInvariant()), userId);

        Assert.Equal(key, created.Key);
    }

    [Fact]
    public async Task A_given_key_that_is_taken_is_refused_and_nothing_is_saved()
    {
        var userId = await GivenUserAsync();
        var key = UniqueKey();
        await CreateAsync(new CreateProjectInput("First", key), userId);

        var error = await Assert.ThrowsAsync<BadUserInputException>(
            () => CreateAsync(new CreateProjectInput("Second", key), userId));

        Assert.Equal($"The key '{key}' is already used by another project.", error.Message);
        Assert.Equal(1, await ProjectCountOfAsync(userId));
    }

    [Fact]
    public async Task The_key_of_a_deleted_project_stays_taken()
    {
        var userId = await GivenUserAsync();
        var key = UniqueKey();
        var deleted = await CreateAsync(new CreateProjectInput("Deleted", key), userId);
        await using (var db = database.CreateDbContext())
            await db.projects.Where(p => p.Id == deleted.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.IsDeleted, true));

        var error = await Assert.ThrowsAsync<BadUserInputException>(
            () => CreateAsync(new CreateProjectInput("New", key), userId));

        Assert.Equal($"The key '{key}' is already used by another project.", error.Message);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task An_empty_name_is_refused_and_nothing_is_saved(string name)
    {
        var userId = await GivenUserAsync();

        var error = await Assert.ThrowsAsync<DomainException>(
            () => CreateAsync(new CreateProjectInput(name), userId));

        Assert.Equal("Project name cannot be empty or only spaces.", error.Message);
        Assert.Equal(0, await ProjectCountOfAsync(userId));
    }

    private static string UniquePrefix() => Guid.NewGuid().ToString("N")[..4].ToUpperInvariant();

    private static string UniqueKey() => "K" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();

    private async Task<Guid> GivenUserAsync()
    {
        await using var db = database.CreateDbContext();
        return await TestData.CreateUserAsync(db);
    }

    private async Task<ProjectNode> CreateAsync(CreateProjectInput input, Guid userId)
    {
        await using var db = database.CreateDbContext();
        return await new CreateProjectHandler(db).HandleAsync(input, userId, CancellationToken.None);
    }

    private async Task<int> ProjectCountOfAsync(Guid userId)
    {
        await using var db = database.CreateDbContext();
        return await db.projectMembers.CountAsync(m => m.UserId == userId);
    }
}