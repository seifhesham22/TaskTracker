using HotChocolate.Authorization;

namespace TaskTracker.API.Features.Tasks.GetTasks
{
    [QueryType]
    public class GetTasksQuery
    {
        [Authorize]
        public Task<IReadOnlyList<TaskNode>> GetTasksAsync(
            Guid? boardId,
            [Service] GetTasksHandler handler,
            CancellationToken cancellationToken)
            => handler.HandleAsync(boardId, cancellationToken);
    }
}
