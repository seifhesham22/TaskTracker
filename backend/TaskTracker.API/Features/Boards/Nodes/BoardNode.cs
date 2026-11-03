using TaskTracker.API.Data.DataLoaders;

namespace TaskTracker.API.Features.Boards.Nodes
{
    [GraphQLName("Board")]
    public sealed record BoardNode(Guid Id, Guid ProjectId, string Name)
    {
        public async Task<ColumnNode[]> GetColumnsAsync(ColumnsByBoardIdDataLoader loader, CancellationToken ct)
            => await loader.LoadAsync(Id, ct) ?? [];
    }
}