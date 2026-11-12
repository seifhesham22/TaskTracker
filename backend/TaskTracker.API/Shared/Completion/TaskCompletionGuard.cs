using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Shared.Exceptions;

namespace TaskTracker.API.Shared.Completion
{
    public class TaskCompletionGuard(ApplicationDbContext db) : ITaskCompletionGuard
    {
        public async Task EnsureSubtasksAreDoneAsync(TaskItem task, string projectKey, CancellationToken ct)
        {
            var openSubtasks = await db.Set<TaskItem>()
                .AsNoTracking()
                .Where(t => t.ParentTaskId == task.Id && t.Column.Category != ColumnCategory.Done)
                .OrderBy(t => t.Number)
                .Select(t => new { t.Id, t.Number, t.Title })
                .ToListAsync(ct);

            if (openSubtasks.Count == 0)
                return;

            var subtasks = openSubtasks
                .Select(t => new IncompleteSubtask(t.Id, TaskItem.ReadableId(projectKey, t.Number), t.Title))
                .ToList();

            var which = subtasks.Count == 1 ? "this subtask is" : $"these {subtasks.Count} subtasks are";
            var list = string.Join(", ", subtasks.Select(s => $"{s.ReadableId} ({s.Title})"));

            throw new IncompleteSubtasksException(
                $"{TaskItem.ReadableId(projectKey, task.Number)} can't be completed while {which} not done: {list}.",
                subtasks);
        }
    }
}