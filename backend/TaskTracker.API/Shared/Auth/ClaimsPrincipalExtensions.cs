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
    }
}
