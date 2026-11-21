namespace TaskTracker.API.Features.Tasks.AssignTask
{
    public record AssignTaskInput(Guid TaskId, Guid UserId);
}
