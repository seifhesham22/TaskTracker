using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Tests.Infrastructure;

namespace TaskTracker.API.Tests.Data;

[Collection(nameof(PostgresCollection))]
public class ProjectVersionTests(PostgresFixture database)
{
    [Fact]
    public async Task Saving_a_project_that_was_changed_after_it_was_read_is_refused()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);

        await using var first = database.CreateDbContext();
        await using var second = database.CreateDbContext();
        var readByFirst = await first.projects.SingleAsync(p => p.Id == project.ProjectId);
        var readBySecond = await second.projects.SingleAsync(p => p.Id == project.ProjectId);

        readBySecond.Touch();
        await second.SaveChangesAsync();

        readByFirst.Touch();
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => first.SaveChangesAsync());
    }

    [Fact]
    public async Task Saving_a_project_that_nobody_else_changed_works()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);

        await using var context = database.CreateDbContext();
        var loaded = await context.projects.SingleAsync(p => p.Id == project.ProjectId);

        loaded.Touch();
        await context.SaveChangesAsync();
        loaded.Touch();
        await context.SaveChangesAsync();
    }
}