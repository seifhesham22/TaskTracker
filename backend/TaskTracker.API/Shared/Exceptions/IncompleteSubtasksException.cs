namespace TaskTracker.API.Shared.Exceptions
{
    public sealed record IncompleteSubtask(Guid Id, string ReadableId, string Title);

    public class IncompleteSubtasksException(string message, IReadOnlyList<IncompleteSubtask> subtasks)
        : BadUserInputException(message)
    {
        public IReadOnlyList<IncompleteSubtask> Subtasks { get; } = subtasks;
    }
}
