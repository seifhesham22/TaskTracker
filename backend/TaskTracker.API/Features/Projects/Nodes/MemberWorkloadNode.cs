using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Features.Tasks.GetTasks;

namespace TaskTracker.API.Features.Projects.Nodes
{
    [GraphQLName("MemberWorkload")]
    public sealed record MemberWorkloadNode(
        Guid UserId,
        string UserName,
        ProjectRole Role,
        int OpenTaskCount,
        IReadOnlyList<TaskNode> OpenTasks);
}
