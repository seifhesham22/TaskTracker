using System.Security.Claims;
using HotChocolate.Authorization;
using HotChocolate.Data.Filters;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Shared.Auth;
using TaskTracker.API.Shared.Filtering;

namespace TaskTracker.API.Features.Tasks.GetTasks
{
    [QueryType]
    public class GetTasksQuery
    {
        [Authorize]
        [UseFiltering(typeof(TaskFilterInputType))]
        public Task<IReadOnlyList<TaskNode>> GetTasksAsync(
            Guid? boardId,
            string? search,
            IFilterContext filter,
            ClaimsPrincipal claimsPrincipal,
            [Service] GetTasksHandler handler,
            CancellationToken cancellationToken)
        {
            var where = filter.AsPredicate<TaskItem>();
            filter.Handled(true);

            return handler.HandleAsync(boardId, claimsPrincipal.GetUserId(), search, where, cancellationToken);
        }
    }
}
