using TaskTracker.API.Domain.Enums;

namespace TaskTracker.API.Features.Tasks.GetTasks
{
    [GraphQLName("Column")]
    public sealed record ColumnNode(Guid Id, string name, string position, ColumnCategory category);
}
