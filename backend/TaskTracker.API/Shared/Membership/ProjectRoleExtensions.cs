using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Shared.Exceptions;

namespace TaskTracker.API.Shared.Membership
{
    public static class ProjectRoleExtensions
    {
        public static bool CanEdit(this ProjectRole role) => role is ProjectRole.Writer or ProjectRole.Owner;

        public static ProjectRole EnsureCanRead(this ProjectRole? role, string notFoundMessage) =>
            role ?? throw new NotFoundException(notFoundMessage);

        public static ProjectRole EnsureCanWrite(this ProjectRole? role, string notFoundMessage, string forbiddenMessage)
        {
            var member = role.EnsureCanRead(notFoundMessage);
            member.EnsureCanEdit(forbiddenMessage);
            return member;
        }

        public static void EnsureCanEdit(this ProjectRole role, string forbiddenMessage)
        {
            if (!role.CanEdit())
                throw new ForbiddenException(forbiddenMessage);
        }
    }
}
