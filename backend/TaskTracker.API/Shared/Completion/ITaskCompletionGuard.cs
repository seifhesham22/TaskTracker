using TaskTracker.API.Domain.Entities;

namespace TaskTracker.API.Shared.Completion
{
    public interface ITaskCompletionGuard
    {
        Task EnsureSubtasksAreDoneAsync(TaskItem task, string projectKey, CancellationToken ct);
    }
}
