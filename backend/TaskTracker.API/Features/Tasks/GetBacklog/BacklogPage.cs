using TaskTracker.API.Features.Tasks.GetTasks;

namespace TaskTracker.API.Features.Tasks.GetBacklog
{
    public sealed record BacklogPage(IReadOnlyList<TaskNode> Items, int TotalCount, int Page, int PageSize)
    {
        public int TotalPages => (int)((TotalCount + (long)PageSize - 1) / PageSize);
        public bool HasNextPage => Page < TotalPages;
        public bool HasPreviousPage => Page > 1;
    }
}
