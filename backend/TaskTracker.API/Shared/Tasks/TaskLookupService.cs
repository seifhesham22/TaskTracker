using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.Membership;

namespace TaskTracker.API.Shared.Tasks
{
    public class TaskLookupService(ApplicationDbContext db, IProjectMembershipService membership) : ITaskLookupService
    {
        public async Task<MemberTask> GetAsync(Guid taskId, Guid userId, CancellationToken ct)
        {
            var notFound = $"Task '{taskId}' was not found.";

            var task = await db.Set<TaskItem>()
                .Include(t => t.Project)
                .FirstOrDefaultAsync(t => t.Id == taskId, ct)
                ?? throw new NotFoundException(notFound);

            var role = await membership.GetRoleAsync(task.ProjectId, userId, ct);
            return new MemberTask(task, role.EnsureCanRead(notFound));
        }
    }
}
