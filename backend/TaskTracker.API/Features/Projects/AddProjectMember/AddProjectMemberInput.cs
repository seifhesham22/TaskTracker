using TaskTracker.API.Domain.Enums;

namespace TaskTracker.API.Features.Projects.AddProjectMember
{
    public record AddProjectMemberInput(Guid ProjectId, string Email, ProjectRole Role = ProjectRole.Writer);
}