using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Features.Projects.Nodes;
using TaskTracker.API.Shared.Concurrency;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.Membership;

namespace TaskTracker.API.Features.Projects.RemoveProjectMember
{
    public class RemoveProjectMemberHandler(ApplicationDbContext db, IProjectMembershipService membership)
    {
        public Task<ProjectMemberNode> HandleAsync(RemoveProjectMemberInput input, Guid userId, CancellationToken ct) =>
            db.RetryOnConflictAsync(() => RemoveAsync(input, userId, ct));

        private async Task<ProjectMemberNode> RemoveAsync(RemoveProjectMemberInput input, Guid userId, CancellationToken ct)
        {
            var project = await db.projects.FirstOrDefaultAsync(p => p.Id == input.ProjectId, ct);

            if (project is null || await membership.GetRoleAsync(input.ProjectId, userId, ct) is not ProjectRole role)
                throw new NotFoundException($"Project '{input.ProjectId}' was not found.");

            if (!role.CanEdit())
                throw new ForbiddenException("Only writers and owners of the project can remove members.");

            var member = await db.projectMembers
                .Include(m => m.User)
                .FirstOrDefaultAsync(m => m.ProjectId == input.ProjectId && m.UserId == input.UserId, ct)
                ?? throw new NotFoundException($"User '{input.UserId}' is not a member of this project.");

            if (member.ProjectRole == ProjectRole.Owner)
                throw new BadUserInputException($"{member.User.UserName} is the owner of this project and can't be removed.");

            db.projectMembers.Remove(member);
            project.Touch();
            await db.SaveChangesAsync(ct);

            return new ProjectMemberNode(member.ProjectId, member.UserId, member.User.UserName!, member.ProjectRole, member.JoinedAt);
        }
    }
}