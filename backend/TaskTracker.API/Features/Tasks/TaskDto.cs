using TaskTracker.API.Domain.Enums;

namespace TaskTracker.API.Features.Tasks
{
    public record TaskDto(
        Guid Id,
        string ReadableId,
        int Number,
        Guid BoardId,
        string Title,
        string? Description,
        ColumnCategory Status,
        Guid ColumnId,
        string ColumnName,
        TaskPriority? Priority,
        IReadOnlyList<Guid> AssigneeIds,
        DateTimeOffset? DueDate,
        DateTime CreatedAt);
}