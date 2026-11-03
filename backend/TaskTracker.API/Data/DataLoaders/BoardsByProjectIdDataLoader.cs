using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Features.Boards.Nodes;

namespace TaskTracker.API.Data.DataLoaders
{
    public class BoardsByProjectIdDataLoader(
        IDbContextFactory<ApplicationDbContext> db,
        IBatchScheduler scheduler,
        DataLoaderOptions options)
        : GroupedDataLoader<Guid, BoardNode>(scheduler, options)
    {
        protected override async Task<ILookup<Guid, BoardNode>> LoadGroupedBatchAsync(IReadOnlyList<Guid> keys, CancellationToken cancellationToken)
        {
            await using var _db = await db.CreateDbContextAsync(cancellationToken);

            var boards = await _db.boards
                .AsNoTracking()
                .Where(x => keys.Contains(x.ProjectId) && !x.IsDeleted)
                .OrderBy(x => x.Position)
                .ThenBy(x => x.Id)
                .Select(x => new BoardNode(x.Id, x.ProjectId, x.Name))
                .ToListAsync(cancellationToken);

            return boards.ToLookup(x => x.ProjectId);
        }
    }
}
