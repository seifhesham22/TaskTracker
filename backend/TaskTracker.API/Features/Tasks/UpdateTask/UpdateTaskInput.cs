using TaskTracker.API.Domain.Enums;

namespace TaskTracker.API.Features.Tasks.UpdateTask
{
    public record UpdateTaskInput(
        Guid TaskId,
        Optional<string?> Title = default,
        Optional<string?> Description = default,
        Optional<TaskPriority?> Priority = default,
        Optional<DateTimeOffset?> StartDate = default,
        Optional<DateTimeOffset?> DueDate = default);
}
