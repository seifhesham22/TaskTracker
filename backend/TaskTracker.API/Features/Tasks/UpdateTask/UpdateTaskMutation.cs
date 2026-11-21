using System.Security.Claims;
using HotChocolate.Authorization;
using TaskTracker.API.Features.Tasks.GetTasks;
using TaskTracker.API.Shared.Auth;

namespace TaskTracker.API.Features.Tasks.UpdateTask
{
    [MutationType]
    public class UpdateTaskMutation
    {
        [Authorize]
        public Task<TaskNode> UpdateTaskAsync(
            UpdateTaskInput input,
            ClaimsPrincipal claimsPrincipal,
            [Service] UpdateTaskHandler handler,
            CancellationToken cancellationToken)
            => handler.HandleAsync(input, claimsPrincipal.GetUserId(), cancellationToken);
    }
}
