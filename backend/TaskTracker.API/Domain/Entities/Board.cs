namespace TaskTracker.API.Domain.Entities
{
    public class Board : SoftDeletableEntity
    {
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
    }
}