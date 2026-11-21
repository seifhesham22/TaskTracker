using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Features.Tasks.GetTasks;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.Filtering;
using TaskTracker.API.Shared.Membership;

namespace TaskTracker.API.Features.Tasks.GetBacklog
{
    public class GetBacklogHandler(IDbContextFactory<ApplicationDbContext> _db, IProjectMembershipService membership)
    {
        public const int DefaultPageSize = 20;
        public const int MaxPageSize = 100;

        public async Task<BacklogPage> HandleAsync(
            Guid projectId,
            Guid userId,
            string? search,
            Expression<Func<TaskItem, bool>>? where,
            int page,
            int pageSize,
            CancellationToken ct)
        {
            if (page < 1)
                throw new BadUserInputException("Page must be 1 or more.");
            if (pageSize is < 1 or > MaxPageSize)
                throw new BadUserInputException($"Page size must be between 1 and {MaxPageSize}.");

            var term = TaskTitleSearch.Normalize(search);

            (await membership.GetRoleAsync(projectId, userId, ct)).EnsureCanRead($"Project '{projectId}' was not found.");

            await using var db = await _db.CreateDbContextAsync(ct);

            var query = db.Set<TaskItem>()
                .AsNoTracking()
                .Where(t => t.ProjectId == projectId && !t.Board.IsDeleted);

            if (where is not null)
                query = query.Where(where);

            query = query.WithTitleContaining(term);

            var totalCount = await query.CountAsync(ct);
            var skip = (long)(page - 1) * pageSize;

            if (skip >= totalCount)
                return new BacklogPage([], totalCount, page, pageSize);

            var items = await query
                .OrderBy(t => t.Rank).ThenBy(t => t.Id)
                .Skip((int)skip)
                .Take(pageSize)
                .Select(t => new TaskNode(t, t.Project.Key))
                .ToListAsync(ct);

            return new BacklogPage(items, totalCount, page, pageSize);
        }
    }
}
