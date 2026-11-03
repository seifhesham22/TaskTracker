using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Features.Projects.Nodes;

namespace TaskTracker.API.Data.DataLoaders
{
    public class MembersByProjectIdDataLoader(
        IDbContextFactory<ApplicationDbContext> db,
        IBatchScheduler scheduler,
        DataLoaderOptions options)
        : GroupedDataLoader<Guid, ProjectMemberNode>(scheduler, options)
    {
        protected override async Task<ILookup<Guid, ProjectMemberNode>> LoadGroupedBatchAsync(IReadOnlyList<Guid> keys, CancellationToken cancellationToken)
        {
            await using var _db = await db.CreateDbContextAsync(cancellationToken);

            var rows = await _db.projectMembers
                .AsNoTracking()
                .Where(x => keys.Contains(x.ProjectId))
                .OrderBy(x => x.User.UserName)
                .Select(x => new { x.ProjectId, ProjectMember = new ProjectMemberNode(x.ProjectId, x.UserId, x.User.UserName!, x.ProjectRole, x.JoinedAt) })
                .ToListAsync(cancellationToken);

            return rows.ToLookup(x => x.ProjectId, x => x.ProjectMember);
        }
    }
}