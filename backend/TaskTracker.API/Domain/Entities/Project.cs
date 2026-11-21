using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Domain.Exceptions;
using static TaskTracker.API.Domain.Entities.SoftDeletableEntity;

namespace TaskTracker.API.Domain.Entities
{
    public class Project : SoftDeletableEntity
    {
        public const int NameMaxLength = 100;
        public const int KeyMinLength = 2;
        public const int KeyMaxLength = 10;
        public const int DescriptionMaxLength = 2000;
        public const string FallbackKey = "PROJ";
        private const int GeneratedKeyLength = 4;

        public string Name { get; private set; } = null!;
        public string Key { get; private set; } = null!;
        public string? Description { get; private set; }
        public int LastTaskNumber { get; set; }

        public ICollection<ProjectMember> ProjectMembers { get; set; } = [];
        //public ICollection<Status> Statuses { get; set; } = [];
        //public ICollection<TaskType> TaskTypes { get; set; } = [];
        public ICollection<Board> Boards { get; set; } = [];
        public ICollection <TaskItem> Tasks { get; set; } = [];

        private Project()
        {
        }

        public Project(string name, string? key = null, string? description = null)
        {
            Rename(name);
            SetDescription(description);
            ChangeKey(string.IsNullOrWhiteSpace(key) ? GenerateKey() : key);
        }

        public void Rename(string name)
        {
            var trimmed = name.Trim();

            if (trimmed.Length == 0)
                throw new DomainException("Project name cannot be empty or only spaces.");
            if (trimmed.Length > NameMaxLength)
                throw new DomainException($"Project name cannot be longer than {NameMaxLength} characters.");

            Name = trimmed;
        }

        public void SetDescription(string? description)
        {
            var trimmed = description?.Trim();

            if (trimmed?.Length > DescriptionMaxLength)
                throw new DomainException($"Project description cannot be longer than {DescriptionMaxLength} characters.");

            Description = string.IsNullOrEmpty(trimmed) ? null : trimmed;
        }

        public string GenerateKey()
        {
            var key = new string(Name.Where(char.IsAsciiLetterOrDigit).Take(GeneratedKeyLength).ToArray())
                .ToUpperInvariant();

            return key.Length >= KeyMinLength ? key : FallbackKey;
        }

        public void ChangeKey(string key)
        {
            var normalized = key.Trim().ToUpperInvariant();

            if (normalized.Length is < KeyMinLength or > KeyMaxLength || !normalized.All(char.IsAsciiLetterOrDigit))
                throw new DomainException(
                    $"Project key must be {KeyMinLength} to {KeyMaxLength} letters or digits (A-Z, 0-9).");

            Key = normalized;
        }

        public ProjectMember AddMember(Guid userId, ProjectRole role)
        {
            if (role == ProjectRole.Owner)
                throw new DomainException("A project has only one owner. New members can be readers or writers.");

            return Join(userId, role);
        }

        public void AddOwner(Guid userId) => Join(userId, ProjectRole.Owner);

        public void Touch() => Update();

        private ProjectMember Join(Guid userId, ProjectRole role)
        {
            var member = new ProjectMember
            {
                ProjectId = Id,
                UserId = userId,
                ProjectRole = role,
                JoinedAt = DateTime.UtcNow
            };

            ProjectMembers.Add(member);
            return member;
        }

        public Board AddDefaultBoard() => AddBoard("Board", "V");

        public Board AddBoard(string name, string position)
        {
            var board = new Board { ProjectId = Id, Name = Board.ValidName(name), Position = position };
            board.AddDefaultColumns();
            Boards.Add(board);
            return board;
        }
    }
}