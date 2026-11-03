namespace TaskTracker.API.Features.Tasks.GetTasks
{
    [QueryType]
    public class GetTasksQuery
    {
        public Task<IReadOnlyList<TaskNode>> GetTasksAsync(
            Guid? boardId,
            [Service] GetTasksHandler handler,
            CancellationToken cancellationToken)
            => handler.HandleAsync(boardId, cancellationToken);
    }
}
