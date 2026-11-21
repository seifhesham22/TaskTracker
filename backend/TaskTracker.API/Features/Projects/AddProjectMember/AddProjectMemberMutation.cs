using System.Security.Claims;
using HotChocolate.Authorization;
using TaskTracker.API.Features.Projects.Nodes;
using TaskTracker.API.Shared.Auth;

namespace TaskTracker.API.Features.Projects.AddProjectMember
{
    [MutationType]
    public class AddProjectMemberMutation
    {
        [Authorize]
        public Task<ProjectMemberNode> AddProjectMemberAsync(
            AddProjectMemberInput input,
            ClaimsPrincipal claimsPrincipal,
            [Service] AddProjectMemberHandler handler,
            CancellationToken cancellationToken)
            => handler.HandleAsync(input, claimsPrincipal.GetUserId(), cancellationToken);
    }
}