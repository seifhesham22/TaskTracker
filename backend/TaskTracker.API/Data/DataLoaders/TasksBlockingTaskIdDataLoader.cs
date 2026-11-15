using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Features.Tasks.GetTasks;

namespace TaskTracker.API.Data.DataLoaders
{
    public class TasksBlockingTaskIdDataLoader(
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
                .Where(x => keys.Contains(x.BlockedTaskId))
                .OrderBy(x => x.BlockingTask.Number)
                .ThenBy(x => x.BlockingTaskId)
                .Select(x => new { x.BlockedTaskId, Task = new TaskNode(x.BlockingTask, x.BlockingTask.Project.Key) })
                .ToListAsync(cancellationToken);

            return rows.ToLookup(x => x.BlockedTaskId, x => x.Task);
        }
    }
}
