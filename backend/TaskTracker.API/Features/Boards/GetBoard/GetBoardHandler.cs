using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Features.Boards.Nodes;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.Membership;

namespace TaskTracker.API.Features.Boards.GetBoard
{
    public class GetBoardHandler(IDbContextFactory<ApplicationDbContext> _db, IProjectMembershipService membership)
    {
        public async Task<BoardNode> HandleAsync(Guid boardId, Guid userId, CancellationToken ct)
        {
            var notFound = $"Board '{boardId}' was not found.";
            (await membership.GetRoleOnBoardAsync(boardId, userId, ct)).EnsureCanRead(notFound);

            await using var db = await _db.CreateDbContextAsync(ct);

            return await db.boards
                .AsNoTracking()
                .Where(x => x.Id == boardId && !x.IsDeleted)
                .Select(x => new BoardNode(x.Id, x.ProjectId, x.Name))
                .FirstOrDefaultAsync(ct)
                ?? throw new NotFoundException(notFound);
        }
    }
}
