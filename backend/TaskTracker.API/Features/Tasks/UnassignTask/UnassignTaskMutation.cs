using System.Security.Claims;
using HotChocolate.Authorization;
using TaskTracker.API.Features.Tasks.GetTasks;
using TaskTracker.API.Shared.Auth;

namespace TaskTracker.API.Features.Tasks.UnassignTask
{
    [MutationType]
    public class UnassignTaskMutation
    {
        [Authorize]
        public Task<TaskNode> UnassignTaskAsync(
            UnassignTaskInput input,
            ClaimsPrincipal claimsPrincipal,
            [Service] UnassignTaskHandler handler,
            CancellationToken cancellationToken)
            => handler.HandleAsync(input, claimsPrincipal.GetUserId(), cancellationToken);
    }
}
