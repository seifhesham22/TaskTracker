using TaskTracker.API.Domain.Entities;

namespace TaskTracker.API.Shared.Tasks
{
    public interface ITaskLookupService
    {
        Task<TaskItem> GetAsync(Guid taskId, CancellationToken ct);
    }
}
