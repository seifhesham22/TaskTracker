namespace TaskTracker.API.Shared.Positions
{
    public interface ITaskPositionService
    {
        Task<string> GetNextPositionAsync(Guid columnId, CancellationToken ct);
        Task<string> GetNextRankAsync(Guid projectId, CancellationToken ct);
    }
}
