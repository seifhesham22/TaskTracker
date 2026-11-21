using HotChocolate.Execution;
using TaskTracker.API.Domain.Exceptions;
using TaskTracker.API.Shared.Exceptions;

namespace TaskTracker.API.Shared.GraphQL
{
    public class DomainErrorFilter : IErrorFilter
    {
        public IError OnError(IError error) => error.Exception switch
        {
            NotFoundException ex => Expected(error, ex, "NOT_FOUND"),
            IncompleteSubtasksException ex => Expected(error, ex, "BAD_USER_INPUT")
                .SetExtension("incompleteSubtasks", ex.Subtasks
                    .Select(s => new Dictionary<string, object?>
                    {
                        ["id"] = s.Id.ToString(),
                        ["readableId"] = s.ReadableId,
                        ["title"] = s.Title
                    })
                    .ToList()),
            BlockedTaskException ex => Expected(error, ex, "BAD_USER_INPUT")
                .SetExtension("blockers", ex.Blockers
                    .Select(b => new Dictionary<string, object?>
                    {
                        ["id"] = b.Id.ToString(),
                        ["readableId"] = b.ReadableId,
                        ["title"] = b.Title
                    })
                    .ToList()),
            BadUserInputException ex => Expected(error, ex, "BAD_USER_INPUT"),
            InvalidCredentialsException ex => Expected(error, ex, "INVALID_CREDENTIALS"),
            ForbiddenException ex => Expected(error, ex, "AUTH_NOT_AUTHORIZED"),
            DomainException ex => Expected(error, ex, "BAD_USER_INPUT"),
            _ => error
        };

        private static IError Expected(IError error, Exception exception, string code) =>
            error.WithMessage(exception.Message).WithCode(code).WithException(null!).RemoveExtension("exception");
    }
}