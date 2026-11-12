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
            BadUserInputException ex => Expected(error, ex, "BAD_USER_INPUT"),
            InvalidCredentialsException ex => Expected(error, ex, "INVALID_CREDENTIALS"),
            DomainException ex => Expected(error, ex, "BAD_USER_INPUT"),
            _ => error
        };

        private static IError Expected(IError error, Exception exception, string code) =>
            error.WithMessage(exception.Message).WithCode(code).WithException(null!).RemoveExtension("exception");
    }
}