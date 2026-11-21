using System.Security.Claims;
using HotChocolate.Authorization;
using TaskTracker.API.Features.Projects.Nodes;
using TaskTracker.API.Shared.Auth;

namespace TaskTracker.API.Features.Projects.GetWorkload
{
    [QueryType]
    public class GetWorkloadQuery
    {
        [Authorize]
        public Task<ProjectWorkloadNode> GetWorkloadAsync(
            Guid projectId,
            ClaimsPrincipal claimsPrincipal,
            [Service] GetWorkloadHandler handler,
            CancellationToken cancellationToken)
            => handler.HandleAsync(projectId, claimsPrincipal.GetUserId(), cancellationToken);
    }
}
