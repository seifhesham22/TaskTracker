using System.Security.Claims;
using TaskTracker.API.Shared.Auth;

namespace TaskTracker.API.Features.Auth.Logout
{
    public class LogoutHandler(ITokenRevocationService revocations)
    {
        public async Task<bool> HandleAsync(ClaimsPrincipal user, CancellationToken ct)
        {
            await revocations.RevokeAsync(user.GetTokenId(), user.GetUserId(), user.GetTokenExpiresAt(), ct);
            return true;
        }
    }
}