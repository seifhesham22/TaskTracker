using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Features.Tasks.GetTasks;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.Positions;

namespace TaskTracker.API.Features.Tasks.MoveTask
{
    public class MoveTaskHandler(ApplicationDbContext db, ITaskPositionService positions)
    {
        public async Task<TaskNode> HandleAsync(MoveTaskInput input, CancellationToken ct)
        {
            var task = await db.Set<TaskItem>()
                .Include(t => t.Project)
                .FirstOrDefaultAsync(t => t.Id == input.TaskId, ct)
                ?? throw new NotFoundException($"Task '{input.TaskId}' was not found.");

            if (!await db.boardColumns.AnyAsync(c => c.Id == input.ColumnId && c.BoardId == task.BoardId, ct))
                throw new NotFoundException($"Column '{input.ColumnId}' was not found on board '{task.BoardId}'.");

            if (task.ColumnId != input.ColumnId)
            {
                task.MoveTo(input.ColumnId, await positions.GetNextPositionAsync(input.ColumnId, ct));
                await db.SaveChangesAsync(ct);
            }

            return new TaskNode(task, task.Project.Key);
        }
    }
}