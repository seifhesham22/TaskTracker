using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Shared.Membership;

namespace TaskTracker.API.Features.Tasks.GetTasks
{
    public class GetTasksHandler(IDbContextFactory<ApplicationDbContext> _db, IProjectMembershipService membership)
    {
        public async Task<IReadOnlyList<TaskNode>> HandleAsync(Guid? boardId, Guid userId, CancellationToken ct)
        {
            IReadOnlyList<Guid> projectIds = [];

            if (boardId is Guid id)
                (await membership.GetRoleOnBoardAsync(id, userId, ct)).EnsureCanRead($"Board '{id}' was not found.");
            else
                projectIds = await membership.GetProjectIdsAsync(userId, ct);

            await using var db = await _db.CreateDbContextAsync(ct);

            var tasks = boardId is null
                ? db.Set<TaskItem>().AsNoTracking().Where(x => projectIds.Contains(x.ProjectId))
                : db.Set<TaskItem>().AsNoTracking().Where(x => x.BoardId == boardId);

            return await tasks
                .OrderBy(x => x.Number)
                .ThenBy(x => x.Id)
                .Select(x => new TaskNode(x, x.Project.Key))
                .ToListAsync(ct);
        }
    }
}
