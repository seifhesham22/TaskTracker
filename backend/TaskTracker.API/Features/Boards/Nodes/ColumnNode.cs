using TaskTracker.API.Domain.Enums;

namespace TaskTracker.API.Features.Boards.Nodes
{
    [GraphQLName("Column")]
    public sealed record ColumnNode(Guid Id, string name, string position, ColumnCategory category);
}