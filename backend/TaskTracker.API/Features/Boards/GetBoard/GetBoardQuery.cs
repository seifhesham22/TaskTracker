using System.Security.Claims;
using HotChocolate.Authorization;
using TaskTracker.API.Features.Boards.Nodes;
using TaskTracker.API.Shared.Auth;

namespace TaskTracker.API.Features.Boards.GetBoard
{
    [QueryType]
    public class GetBoardQuery
    {
        [Authorize]
        public Task<BoardNode> GetBoardAsync(
            Guid id,
            ClaimsPrincipal claimsPrincipal,
            [Service] GetBoardHandler handler,
            CancellationToken cancellationToken)
            => handler.HandleAsync(id, claimsPrincipal.GetUserId(), cancellationToken);
    }
}
