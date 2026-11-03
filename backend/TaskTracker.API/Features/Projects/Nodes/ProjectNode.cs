using TaskTracker.API.Data.DataLoaders;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Features.Boards.Nodes;

namespace TaskTracker.API.Features.Projects.Nodes
{
    [GraphQLName("Project")]
    public sealed class ProjectNode(Project project, ProjectRole role)
    {
        public Guid Id => project.Id;
        public string Key => project.Key;
        public string Name => project.Name;
        public string? Description => project.Description;
        public ProjectRole Role => role;

        public async Task<BoardNode[]> GetBoardsAsync(BoardsByProjectIdDataLoader loader, CancellationToken ct)
            => await loader.LoadAsync(project.Id, ct) ?? [];

        public async Task<ProjectMemberNode[]> GetProjectMembersAsync(MembersByProjectIdDataLoader loader, CancellationToken ct)
            => await loader.LoadAsync(project.Id, ct) ?? [];
    }
}
