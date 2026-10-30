using static TaskTracker.API.Domain.Entities.SoftDeletableEntity;

namespace TaskTracker.API.Domain.Entities
{
    public class Project : SoftDeletableEntity
    {
        public string Name { get; set; } = null!;
        public string Key { get; set; } = null!;
        public string? Description { get; set; } = null!;
        public int LastTaskNumber { get; set; }

        public ICollection<ProjectMember> ProjectMembers { get; set; } = [];
        //public ICollection<Status> Statuses { get; set; } = [];
        //public ICollection<TaskType> TaskTypes { get; set; } = [];
        public ICollection<Board> Boards { get; set; } = [];
        public ICollection <TaskItem> Tasks { get; set; } = [];
    }
}