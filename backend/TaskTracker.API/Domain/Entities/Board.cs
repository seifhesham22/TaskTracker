using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Domain.Exceptions;

namespace TaskTracker.API.Domain.Entities
{
    public class Board : SoftDeletableEntity
    {
        public const int NameMaxLength = 100;

        public Guid ProjectId { get; set; }
        public Project Project { get; set; } = null!;
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? Color { get; set; }
        public string? Icon { get; set; }
        public string? Emoji { get; set; }
        public bool IsArchived { get; set; }
        public string Position { get; set; } = string.Empty;
        public ICollection<BoardColumn> Columns { get; set; } = [];

        public static string ValidName(string name)
        {
            var trimmed = name.Trim();

            if (trimmed.Length == 0)
                throw new DomainException("Board name cannot be empty or only spaces.");
            if (trimmed.Length > NameMaxLength)
                throw new DomainException($"Board name cannot be longer than {NameMaxLength} characters.");

            return trimmed;
        }

        public void AddDefaultColumns()
        {
            Columns.Add(new BoardColumn { Name = "Backlog", Category = ColumnCategory.Backlog, Color = "#8A90A0", Position = "V" });
            Columns.Add(new BoardColumn { Name = "To do", Category = ColumnCategory.ToDo, Color = "#5B8DE8", Position = "l" });
            Columns.Add(new BoardColumn { Name = "In progress", Category = ColumnCategory.InProgress, Color = "#E8945B", Position = "t" });
            Columns.Add(new BoardColumn { Name = "Done", Category = ColumnCategory.Done, Color = "#2A9D8F", Position = "x" });
        }
    }
}