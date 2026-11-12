using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Features.Tasks.GetTasks;
using TaskTracker.API.Shared.Completion;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.Positions;

namespace TaskTracker.API.Features.Tasks.MoveTask
{
    public class MoveTaskHandler(ApplicationDbContext db, ITaskPositionService positions, ITaskCompletionGuard completion)
    {
        public async Task<TaskNode> HandleAsync(MoveTaskInput input, CancellationToken ct)
        {
            var task = await db.Set<TaskItem>()
                .Include(t => t.Project)
                .FirstOrDefaultAsync(t => t.Id == input.TaskId, ct)
                ?? throw new NotFoundException($"Task '{input.TaskId}' was not found.");

            var targetCategory = await db.boardColumns
                .Where(c => c.Id == input.ColumnId && c.BoardId == task.BoardId)
                .Select(c => (ColumnCategory?)c.Category)
                .FirstOrDefaultAsync(ct)
                ?? throw new NotFoundException($"Column '{input.ColumnId}' was not found on board '{task.BoardId}'.");

            if (task.ColumnId != input.ColumnId)
            {
                if (targetCategory == ColumnCategory.Done)
                    await completion.EnsureSubtasksAreDoneAsync(task, task.Project.Key, ct);

                task.MoveTo(input.ColumnId, await positions.GetNextPositionAsync(input.ColumnId, ct));
                await db.SaveChangesAsync(ct);
            }

            return new TaskNode(task, task.Project.Key);
        }
    }
}