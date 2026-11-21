using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Features.Tasks.GetTasks;
using TaskTracker.API.Shared.Concurrency;
using TaskTracker.API.Shared.Membership;
using TaskTracker.API.Shared.Tasks;

namespace TaskTracker.API.Features.Tasks.UnassignTask
{
    public class UnassignTaskHandler(ApplicationDbContext db, ITaskLookupService tasks)
    {
        public Task<TaskNode> HandleAsync(UnassignTaskInput input, Guid userId, CancellationToken ct) =>
            db.RetryOnConflictAsync(() => UnassignAsync(input, userId, ct));

        private async Task<TaskNode> UnassignAsync(UnassignTaskInput input, Guid userId, CancellationToken ct)
        {
            var (task, role) = await tasks.GetAsync(input.TaskId, userId, ct);
            role.EnsureCanEdit("Only writers and owners of the project can unassign tasks.");

            await db.Entry(task).Collection(t => t.Assignees).LoadAsync(ct);

            if (task.Unassign(input.UserId))
            {
                task.Project.Touch();
                await db.SaveChangesAsync(ct);
            }

            return new TaskNode(task, task.Project.Key);
        }
    }
}