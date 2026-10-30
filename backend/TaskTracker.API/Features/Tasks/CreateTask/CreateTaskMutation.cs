namespace TaskTracker.API.Features.Tasks.CreateTask
{
    [MutationType]
    public class CreateTaskMutation
    {
        public Task<TaskDto> CreateTaskAsync(
            CreateTaskInput input,
            [Service] CreateTaskHandler handler,
            CancellationToken cancellationToken)
            => handler.HandleAsync(input, cancellationToken);
    }
}