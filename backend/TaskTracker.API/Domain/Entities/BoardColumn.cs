using TaskTracker.API.Domain.Enums;

namespace TaskTracker.API.Domain.Entities
{
    public class BoardColumn : Entity
    {
        public Guid BoardId { get; set; }
        public Board Board { get; set; } = null!;
        public string Name { get; set; } = string.Empty;
        public ColumnCategory Category { get; set; }
        public string Color { get; set; } = string.Empty;
        public string Position { get; set; } = string.Empty;
        public ICollection<TaskItem> Tasks { get; set; } = [];
    }
}