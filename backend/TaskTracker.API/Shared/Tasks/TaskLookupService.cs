using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Shared.Exceptions;

namespace TaskTracker.API.Shared.Tasks
{
    public class TaskLookupService(ApplicationDbContext db) : ITaskLookupService
    {
        public async Task<TaskItem> GetAsync(Guid taskId, CancellationToken ct) =>
            await db.Set<TaskItem>()
                .Include(t => t.Project)
                .FirstOrDefaultAsync(t => t.Id == taskId, ct)
            ?? throw new NotFoundException($"Task '{taskId}' was not found.");
    }
}
