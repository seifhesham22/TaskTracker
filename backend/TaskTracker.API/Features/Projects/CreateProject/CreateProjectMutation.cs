using System.Security.Claims;
using HotChocolate.Authorization;
using TaskTracker.API.Features.Projects.Nodes;
using TaskTracker.API.Shared.Auth;

namespace TaskTracker.API.Features.Projects.CreateProject
{
    [MutationType]
    public class CreateProjectMutation
    {
        [Authorize]
        public Task<ProjectNode> CreateProjectAsync(
            CreateProjectInput input,
            ClaimsPrincipal claimsPrincipal,
            [Service] CreateProjectHandler handler,
            CancellationToken cancellationToken)
            => handler.HandleAsync(input, claimsPrincipal.GetUserId(), cancellationToken);
    }
}