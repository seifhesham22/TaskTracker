using System.Text.Json;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Domain.Exceptions;

namespace TaskTracker.API.Domain.Entities
{
    public class TaskItem : SoftDeletableEntity
    {
        public const int TitleMaxLength = 200;

        public int Number { get; private set; }
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
        public string Title { get; private set; } = string.Empty;
        public string? DescriptionJson { get; private set; }
        public TaskPriority? Priority { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? DueDate { get; private set; }
        public decimal? EstimateHours { get; set; }
        public int? StoryPoints { get; set; }
        public string Position { get; set; } = string.Empty;
        public Guid? CreatedById { get; set; }
        public User? CreatedBy { get; set; }
        public Guid? DeletedById { get; set; }
        public User? DeletedBy { get; set; }

        public ICollection<TaskAssignee> Assignees { get; set; } = [];
        public ICollection<TaskItem> Subtasks { get; set; } = [];

        private TaskItem()
        {
        }

       
        public TaskItem(
            Guid projectId,
            Guid boardId,
            Guid columnId,
            string title,
            string position,
            TaskPriority? taskPriority = TaskPriority.Medium)
        {
            ProjectId = projectId;
            BoardId = boardId;
            ColumnId = columnId;
            Position = position;
            Priority = taskPriority;
            Rename(title);
        }

        public void Rename(string title)
        {
            var trimmed = title.Trim();

            if (trimmed.Length == 0)
                throw new DomainException("Title cannot be empty or only spaces.");
            if (trimmed.Length > TitleMaxLength)
                throw new DomainException($"Title cannot be longer than {TitleMaxLength} characters.");

            Title = trimmed;
        }

        public void SetDescription(string? text) =>
            DescriptionJson = string.IsNullOrWhiteSpace(text) ? null : JsonSerializer.Serialize(text.Trim());

        public string? GetDescription() =>
            DescriptionJson is null ? null : JsonSerializer.Deserialize<string>(DescriptionJson);

        public void SetDueDate(DateTimeOffset? dueDate) => DueDate = dueDate?.UtcDateTime;

        public void AssignTo(Guid userId)
        {
            if (Assignees.All(a => a.UserId != userId))
                Assignees.Add(new TaskAssignee(Id, userId));
        }

        public static string ReadableId(string projectKey, int number) => $"{projectKey}-{number}";
    }
}