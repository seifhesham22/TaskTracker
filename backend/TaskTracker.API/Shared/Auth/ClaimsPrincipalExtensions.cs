using System.Security.Claims;
using Microsoft.IdentityModel.JsonWebTokens;

namespace TaskTracker.API.Shared.Auth
{
    public static class ClaimsPrincipalExtensions
    {
        public static Guid GetUserId(this ClaimsPrincipal user) =>
            Guid.TryParse(user.FindFirstValue(JwtRegisteredClaimNames.Sub), out var userId)
                ? userId
                : throw new InvalidOperationException("The current user has no valid user id claim.");

        public static string GetTokenId(this ClaimsPrincipal user) =>
            user.FindFirstValue(JwtRegisteredClaimNames.Jti)
                ?? throw new InvalidOperationException("The current token has no token id claim.");

        public static DateTimeOffset GetTokenExpiresAt(this ClaimsPrincipal user) =>
            long.TryParse(user.FindFirstValue(JwtRegisteredClaimNames.Exp), out var seconds)
                ? DateTimeOffset.FromUnixTimeSeconds(seconds)
                : throw new InvalidOperationException("The current token has no valid expiry claim.");
    }
}