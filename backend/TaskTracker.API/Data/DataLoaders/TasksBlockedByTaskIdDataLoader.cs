using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Features.Tasks.GetTasks;

namespace TaskTracker.API.Data.DataLoaders
{
    public class TasksBlockedByTaskIdDataLoader(
        IDbContextFactory<ApplicationDbContext> _db,
        IBatchScheduler scheduler,
        DataLoaderOptions options) : GroupedDataLoader<Guid, TaskNode>(scheduler, options)
    {
        protected override async Task<ILookup<Guid, TaskNode>> LoadGroupedBatchAsync(
            IReadOnlyList<Guid> keys,
            CancellationToken cancellationToken)
        {
            await using var db = await _db.CreateDbContextAsync(cancellationToken);

            var rows = await db.taskDependencies
                .AsNoTracking()
                .Where(x => keys.Contains(x.BlockingTaskId))
                .OrderBy(x => x.BlockedTask.Number)
                .ThenBy(x => x.BlockedTaskId)
                .Select(x => new { x.BlockingTaskId, Task = new TaskNode(x.BlockedTask, x.BlockedTask.Project.Key) })
                .ToListAsync(cancellationToken);

            return rows.ToLookup(x => x.BlockingTaskId, x => x.Task);
        }
    }
}
