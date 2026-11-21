using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Features.Tasks.GetTasks;
using TaskTracker.API.Shared.Concurrency;
using TaskTracker.API.Shared.Dependencies;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.Membership;
using TaskTracker.API.Shared.Tasks;

namespace TaskTracker.API.Features.Tasks.AddTaskDependency
{
    public class AddTaskDependencyHandler(
        ApplicationDbContext db,
        ITaskLookupService tasks,
        IProjectMembershipService membership,
        ITaskDependencyCycleGuard cycles)
    {
        public Task<TaskDependencyPayload> HandleAsync(AddTaskDependencyInput input, Guid userId, CancellationToken ct)
        {
            var dependency = new TaskDependency(input.BlockingTaskId, input.BlockedTaskId);

            return db.RetryOnConflictAsync(() => AddAsync(dependency, userId, ct));
        }

        private async Task<TaskDependencyPayload> AddAsync(TaskDependency dependency, Guid userId, CancellationToken ct)
        {
            var blocking = await tasks.GetAsync(dependency.BlockingTaskId, ct);
            var blocked = await tasks.GetAsync(dependency.BlockedTaskId, ct);

            var role = await membership.GetRoleAsync(blocking.ProjectId, userId, ct)
                ?? throw new NotFoundException($"Task '{blocking.Id}' was not found.");

            if (blocked.ProjectId != blocking.ProjectId)
            {
                if (await membership.GetRoleAsync(blocked.ProjectId, userId, ct) is null)
                    throw new NotFoundException($"Task '{blocked.Id}' was not found.");

                throw new BadUserInputException(
                    $"{ReadableId(blocking)} and {ReadableId(blocked)} are in different projects. " +
                    "A task can only block a task of the same project.");
            }

            if (!role.CanEdit())
                throw new ForbiddenException("Only writers and owners of the project can add dependencies.");

            if (!await ExistsAsync(dependency, ct))
            {
                await cycles.EnsureNoCycleAsync(blocking, blocked, blocking.Project.Key, ct);

                db.taskDependencies.Add(new TaskDependency(dependency.BlockingTaskId, dependency.BlockedTaskId));
                blocking.Project.Touch();
                await db.SaveChangesAsync(ct);
            }

            return new TaskDependencyPayload(
                new TaskNode(blocking, blocking.Project.Key),
                new TaskNode(blocked, blocked.Project.Key));
        }

        private Task<bool> ExistsAsync(TaskDependency dependency, CancellationToken ct) =>
            db.taskDependencies.AnyAsync(
                d => d.BlockingTaskId == dependency.BlockingTaskId && d.BlockedTaskId == dependency.BlockedTaskId, ct);

        private static string ReadableId(TaskItem task) => TaskItem.ReadableId(task.Project.Key, task.Number);
    }
}