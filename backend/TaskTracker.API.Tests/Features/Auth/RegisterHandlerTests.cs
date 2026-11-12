using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Features.Auth.Register;
using TaskTracker.API.Features.Users.Nodes;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Tests.Infrastructure;

namespace TaskTracker.API.Tests.Features.Auth;

[Collection(nameof(PostgresCollection))]
public class RegisterHandlerTests(PostgresFixture database) : IDisposable
{
    private const string ValidPassword = "Valid@Pass123";

    private readonly WebApplicationFactory<Program> _factory = TestApp.Create(database.ConnectionString);

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Creates_an_account_and_returns_its_id_and_email()
    {
        var email = NewEmail();

        var user = await RegisterAsync(email, ValidPassword);

        Assert.NotEqual(Guid.Empty, user.Id);
        Assert.Equal(email, user.Email);
        await using var db = database.CreateDbContext();
        var saved = await db.Users.SingleAsync(u => u.Id == user.Id);
        Assert.Equal(email, saved.Email);
        Assert.Equal(email, saved.UserName);
    }

    [Fact]
    public async Task Stores_a_hash_of_the_password_and_never_the_password_itself()
    {
        var user = await RegisterAsync(NewEmail(), ValidPassword);

        await using var db = database.CreateDbContext();
        var saved = await db.Users.SingleAsync(u => u.Id == user.Id);
        Assert.False(string.IsNullOrEmpty(saved.PasswordHash));
        Assert.DoesNotContain(ValidPassword, saved.PasswordHash);
        Assert.Equal(
            PasswordVerificationResult.Success,
            new PasswordHasher<User>().VerifyHashedPassword(saved, saved.PasswordHash!, ValidPassword));
    }

    [Fact]
    public async Task Trims_the_email()
    {
        var email = NewEmail();

        var user = await RegisterAsync($"  {email}  ", ValidPassword);

        Assert.Equal(email, user.Email);
    }

    [Fact]
    public async Task Refuses_an_email_that_is_already_registered()
    {
        var email = NewEmail();
        await RegisterAsync(email, ValidPassword);

        var error = await Assert.ThrowsAsync<BadUserInputException>(() => RegisterAsync(email, ValidPassword));

        Assert.Equal($"An account with the email '{email}' already exists.", error.Message);
    }

    [Fact]
    public async Task Refuses_an_email_that_differs_only_in_upper_or_lower_case()
    {
        var email = NewEmail();
        await RegisterAsync(email, ValidPassword);

        var error = await Assert.ThrowsAsync<BadUserInputException>(() => RegisterAsync(email.ToUpperInvariant(), ValidPassword));

        Assert.Equal($"An account with the email '{email.ToUpperInvariant()}' already exists.", error.Message);
    }

    [Theory]
    [InlineData("", "Email is required.")]
    [InlineData("   ", "Email is required.")]
    [InlineData("not-an-email", "'not-an-email' is not a valid email address.")]
    public async Task Refuses_a_missing_or_invalid_email(string email, string message)
    {
        var error = await Assert.ThrowsAsync<BadUserInputException>(() => RegisterAsync(email, ValidPassword));

        Assert.Equal(message, error.Message);
    }

    [Theory]
    [InlineData("Short@1a", "at least 10 characters")]
    [InlineData("nouppercase@123", "uppercase")]
    [InlineData("NoDigitsHere@x", "digit")]
    [InlineData("NoSymbolHere123", "non alphanumeric")]
    public async Task Refuses_a_password_that_breaks_the_password_rules(string password, string reason)
    {
        var email = NewEmail();

        var error = await Assert.ThrowsAsync<BadUserInputException>(() => RegisterAsync(email, password));

        Assert.Contains(reason, error.Message);
        await using var db = database.CreateDbContext();
        Assert.False(await db.Users.AnyAsync(u => u.Email == email));
    }

    private async Task<UserNode> RegisterAsync(string email, string password)
    {
        using var scope = _factory.Services.CreateScope();
        var handler = scope.ServiceProvider.GetRequiredService<RegisterHandler>();
        return await handler.HandleAsync(new RegisterInput(email, password));
    }

    private static string NewEmail() => $"{Guid.NewGuid():N}@test.local";
}
