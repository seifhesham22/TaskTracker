namespace TaskTracker.API.Shared.Auth
{
    public interface ITokenRevocationService
    {
        Task RevokeAsync(string tokenId, Guid userId, DateTimeOffset expiresAt, CancellationToken ct);
        Task<bool> IsRevokedAsync(string tokenId, CancellationToken ct);
    }
}
