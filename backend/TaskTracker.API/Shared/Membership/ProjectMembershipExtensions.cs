using TaskTracker.API.Shared.Exceptions;

namespace TaskTracker.API.Shared.Membership
{
    public static class ProjectMembershipExtensions
    {
        public static async Task EnsureCanBeAssignedAsync(
            this IProjectMembershipService membership, Guid projectId, string projectKey, Guid userId, CancellationToken ct)
        {
            if (await membership.GetRoleAsync(projectId, userId, ct) is null)
                throw new BadUserInputException(
                    $"User '{userId}' is not a member of project {projectKey}, so they can't be assigned to this task.");
        }
    }
}
