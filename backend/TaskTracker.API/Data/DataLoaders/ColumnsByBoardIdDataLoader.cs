using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Features.Boards.Nodes;

namespace TaskTracker.API.Data.DataLoaders
{
    public class ColumnsByBoardIdDataLoader(
        IDbContextFactory<ApplicationDbContext> db,
        IBatchScheduler scheduler,
        DataLoaderOptions options)
        : GroupedDataLoader<Guid, ColumnNode>(scheduler, options)
    {
        protected override async Task<ILookup<Guid, ColumnNode>> LoadGroupedBatchAsync(IReadOnlyList<Guid> keys, CancellationToken cancellationToken)
        {
            await using var _db = await db.CreateDbContextAsync(cancellationToken);

            var rows = await _db.boardColumns
                .AsNoTracking()
                .Where(x => keys.Contains(x.BoardId))
                .OrderBy(x => x.Position)
                .ThenBy(x => x.Id)
                .Select(x => new { x.BoardId, Column = new ColumnNode(x.Id, x.Name, x.Position, x.Category) })
                .ToListAsync(cancellationToken);

            return rows.ToLookup(x => x.BoardId, x => x.Column);
        }
    }
}