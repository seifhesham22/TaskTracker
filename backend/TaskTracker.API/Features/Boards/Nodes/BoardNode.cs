namespace TaskTracker.API.Features.Boards.Nodes
{
    [GraphQLName("Board")]
    public sealed record BoardNode(Guid Id, Guid ProjectId, string Name);
}
