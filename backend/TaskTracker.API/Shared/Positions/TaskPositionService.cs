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

        public async Task<string> GetNextRankAsync(Guid projectId, CancellationToken ct)
        {
            var lastRank = await db.Set<TaskItem>()
                .IgnoreQueryFilters()
                .Where(t => t.ProjectId == projectId)
                .OrderByDescending(t => t.Rank)
                .Select(t => t.Rank)
                .FirstOrDefaultAsync(ct);

            return PositionKey.After(lastRank);
        }
    }
}