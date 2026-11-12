using HotChocolate.Authorization;
using TaskTracker.API.Features.Tasks.GetTasks;

namespace TaskTracker.API.Features.Tasks.UpdateTask
{
    [MutationType]
    public class UpdateTaskMutation
    {
        [Authorize]
        public Task<TaskNode> UpdateTaskAsync(
            UpdateTaskInput input,
            [Service] UpdateTaskHandler handler,
            CancellationToken cancellationToken)
            => handler.HandleAsync(input, cancellationToken);
    }
}
