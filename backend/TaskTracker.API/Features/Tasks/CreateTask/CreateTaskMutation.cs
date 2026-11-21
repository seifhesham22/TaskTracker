using System.Security.Claims;
using HotChocolate.Authorization;
using TaskTracker.API.Shared.Auth;

namespace TaskTracker.API.Features.Tasks.CreateTask
{
    [MutationType]
    public class CreateTaskMutation
    {
        [Authorize]
        public Task<TaskDto> CreateTaskAsync(
            CreateTaskInput input,
            ClaimsPrincipal claimsPrincipal,
            [Service] CreateTaskHandler handler,
            CancellationToken cancellationToken)
            => handler.HandleAsync(input, claimsPrincipal.GetUserId(), cancellationToken);
    }
}
