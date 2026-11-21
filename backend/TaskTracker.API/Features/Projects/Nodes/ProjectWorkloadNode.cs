using TaskTracker.API.Features.Tasks.GetTasks;

namespace TaskTracker.API.Features.Projects.Nodes
{
    [GraphQLName("ProjectWorkload")]
    public sealed record ProjectWorkloadNode(
        IReadOnlyList<MemberWorkloadNode> Members,
        IReadOnlyList<TaskNode> Unassigned,
        double AverageOpenTasks);
}
