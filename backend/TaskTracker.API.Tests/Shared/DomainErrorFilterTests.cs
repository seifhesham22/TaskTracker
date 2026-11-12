using HotChocolate;
using TaskTracker.API.Domain.Exceptions;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.GraphQL;

namespace TaskTracker.API.Tests.Shared;

public class DomainErrorFilterTests
{
    private readonly DomainErrorFilter _filter = new();

    [Fact]
    public void Not_found_gets_the_NOT_FOUND_code_and_its_own_message()
    {
        var error = _filter.OnError(ErrorFrom(new NotFoundException("Board 'x' was not found.")));

        Assert.Equal("NOT_FOUND", error.Code);
        Assert.Equal("Board 'x' was not found.", error.Message);
    }

    [Fact]
    public void Bad_user_input_gets_the_BAD_USER_INPUT_code_and_its_own_message()
    {
        var error = _filter.OnError(ErrorFrom(new BadUserInputException("User 'x' is not a member.")));

        Assert.Equal("BAD_USER_INPUT", error.Code);
        Assert.Equal("User 'x' is not a member.", error.Message);
    }

    [Fact]
    public void Domain_rules_get_the_BAD_USER_INPUT_code_and_their_own_message()
    {
        var error = _filter.OnError(ErrorFrom(new DomainException("Title cannot be empty or only spaces.")));

        Assert.Equal("BAD_USER_INPUT", error.Code);
        Assert.Equal("Title cannot be empty or only spaces.", error.Message);
    }

    [Fact]
    public void Invalid_credentials_get_the_INVALID_CREDENTIALS_code_and_the_generic_message()
    {
        var error = _filter.OnError(ErrorFrom(new InvalidCredentialsException("Invalid email or password.")));

        Assert.Equal("INVALID_CREDENTIALS", error.Code);
        Assert.Equal("Invalid email or password.", error.Message);
    }

    [Fact]
    public void Expected_errors_carry_no_exception_details()
    {
        var withDetails = ErrorFrom(new InvalidCredentialsException("Invalid email or password.")).SetExtension("exception", "stack trace");

        var error = _filter.OnError(withDetails);

        Assert.Null(error.Exception);
        Assert.False(error.Extensions?.ContainsKey("exception") ?? false);
    }

    [Fact]
    public void Other_errors_are_left_unchanged()
    {
        var original = ErrorFrom(new InvalidOperationException("Something broke"));

        var error = _filter.OnError(original);

        Assert.Same(original, error);
    }

    private static IError ErrorFrom(Exception exception) =>
        ErrorBuilder.New().SetMessage("Unexpected Execution Error").SetException(exception).Build();
}