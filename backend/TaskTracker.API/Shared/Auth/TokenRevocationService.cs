using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Domain.Entities;

namespace TaskTracker.API.Shared.Auth
{
    public class TokenRevocationService(IDbContextFactory<ApplicationDbContext> _db, TimeProvider time) : ITokenRevocationService
    {
        public async Task RevokeAsync(string tokenId, Guid userId, DateTimeOffset expiresAt, CancellationToken ct)
        {
            await using var db = await _db.CreateDbContextAsync(ct);
            var now = time.GetUtcNow().UtcDateTime;

            await db.revokedTokens
                .Where(x => x.ExpiresAt < now)
                .ExecuteDeleteAsync(ct);

            if (await db.revokedTokens.AnyAsync(x => x.TokenId == tokenId, ct))
                return;

            db.revokedTokens.Add(new RevokedToken(tokenId, userId, expiresAt.UtcDateTime, now));

            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException)
            {
                if (!await IsRevokedAsync(tokenId, ct))
                    throw;
            }
        }

        public async Task<bool> IsRevokedAsync(string tokenId, CancellationToken ct)
        {
            await using var db = await _db.CreateDbContextAsync(ct);
            return await db.revokedTokens.AnyAsync(x => x.TokenId == tokenId, ct);
        }
    }
}