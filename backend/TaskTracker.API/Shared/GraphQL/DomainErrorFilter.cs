using HotChocolate.Execution;
using TaskTracker.API.Domain.Exceptions;
using TaskTracker.API.Shared.Exceptions;

namespace TaskTracker.API.Shared.GraphQL
{
    public class DomainErrorFilter : IErrorFilter
    {
        public IError OnError(IError error) => error.Exception switch
        {
            NotFoundException ex => error.WithMessage(ex.Message).WithCode("NOT_FOUND"),
            BadUserInputException ex => error.WithMessage(ex.Message).WithCode("BAD_USER_INPUT"),
            DomainException ex => error.WithMessage(ex.Message).WithCode("BAD_USER_INPUT"),
            _ => error
        };
    }
}