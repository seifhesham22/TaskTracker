using System.Security.Claims;
using HotChocolate.Authorization;
using TaskTracker.API.Shared.Auth;

namespace TaskTracker.API.Features.Tasks.GetTasks
{
    [QueryType]
    public class GetTasksQuery
    {
        [Authorize]
        public Task<IReadOnlyList<TaskNode>> GetTasksAsync(
            Guid? boardId,
            ClaimsPrincipal claimsPrincipal,
            [Service] GetTasksHandler handler,
            CancellationToken cancellationToken)
            => handler.HandleAsync(boardId, claimsPrincipal.GetUserId(), cancellationToken);
    }
}
