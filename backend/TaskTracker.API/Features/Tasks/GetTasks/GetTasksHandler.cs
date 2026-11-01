using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Shared.Exceptions;

namespace TaskTracker.API.Features.Tasks.GetTasks
{
    public class GetTasksHandler(IDbContextFactory<ApplicationDbContext> _db)
    {
        public async Task<IReadOnlyList<TaskNode>> HandleAsync(Guid? boardId, CancellationToken ct)
        {
            await using var db = await _db.CreateDbContextAsync(ct);

            if (boardId is not null && !await db.boards.AnyAsync(x => x.Id == boardId, ct))
                throw new NotFoundException($"Board '{boardId}' was not found.");

            var query = db.Set<TaskItem>().AsNoTracking();

            if (boardId is not null)
                query = query.Where(x => x.BoardId == boardId);

            return await query
                .OrderBy(x => x.Number)
                .ThenBy(x => x.Id)
                .Select(x => new TaskNode(x, x.Project.Key))
                .ToListAsync(ct);
        }
    }
}