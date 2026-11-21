using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Domain.Enums;

namespace TaskTracker.API.Shared.Membership
{
    public class ProjectMembershipService(IDbContextFactory<ApplicationDbContext> _db) : IProjectMembershipService
    {
        public async Task<ProjectRole?> GetRoleAsync(Guid projectId, Guid userId, CancellationToken ct)
        {
            await using var db = await _db.CreateDbContextAsync(ct);

            return await db.projects
                .Where(p => p.Id == projectId)
                .SelectMany(p => p.ProjectMembers)
                .Where(m => m.UserId == userId)
                .Select(m => (ProjectRole?)m.ProjectRole)
                .FirstOrDefaultAsync(ct);
        }

        public async Task<ProjectRole?> GetRoleOnBoardAsync(Guid boardId, Guid userId, CancellationToken ct)
        {
            await using var db = await _db.CreateDbContextAsync(ct);

            return await db.boards
                .Where(b => b.Id == boardId && !b.IsDeleted && !b.Project.IsDeleted)
                .SelectMany(b => b.Project.ProjectMembers)
                .Where(m => m.UserId == userId)
                .Select(m => (ProjectRole?)m.ProjectRole)
                .FirstOrDefaultAsync(ct);
        }

        public async Task<IReadOnlyList<Guid>> GetProjectIdsAsync(Guid userId, CancellationToken ct)
        {
            await using var db = await _db.CreateDbContextAsync(ct);

            return await db.projects
                .Where(p => p.ProjectMembers.Any(m => m.UserId == userId))
                .Select(p => p.Id)
                .ToListAsync(ct);
        }
    }
}
