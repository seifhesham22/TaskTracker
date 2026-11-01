using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Features.Tasks.GetTasks;

namespace TaskTracker.API.Data.DataLoaders
{
    public class ColumnByIdDataLoader(
        IDbContextFactory<ApplicationDbContext> _db,
        IBatchScheduler scheduler,
        DataLoaderOptions options) : BatchDataLoader<Guid, ColumnNode>(scheduler, options)
    {
        protected override async Task<IReadOnlyDictionary<Guid, ColumnNode>> LoadBatchAsync(
            IReadOnlyList<Guid> keys,
            CancellationToken cancellationToken)
        {
            await using var db = await _db.CreateDbContextAsync(cancellationToken);

            return await db.boardColumns
                .AsNoTracking()
                .Where(x => keys.Contains(x.Id))
                .Select(x => new ColumnNode(x.Id, x.Name, x.Position, x.Category))
                .ToDictionaryAsync(c => c.Id, cancellationToken);
        }
    }
}