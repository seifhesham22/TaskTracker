using HotChocolate.Authorization;
using TaskTracker.API.Features.Projects.Nodes;

namespace TaskTracker.API.Features.Projects.GetProjects
{
    [QueryType]
    public class GetProjectsQuery
    {
        [Authorize]
        public Task<IReadOnlyList<ProjectNode>> GetProjectsAsync(
            Guid userId,
            [Service] GetProjectsHandler handler,
            CancellationToken cancellationToken)
            => handler.HandleAsync(userId, cancellationToken);
    }
}
