using System.Security.Claims;
using HotChocolate.Authorization;
using TaskTracker.API.Shared.Auth;

namespace TaskTracker.API.Features.Tasks.AddTaskDependency
{
    [MutationType]
    public class AddTaskDependencyMutation
    {
        [Authorize]
        public Task<TaskDependencyPayload> AddTaskDependencyAsync(
            AddTaskDependencyInput input,
            ClaimsPrincipal claimsPrincipal,
            [Service] AddTaskDependencyHandler handler,
            CancellationToken cancellationToken)
            => handler.HandleAsync(input, claimsPrincipal.GetUserId(), cancellationToken);
    }
}