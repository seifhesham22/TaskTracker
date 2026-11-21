using System.Security.Claims;
using HotChocolate.Authorization;
using TaskTracker.API.Features.Tasks.GetTasks;
using TaskTracker.API.Shared.Auth;

namespace TaskTracker.API.Features.Tasks.RankTask
{
    [MutationType]
    public class RankTaskMutation
    {
        [Authorize]
        public Task<TaskNode> RankTaskAsync(
            RankTaskInput input,
            ClaimsPrincipal claimsPrincipal,
            [Service] RankTaskHandler handler,
            CancellationToken cancellationToken)
            => handler.HandleAsync(input, claimsPrincipal.GetUserId(), cancellationToken);
    }
}
