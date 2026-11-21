namespace TaskTracker.API.Features.Tasks.RankTask
{
    public record RankTaskInput(Guid TaskId, Guid? AfterTaskId = null);
}
