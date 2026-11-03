namespace TaskTracker.API.Shared.Positions
{
    public interface ITaskPositionService
    {
        Task<string> GetNextPositionAsync(Guid columnId, CancellationToken ct);
    }
}