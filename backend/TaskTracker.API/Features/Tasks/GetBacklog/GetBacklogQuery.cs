using System.Security.Claims;
using HotChocolate.Authorization;
using HotChocolate.Data.Filters;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Shared.Auth;

namespace TaskTracker.API.Features.Tasks.GetBacklog
{
    [QueryType]
    public class GetBacklogQuery
    {
        [Authorize]
        [UseFiltering(typeof(BacklogFilterInputType))]
        public Task<BacklogPage> GetBacklogAsync(
            Guid projectId,
            string? search,
            IFilterContext filter,
            ClaimsPrincipal claimsPrincipal,
            [Service] GetBacklogHandler handler,
            CancellationToken cancellationToken,
            int page = 1,
            int pageSize = GetBacklogHandler.DefaultPageSize)
        {
            var where = filter.AsPredicate<TaskItem>();
            filter.Handled(true);

            return handler.HandleAsync(
                projectId, claimsPrincipal.GetUserId(), search, where, page, pageSize, cancellationToken);
        }
    }
}
