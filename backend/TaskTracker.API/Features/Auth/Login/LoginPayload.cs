using TaskTracker.API.Features.Users.Nodes;

namespace TaskTracker.API.Features.Auth.Login
{
    public sealed record LoginPayload(string AccessToken, string TokenType, DateTimeOffset ExpiresAt, UserNode User);
}