using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Domain.Entities;

namespace TaskTracker.API.Shared.Positions
{
    public class TaskPositionService(ApplicationDbContext db) : ITaskPositionService
    {
        public async Task<string> GetNextPositionAsync(Guid columnId, CancellationToken ct)
        {
            var lastPosition = await db.Set<TaskItem>()
                .Where(t => t.ColumnId == columnId)
                .OrderByDescending(t => t.Position)
                .Select(t => t.Position)
                .FirstOrDefaultAsync(ct);

            return PositionKey.After(lastPosition);
        }
    }
}