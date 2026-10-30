using TaskTracker.API.Domain.Enums;

namespace TaskTracker.API.Features.Tasks.CreateTask
{
    public record CreateTaskInput(
        Guid BoardId,
        Guid? ColumnId,
        string Title,
        string? Description,
        Guid? AssigneeId,
        TaskPriority? Priority,
        DateTimeOffset? DueDate);
}