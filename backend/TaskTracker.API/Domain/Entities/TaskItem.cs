using TaskTracker.API.Domain.Enums;

namespace TaskTracker.API.Domain.Entities
{
    public class TaskItem : SoftDeletableEntity
    {
        public string Number { get; set; } = null!;
        public Guid ProjectId { get; set; }
        public Project Project { get; set; } = null!;
        public Guid BoardId { get; set; }
        public Board Board { get; set; } = null!;
        public Guid ColumnId { get; set; }
        public BoardColumn Column { get; set; } = null!;
        //public Guid TaskTypeId { get; set; }
        //public TaskType TaskType { get; set; } = null!;
        public Guid? ParentTaskId { get; set; }
        public TaskItem? ParentTask { get; set; }

        public string Title { get; set; } = string.Empty;
        public string? DescriptionJson { get; set; }
        public TaskPriority? Priority { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? DueDate { get; set; }
        public decimal? EstimateHours { get; set; }
        public int? StoryPoints { get; set; }
        public string Position { get; set; } = string.Empty;
        public Guid CreatedById { get; set; }
        public User CreatedBy { get; set; } = null!;
        public Guid? DeletedById { get; set; }
        public User? DeletedBy { get; set; }

        public ICollection<TaskItem> Subtasks { get; set; } = [];
    }
}