using TaskTracker.API.Domain.Enums;

namespace TaskTracker.API.Shared.Membership
{
    public interface IProjectMembershipService
    {
        Task<ProjectRole?> GetRoleAsync(Guid projectId, Guid userId, CancellationToken ct);
        Task<ProjectRole?> GetRoleOnBoardAsync(Guid boardId, Guid userId, CancellationToken ct);
        Task<IReadOnlyList<Guid>> GetProjectIdsAsync(Guid userId, CancellationToken ct);
    }
}
