using System.Security.Claims;
using HotChocolate.Authorization;
using TaskTracker.API.Features.Tasks.GetTasks;
using TaskTracker.API.Shared.Auth;

namespace TaskTracker.API.Features.Tasks.AssignTask
{
    [MutationType]
    public class AssignTaskMutation
    {
        [Authorize]
        public Task<TaskNode> AssignTaskAsync(
            AssignTaskInput input,
            ClaimsPrincipal claimsPrincipal,
            [Service] AssignTaskHandler handler,
            CancellationToken cancellationToken)
            => handler.HandleAsync(input, claimsPrincipal.GetUserId(), cancellationToken);
    }
}
