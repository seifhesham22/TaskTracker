using TaskTracker.API.Features.Tasks.GetTasks;

namespace TaskTracker.API.Features.Tasks.MoveTask
{
    [MutationType]
    public class MoveTaskMutation
    {
        public Task<TaskNode> MoveTaskAsync(
            MoveTaskInput input,
            [Service] MoveTaskHandler handler,
            CancellationToken cancellationToken)
            => handler.HandleAsync(input, cancellationToken);
    }
}