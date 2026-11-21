using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Features.Tasks.GetTasks;
using TaskTracker.API.Shared.Completion;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.Membership;
using TaskTracker.API.Shared.Positions;
using TaskTracker.API.Shared.Tasks;

namespace TaskTracker.API.Features.Tasks.MoveTask
{
    public class MoveTaskHandler(
        ApplicationDbContext db,
        ITaskLookupService tasks,
        ITaskPositionService positions,
        ITaskCompletionGuard completion)
    {
        public async Task<TaskNode> HandleAsync(MoveTaskInput input, Guid userId, CancellationToken ct)
        {
            var (task, role) = await tasks.GetAsync(input.TaskId, userId, ct);
            role.EnsureCanEdit("Only writers and owners of the project can move tasks.");

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