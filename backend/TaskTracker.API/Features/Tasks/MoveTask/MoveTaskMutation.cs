using System.Security.Claims;
using HotChocolate.Authorization;
using TaskTracker.API.Features.Tasks.GetTasks;
using TaskTracker.API.Shared.Auth;

namespace TaskTracker.API.Features.Tasks.MoveTask
{
    [MutationType]
    public class MoveTaskMutation
    {
        [Authorize]
        public Task<TaskNode> MoveTaskAsync(
            MoveTaskInput input,
            ClaimsPrincipal claimsPrincipal,
            [Service] MoveTaskHandler handler,
            CancellationToken cancellationToken)
            => handler.HandleAsync(input, claimsPrincipal.GetUserId(), cancellationToken);
    }
}
