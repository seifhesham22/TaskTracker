namespace TaskTracker.API.Domain.Entities
{
    public class TaskAssignee
    {
        public Guid TaskId { get; set; }
        public TaskItem Task { get; set; } = null!;
        public Guid UserId { get; set; }
        public User User { get; set; } = null!;

        private TaskAssignee()
        {
        }

        public TaskAssignee(Guid taskId, Guid userId)
        {
            TaskId = taskId;
            UserId = userId;
        }
    }
}