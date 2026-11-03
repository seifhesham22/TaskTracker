using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Features.Tasks.GetTasks;

namespace TaskTracker.API.Data.DataLoaders
{
    public class AssigneesByTaskIdDataLoader(
        IDbContextFactory<ApplicationDbContext> _db,
        IBatchScheduler scheduler,
        DataLoaderOptions options) : GroupedDataLoader<Guid, AssigneeNode>(scheduler, options)
    {
        protected override async Task<ILookup<Guid, AssigneeNode>> LoadGroupedBatchAsync(
            IReadOnlyList<Guid> keys,
            CancellationToken cancellationToken)
        {
            await using var db = await _db.CreateDbContextAsync(cancellationToken);

            var rows = await db.assignees
                .AsNoTracking()
                .Where(x => keys.Contains(x.TaskId))
                .Select(x => new { x.TaskId, Assignee = new AssigneeNode(x.User.Id, x.User.UserName) })
                .ToListAsync(cancellationToken);

            return rows.ToLookup(x => x.TaskId, x => x.Assignee);
        }
    }
}
