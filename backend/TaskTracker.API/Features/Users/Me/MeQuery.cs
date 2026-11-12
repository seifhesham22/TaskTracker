using System.Security.Claims;
using HotChocolate.Authorization;
using TaskTracker.API.Features.Users.Nodes;
using TaskTracker.API.Shared.Auth;

namespace TaskTracker.API.Features.Users.Me
{
    [QueryType]
    public class MeQuery
    {
        [Authorize]
        public Task<UserNode> GetMeAsync(
            ClaimsPrincipal claimsPrincipal,
            [Service] GetMeHandler handler,
            CancellationToken cancellationToken)
            => handler.HandleAsync(claimsPrincipal.GetUserId(), cancellationToken);
    }
}
