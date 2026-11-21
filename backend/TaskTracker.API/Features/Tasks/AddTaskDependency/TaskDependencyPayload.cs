using TaskTracker.API.Features.Tasks.GetTasks;

namespace TaskTracker.API.Features.Tasks.AddTaskDependency
{
    public sealed record TaskDependencyPayload(TaskNode BlockingTask, TaskNode BlockedTask);
}