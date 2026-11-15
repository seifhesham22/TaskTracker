using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Shared.Exceptions;

namespace TaskTracker.API.Shared.Dependencies
{
    public class TaskDependencyCycleGuard(ApplicationDbContext db) : ITaskDependencyCycleGuard
    {
        public async Task EnsureNoCycleAsync(TaskItem blocking, TaskItem blocked, string projectKey, CancellationToken ct)
        {
            var path = await FindPathAsync(from: blocked.Id, to: blocking.Id, ct);
            if (path is null)
                return;

            var numbers = await db.Set<TaskItem>()
                .AsNoTracking()
                .Where(t => path.Contains(t.Id))
                .ToDictionaryAsync(t => t.Id, t => t.Number, ct);

            var chain = string.Join(" → ", path.Select(id => TaskItem.ReadableId(projectKey, numbers[id])));
            var blockingId = TaskItem.ReadableId(projectKey, blocking.Number);
            var blockedId = TaskItem.ReadableId(projectKey, blocked.Number);

            throw new BadUserInputException(
                $"{blockingId} can't block {blockedId}: {blockedId} already blocks {blockingId} ({chain}), " +
                "so this would create a cycle.");
        }

        private async Task<List<Guid>?> FindPathAsync(Guid from, Guid to, CancellationToken ct)
        {
            var reachedFrom = new Dictionary<Guid, Guid?> { [from] = null };
            var level = new List<Guid> { from };

            while (level.Count > 0 && !reachedFrom.ContainsKey(to))
            {
                var links = await db.taskDependencies
                    .AsNoTracking()
                    .Where(d => level.Contains(d.BlockingTaskId))
                    .Select(d => new { d.BlockingTaskId, d.BlockedTaskId })
                    .ToListAsync(ct);

                level = [];
                foreach (var link in links)
                {
                    if (reachedFrom.TryAdd(link.BlockedTaskId, link.BlockingTaskId))
                        level.Add(link.BlockedTaskId);
                }
            }

            if (!reachedFrom.ContainsKey(to))
                return null;

            var path = new List<Guid>();
            for (Guid? id = to; id is Guid current; id = reachedFrom[current])
                path.Add(current);

            path.Reverse();
            return path;
        }
    }
}
