namespace TaskTracker.API.Shared.Exceptions
{
    public class NotFoundException(string message) : Exception(message);
}