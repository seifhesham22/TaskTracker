using TaskTracker.API.Domain.Enums;

namespace TaskTracker.API.Features.Projects.Nodes
{
    [GraphQLName("ProjectMember")]
    public sealed record ProjectMemberNode(Guid projectId, Guid userId, string userName, ProjectRole role, DateTime joinedAt);
}
