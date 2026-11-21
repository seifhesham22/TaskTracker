namespace TaskTracker.API.Features.Tasks.UnassignTask
{
    public record UnassignTaskInput(Guid TaskId, Guid UserId);
}
