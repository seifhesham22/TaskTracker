using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Features.Boards.Nodes;
using TaskTracker.API.Shared.Exceptions;

namespace TaskTracker.API.Features.Boards.GetBoard
{
    public class GetBoardHandler(IDbContextFactory<ApplicationDbContext> _db)
    {
        public async Task<BoardNode> HandleAsync(Guid boardId, CancellationToken ct)
        {
            await using var db = await _db.CreateDbContextAsync(ct);

            return await db.boards
                .AsNoTracking()
                .Where(x => x.Id == boardId && !x.IsDeleted)
                .Select(x => new BoardNode(x.Id, x.ProjectId, x.Name))
                .FirstOrDefaultAsync(ct)
                ?? throw new NotFoundException($"Board '{boardId}' was not found.");
        }
    }
}