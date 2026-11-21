using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Features.Tasks.GetTasks;
using TaskTracker.API.Shared.Concurrency;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.Membership;
using TaskTracker.API.Shared.Positions;
using TaskTracker.API.Shared.Tasks;

namespace TaskTracker.API.Features.Tasks.RankTask
{
    public class RankTaskHandler(ApplicationDbContext db, ITaskLookupService tasks)
    {
        public const int MaxRankLength = 64;

        public Task<TaskNode> HandleAsync(RankTaskInput input, Guid userId, CancellationToken ct) =>
            db.RetryOnConflictAsync(() => RankAsync(input, userId, ct));

        private async Task<TaskNode> RankAsync(RankTaskInput input, Guid userId, CancellationToken ct)
        {
            var (task, role) = await tasks.GetAsync(input.TaskId, userId, ct);
            role.EnsureCanEdit("Only writers and owners of the project can change the backlog order.");

            var low = input.AfterTaskId is Guid afterTaskId
                ? await RankOfTaskBeforeAsync(task, afterTaskId, ct)
                : null;

            var others = db.Set<TaskItem>().Where(t => t.ProjectId == task.ProjectId && t.Id != task.Id);
            if (low is not null)
                others = others.Where(t => t.Rank.CompareTo(low) > 0);

            var high = await others
                .OrderBy(t => t.Rank)
                .ThenBy(t => t.Id)
                .Select(t => t.Rank)
                .FirstOrDefaultAsync(ct);

            var alreadyThere = (low is null || string.CompareOrdinal(task.Rank, low) > 0)
                && (high is null || string.CompareOrdinal(task.Rank, high) < 0);

            if (!alreadyThere)
            {
                var rank = PositionKey.Between(low, high);

                if (rank.Length <= MaxRankLength)
                    task.ChangeRank(rank);
                else
                    await RenumberBacklogAsync(task, input.AfterTaskId, ct);

                task.Project.Touch();
                await db.SaveChangesAsync(ct);
            }

            return new TaskNode(task, task.Project.Key);
        }

        private async Task<string> RankOfTaskBeforeAsync(TaskItem task, Guid afterTaskId, CancellationToken ct)
        {
            if (afterTaskId == task.Id)
                throw new BadUserInputException("A task can't be placed after itself.");

            return await db.Set<TaskItem>()
                .Where(t => t.Id == afterTaskId && t.ProjectId == task.ProjectId)
                .Select(t => t.Rank)
                .FirstOrDefaultAsync(ct)
                ?? throw new NotFoundException($"Task '{afterTaskId}' was not found in this project.");
        }

        private async Task RenumberBacklogAsync(TaskItem task, Guid? afterTaskId, CancellationToken ct)
        {
            var backlog = await db.Set<TaskItem>()
                .IgnoreQueryFilters()
                .Where(t => t.ProjectId == task.ProjectId && t.Id != task.Id)
                .OrderBy(t => t.Rank)
                .ThenBy(t => t.Id)
                .ToListAsync(ct);

            var place = afterTaskId is Guid id ? backlog.FindIndex(t => t.Id == id) + 1 : 0;
            backlog.Insert(place, task);

            for (var i = 0; i < backlog.Count; i++)
                backlog[i].ChangeRank((i + 1).ToString("D10"));
        }
    }
}
