using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Features.Users.Nodes;
using TaskTracker.API.Shared.Exceptions;

namespace TaskTracker.API.Features.Users.Me
{
    public class GetMeHandler(IDbContextFactory<ApplicationDbContext> _db)
    {
        public async Task<UserNode> HandleAsync(Guid userId, CancellationToken ct)
        {
            await using var db = await _db.CreateDbContextAsync(ct);

            return await db.Users
                .AsNoTracking()
                .Where(x => x.Id == userId)
                .Select(x => new UserNode(x.Id, x.Email!))
                .FirstOrDefaultAsync(ct)
                ?? throw new NotFoundException($"User '{userId}' was not found.");
        }
    }
}
