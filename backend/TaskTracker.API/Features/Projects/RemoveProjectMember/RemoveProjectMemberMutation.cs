using System.Security.Claims;
using HotChocolate.Authorization;
using TaskTracker.API.Features.Projects.Nodes;
using TaskTracker.API.Shared.Auth;

namespace TaskTracker.API.Features.Projects.RemoveProjectMember
{
    [MutationType]
    public class RemoveProjectMemberMutation
    {
        [Authorize]
        public Task<ProjectMemberNode> RemoveProjectMemberAsync(
            RemoveProjectMemberInput input,
            ClaimsPrincipal claimsPrincipal,
            [Service] RemoveProjectMemberHandler handler,
            CancellationToken cancellationToken)
            => handler.HandleAsync(input, claimsPrincipal.GetUserId(), cancellationToken);
    }
}