using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Features.Tasks.GetTasks;
using TaskTracker.API.Shared.Concurrency;
using TaskTracker.API.Shared.Membership;
using TaskTracker.API.Shared.Tasks;

namespace TaskTracker.API.Features.Tasks.AssignTask
{
    public class AssignTaskHandler(ApplicationDbContext db, ITaskLookupService tasks, IProjectMembershipService membership)
    {
        public Task<TaskNode> HandleAsync(AssignTaskInput input, Guid userId, CancellationToken ct) =>
            db.RetryOnConflictAsync(() => AssignAsync(input, userId, ct));

        private async Task<TaskNode> AssignAsync(AssignTaskInput input, Guid userId, CancellationToken ct)
        {
            var (task, role) = await tasks.GetAsync(input.TaskId, userId, ct);
            role.EnsureCanEdit("Only writers and owners of the project can assign tasks.");

            await membership.EnsureCanBeAssignedAsync(task.ProjectId, task.Project.Key, input.UserId, ct);
            await db.Entry(task).Collection(t => t.Assignees).LoadAsync(ct);

            if (task.AssignTo(input.UserId))
            {
                task.Project.Touch();
                await db.SaveChangesAsync(ct);
            }

            return new TaskNode(task, task.Project.Key);
        }
    }
}