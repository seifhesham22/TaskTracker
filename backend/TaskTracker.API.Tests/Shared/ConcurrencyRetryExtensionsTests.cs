using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Shared.Concurrency;

namespace TaskTracker.API.Tests.Shared;

public class ConcurrencyRetryExtensionsTests
{
    private readonly ApplicationDbContext _db =
        new(new DbContextOptionsBuilder<ApplicationDbContext>().UseNpgsql("Host=localhost").Options);

    [Fact]
    public async Task Returns_the_result_when_there_is_no_conflict()
    {
        var calls = 0;

        var result = await _db.RetryOnConflictAsync(() => Task.FromResult(++calls));

        Assert.Equal(1, result);
        Assert.Equal(1, calls);
    }

    [Fact]
    public async Task Runs_the_work_again_after_a_conflict()
    {
        var calls = 0;

        var result = await _db.RetryOnConflictAsync(() =>
            ++calls == 1 ? throw new DbUpdateConcurrencyException("Changed meanwhile.") : Task.FromResult(calls));

        Assert.Equal(2, result);
    }

    [Fact]
    public async Task Gives_up_after_three_attempts()
    {
        var calls = 0;

        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => _db.RetryOnConflictAsync<int>(() =>
        {
            calls++;
            throw new DbUpdateConcurrencyException("Changed meanwhile.");
        }));

        Assert.Equal(ConcurrencyRetryExtensions.MaxAttempts, calls);
    }

    [Fact]
    public async Task Other_errors_are_not_retried()
    {
        var calls = 0;

        await Assert.ThrowsAsync<InvalidOperationException>(() => _db.RetryOnConflictAsync<int>(() =>
        {
            calls++;
            throw new InvalidOperationException("Not a save conflict.");
        }));

        Assert.Equal(1, calls);
    }
}
