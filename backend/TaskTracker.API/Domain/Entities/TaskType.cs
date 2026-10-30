namespace TaskTracker.API.Domain.Entities
{
    public class TaskType : Entity
    {
        public Guid ProjectId { get; set; }
        public Project Project { get; set; } = null!;
        public string Name { get; set; } = null!;
        public string Color { get; set; } = null!;
    }
}