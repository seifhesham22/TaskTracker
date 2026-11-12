namespace TaskTracker.API.Shared.Auth
{
    public sealed record AccessToken(string Token, DateTimeOffset ExpiresAt);

    public interface IAccessTokenService
    {
        AccessToken Create(Guid userId, string email);
    }
}