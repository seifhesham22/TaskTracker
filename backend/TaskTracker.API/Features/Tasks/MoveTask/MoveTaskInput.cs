namespace TaskTracker.API.Features.Tasks.MoveTask
{
    public record MoveTaskInput(Guid TaskId, Guid ColumnId);
}
