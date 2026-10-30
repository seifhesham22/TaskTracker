namespace TaskTracker.API.Shared.Exceptions
{
    public class BadUserInputException(string message) : Exception(message);
}