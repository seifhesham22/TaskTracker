namespace TaskTracker.API.Shared.Exceptions
{
    public sealed record TaskBlocker(Guid Id, string ReadableId, string Title);

    public class BlockedTaskException(string message, IReadOnlyList<TaskBlocker> blockers)
        : BadUserInputException(message)
    {
        public IReadOnlyList<TaskBlocker> Blockers { get; } = blockers;
    }
}
