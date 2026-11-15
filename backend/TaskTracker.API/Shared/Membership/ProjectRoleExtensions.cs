using TaskTracker.API.Domain.Enums;

namespace TaskTracker.API.Shared.Membership
{
    public static class ProjectRoleExtensions
    {
        public static bool CanEdit(this ProjectRole role) => role is ProjectRole.Writer or ProjectRole.Owner;
    }
}
