using System.Security.Claims;
using HotChocolate.Authorization;
using TaskTracker.API.Features.Projects.Nodes;
using TaskTracker.API.Shared.Auth;
using TaskTracker.API.Shared.Exceptions;

namespace TaskTracker.API.Features.Projects.GetProjects
{
    [QueryType]
    public class GetProjectsQuery
    {
        [Authorize]
        public Task<IReadOnlyList<ProjectNode>> GetProjectsAsync(
            Guid? userId,
            ClaimsPrincipal claimsPrincipal,
            [Service] GetProjectsHandler handler,
            CancellationToken cancellationToken)
        {
            var currentUserId = claimsPrincipal.GetUserId();

            if (userId is Guid requested && requested != currentUserId)
                throw new ForbiddenException("You can only list your own projects.");

            return handler.HandleAsync(currentUserId, cancellationToken);
        }
    }
}
