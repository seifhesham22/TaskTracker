using TaskTracker.API.Domain.Exceptions;

namespace TaskTracker.API.Domain.Entities
{
    public class TaskDependency
    {
        public Guid BlockingTaskId { get; private set; }
        public TaskItem BlockingTask { get; private set; } = null!;
        public Guid BlockedTaskId { get; private set; }
        public TaskItem BlockedTask { get; private set; } = null!;
        public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

        private TaskDependency()
        {
        }

        public TaskDependency(Guid blockingTaskId, Guid blockedTaskId)
        {
            if (blockingTaskId == blockedTaskId)
                throw new DomainException("A task can't block itself.");

            BlockingTaskId = blockingTaskId;
            BlockedTaskId = blockedTaskId;
        }
    }
}
