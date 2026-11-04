using Microsoft.EntityFrameworkCore;
using Npgsql;
using TaskTracker.API.Features.Tasks.CreateTask;
using TaskTracker.API.Shared.Positions;
using TaskTracker.API.Tests.Infrastructure;

namespace TaskTracker.API.Tests.Data;

[Collection(nameof(PostgresCollection))]
public class TaskItemDatabaseTests(PostgresFixture database)
{
    [Fact]
    public async Task Database_refuses_a_task_without_a_title()
    {
        var taskId = await CreateValidTaskAsync();
        await using var db = database.CreateDbContext();

        var error = await Assert.ThrowsAsync<PostgresException>(() =>
            db.Database.ExecuteSqlInterpolatedAsync($"UPDATE tasks SET \"Title\" = NULL WHERE \"Id\" = {taskId}"));

        Assert.Equal(PostgresErrorCodes.NotNullViolation, error.SqlState);
        Assert.Equal("Title", error.ColumnName);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Database_refuses_an_empty_title(string title)
    {
        var taskId = await CreateValidTaskAsync();
        await using var db = database.CreateDbContext();

        var error = await Assert.ThrowsAsync<PostgresException>(() =>
            db.Database.ExecuteSqlInterpolatedAsync($"UPDATE tasks SET \"Title\" = {title} WHERE \"Id\" = {taskId}"));

        Assert.Equal(PostgresErrorCodes.CheckViolation, error.SqlState);
        Assert.Equal("CK_tasks_Title_NotEmpty", error.ConstraintName);
    }

    [Fact]
    public async Task Database_refuses_a_task_without_a_board()
    {
        var taskId = await CreateValidTaskAsync();
        await using var db = database.CreateDbContext();

        var error = await Assert.ThrowsAsync<PostgresException>(() =>
            db.Database.ExecuteSqlInterpolatedAsync($"UPDATE tasks SET \"BoardId\" = NULL WHERE \"Id\" = {taskId}"));

        Assert.Equal(PostgresErrorCodes.NotNullViolation, error.SqlState);
        Assert.Equal("BoardId", error.ColumnName);
    }

    private async Task<Guid> CreateValidTaskAsync()
    {
        await using var db = database.CreateDbContext();
        var project = await TestData.CreateProjectAsync(db);
        var task = await new CreateTaskHandler(db, new TaskPositionService(db))
            .HandleAsync(new CreateTaskInput(project.BoardId, null, "Valid task", null, null, null, null), CancellationToken.None);
        return task.Id;
    }
}
