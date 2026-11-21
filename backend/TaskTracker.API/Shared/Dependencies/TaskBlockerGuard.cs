using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Shared.Exceptions;

namespace TaskTracker.API.Shared.Dependencies
{
    public class TaskBlockerGuard(ApplicationDbContext db) : ITaskBlockerGuard
    {
        public async Task EnsureNotBlockedAsync(TaskItem task, string projectKey, CancellationToken ct)
        {
            var unfinished = await db.taskDependencies
                .AsNoTracking()
                .Where(d => d.BlockedTaskId == task.Id && d.BlockingTask.Column.Category != ColumnCategory.Done)
                .OrderBy(d => d.BlockingTask.Number)
                .Select(d => new { d.BlockingTask.Id, d.BlockingTask.Number, d.BlockingTask.Title })
                .ToListAsync(ct);

            if (unfinished.Count == 0)
                return;

            var blockers = unfinished
                .Select(b => new TaskBlocker(b.Id, TaskItem.ReadableId(projectKey, b.Number), b.Title))
                .ToList();

            var which = blockers.Count == 1 ? "this unfinished task" : $"these {blockers.Count} unfinished tasks";
            var until = blockers.Count == 1 ? "that task is" : "they are";
            var list = string.Join(", ", blockers.Select(b => $"{b.ReadableId} ({b.Title})"));

            throw new BlockedTaskException(
                $"{TaskItem.ReadableId(projectKey, task.Number)} is blocked by {which}: {list}. It can't be started until {until} done.",
                blockers);
        }
    }
}
