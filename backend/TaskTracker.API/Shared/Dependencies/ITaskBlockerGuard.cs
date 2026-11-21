using TaskTracker.API.Domain.Entities;

namespace TaskTracker.API.Shared.Dependencies
{
    public interface ITaskBlockerGuard
    {
        Task EnsureNotBlockedAsync(TaskItem task, string projectKey, CancellationToken ct);
    }
}
