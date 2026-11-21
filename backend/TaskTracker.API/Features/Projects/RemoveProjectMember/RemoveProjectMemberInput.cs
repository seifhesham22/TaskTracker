namespace TaskTracker.API.Features.Projects.RemoveProjectMember
{
    public record RemoveProjectMemberInput(Guid ProjectId, Guid UserId);
}