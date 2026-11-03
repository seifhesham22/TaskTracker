using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Features.Projects.Nodes;
using TaskTracker.API.Shared.Exceptions;

namespace TaskTracker.API.Features.Projects.GetProjects
{
    public class GetProjectsHandler(IDbContextFactory<ApplicationDbContext> _db)
    {
        public async Task<IReadOnlyList<ProjectNode>> HandleAsync(Guid userId, CancellationToken ct)
        {
            await using var db = await _db.CreateDbContextAsync(ct);

            if (!await db.Users.AnyAsync(x => x.Id == userId, ct))
                throw new NotFoundException($"User '{userId}' was not found.");

            return await db.projectMembers
                .AsNoTracking()
                .Where(x => x.UserId == userId)
                .OrderBy(x => x.Project.Name)
                .ThenBy(x => x.ProjectId)
                .Select(x => new ProjectNode(x.Project, x.ProjectRole))
                .ToListAsync(ct);
        }
    }
}
