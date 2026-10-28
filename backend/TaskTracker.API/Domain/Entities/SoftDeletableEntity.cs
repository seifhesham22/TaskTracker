namespace TaskTracker.API.Domain.Entities
{
    public abstract class SoftDeletableEntity : Entity
    {
        public bool IsDeleted { get; private set; }
        public DateTime? DeletedAt { get; private set; }
        public DateTime? RestoredAt { get; private set; }
    }
}