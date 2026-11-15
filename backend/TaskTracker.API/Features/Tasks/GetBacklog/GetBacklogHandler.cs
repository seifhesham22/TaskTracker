using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Features.Tasks.GetTasks;
using TaskTracker.API.Shared.Exceptions;

namespace TaskTracker.API.Features.Tasks.GetBacklog
{
    public class GetBacklogHandler(IDbContextFactory<ApplicationDbContext> _db)
    {
        public const int DefaultPageSize = 20;
        public const int MaxPageSize = 100;
        public const int MaxSearchLength = TaskItem.TitleMaxLength;

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

            var term = search?.Trim() ?? "";
            if (term.Length > MaxSearchLength)
                throw new BadUserInputException($"Search cannot be longer than {MaxSearchLength} characters.");

            await using var db = await _db.CreateDbContextAsync(ct);

            var isMember = await db.projects.AnyAsync(
                p => p.Id == projectId && p.ProjectMembers.Any(m => m.UserId == userId), ct);

            if (!isMember)
                throw new NotFoundException($"Project '{projectId}' was not found.");

            var query = db.Set<TaskItem>()
                .AsNoTracking()
                .Where(t => t.ProjectId == projectId && !t.Board.IsDeleted);

            if (where is not null)
                query = query.Where(where);

            if (term.Length > 0)
            {
                var pattern = $"%{EscapeLike(term)}%";
                query = query.Where(t => EF.Functions.ILike(t.Title, pattern, @"\"));
            }

            var totalCount = await query.CountAsync(ct);
            var skip = (long)(page - 1) * pageSize;

            if (skip >= totalCount)
                return new BacklogPage([], totalCount, page, pageSize);

            var items = await query
                .OrderBy(t => t.Board.Position).ThenBy(t => t.BoardId)
                .ThenBy(t => t.Column.Position).ThenBy(t => t.ColumnId)
                .ThenBy(t => t.Position).ThenBy(t => t.Id)
                .Skip((int)skip)
                .Take(pageSize)
                .Select(t => new TaskNode(t, t.Project.Key))
                .ToListAsync(ct);

            return new BacklogPage(items, totalCount, page, pageSize);
        }

        private static string EscapeLike(string text) =>
            text.Replace(@"\", @"\\").Replace("%", @"\%").Replace("_", @"\_");
    }
}
