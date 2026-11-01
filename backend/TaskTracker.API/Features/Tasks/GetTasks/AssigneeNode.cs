namespace TaskTracker.API.Features.Tasks.GetTasks
{
    [GraphQLName("Assignee")]
    public sealed record AssigneeNode(Guid Id, string? UserName);
}
