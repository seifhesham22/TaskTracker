using TaskTracker.API.Domain.Enums;

namespace TaskTracker.API.Domain.Entities
{
    public class ProjectMember : Entity
    {
        public Guid ProjectId { get; set; }
        public Project Project { get; set; } = null!;
        public Guid UserId { get; set; }
        public User User { get; set; } = null!;
        public ProjectRole ProjectRole { get; set; }
        public DateTime JoinedAt { get; set; }
    }
}