namespace TaskTracker.API.Features.Tasks.AddTaskDependency
{
    public record AddTaskDependencyInput(Guid BlockingTaskId, Guid BlockedTaskId);
}