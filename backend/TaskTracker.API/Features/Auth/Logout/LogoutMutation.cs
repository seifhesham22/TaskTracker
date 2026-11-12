using System.Security.Claims;
using HotChocolate.Authorization;

namespace TaskTracker.API.Features.Auth.Logout
{
    [MutationType]
    public class LogoutMutation
    {
        [Authorize]
        public Task<bool> LogoutAsync(
            ClaimsPrincipal claimsPrincipal,
            [Service] LogoutHandler handler,
            CancellationToken cancellationToken)
            => handler.HandleAsync(claimsPrincipal, cancellationToken);
    }
}