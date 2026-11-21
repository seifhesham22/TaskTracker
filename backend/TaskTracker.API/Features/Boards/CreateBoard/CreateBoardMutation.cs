using System.Security.Claims;
using HotChocolate.Authorization;
using TaskTracker.API.Features.Boards.Nodes;
using TaskTracker.API.Shared.Auth;

namespace TaskTracker.API.Features.Boards.CreateBoard
{
    [MutationType]
    public class CreateBoardMutation
    {
        [Authorize]
        public Task<BoardNode> CreateBoardAsync(
            CreateBoardInput input,
            ClaimsPrincipal claimsPrincipal,
            [Service] CreateBoardHandler handler,
            CancellationToken cancellationToken)
            => handler.HandleAsync(input, claimsPrincipal.GetUserId(), cancellationToken);
    }
}
