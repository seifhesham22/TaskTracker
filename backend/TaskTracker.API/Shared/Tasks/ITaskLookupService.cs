namespace TaskTracker.API.Shared.Tasks
{
    public interface ITaskLookupService
    {
        Task<MemberTask> GetAsync(Guid taskId, Guid userId, CancellationToken ct);
    }
}
