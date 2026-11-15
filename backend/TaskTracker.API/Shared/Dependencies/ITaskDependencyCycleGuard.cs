using TaskTracker.API.Domain.Entities;

namespace TaskTracker.API.Shared.Dependencies
{
    public interface ITaskDependencyCycleGuard
    {
        Task EnsureNoCycleAsync(TaskItem blocking, TaskItem blocked, string projectKey, CancellationToken ct);
    }
}
