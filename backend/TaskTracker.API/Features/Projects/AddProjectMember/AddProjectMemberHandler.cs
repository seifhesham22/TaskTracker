using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Features.Projects.Nodes;
using TaskTracker.API.Shared.Concurrency;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.Membership;

namespace TaskTracker.API.Features.Projects.AddProjectMember
{
    public class AddProjectMemberHandler(
        ApplicationDbContext db,
        UserManager<User> users,
        IProjectMembershipService membership)
    {
        public Task<ProjectMemberNode> HandleAsync(AddProjectMemberInput input, Guid userId, CancellationToken ct)
        {
            var email = input.Email.Trim();

            if (email.Length == 0)
                throw new BadUserInputException("Email is required.");

            return db.RetryOnConflictAsync(() => AddAsync(input, email, userId, ct));
        }

        private async Task<ProjectMemberNode> AddAsync(AddProjectMemberInput input, string email, Guid userId, CancellationToken ct)
        {
            var project = await db.projects.FirstOrDefaultAsync(p => p.Id == input.ProjectId, ct);

            if (project is null || await membership.GetRoleAsync(input.ProjectId, userId, ct) is not ProjectRole role)
                throw new NotFoundException($"Project '{input.ProjectId}' was not found.");

            role.EnsureCanEdit("Only writers and owners of the project can add members.");

            var account = await users.FindByEmailAsync(email)
                ?? throw new NotFoundException($"No account with the email '{email}' was found.");

            if (await db.projectMembers.AnyAsync(m => m.ProjectId == input.ProjectId && m.UserId == account.Id, ct))
                throw new BadUserInputException($"{account.Email} is already a member of this project.");

            var member = project.AddMember(account.Id, input.Role);
            project.Touch();
            await db.SaveChangesAsync(ct);

            return new ProjectMemberNode(member.ProjectId, member.UserId, account.UserName!, member.ProjectRole, member.JoinedAt);
        }
    }
}