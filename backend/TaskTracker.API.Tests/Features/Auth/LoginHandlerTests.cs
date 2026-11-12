using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.JsonWebTokens;
using TaskTracker.API.Features.Auth.Login;
using TaskTracker.API.Features.Auth.Register;
using TaskTracker.API.Features.Users.Nodes;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Tests.Infrastructure;

namespace TaskTracker.API.Tests.Features.Auth;

[Collection(nameof(PostgresCollection))]
public class LoginHandlerTests(PostgresFixture database) : IDisposable
{
    private const string ValidPassword = "Valid@Pass123";

    private readonly WebApplicationFactory<Program> _factory = TestApp.Create(database.ConnectionString);

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Returns_an_access_token_for_the_right_email_and_password()
    {
        var email = NewEmail();
        var user = await RegisterAsync(email);

        var login = await LoginAsync(email, ValidPassword);

        Assert.Equal("Bearer", login.TokenType);
        Assert.Equal(user.Id, login.User.Id);
        Assert.Equal(email, login.User.Email);
        Assert.InRange(login.ExpiresAt, DateTimeOffset.UtcNow.AddMinutes(59), DateTimeOffset.UtcNow.AddMinutes(61));
    }

    [Fact]
    public async Task Puts_the_user_id_and_email_in_the_token()
    {
        var email = NewEmail();
        var user = await RegisterAsync(email);

        var login = await LoginAsync(email, ValidPassword);

        var token = new JsonWebTokenHandler().ReadJsonWebToken(login.AccessToken);
        Assert.Equal(user.Id.ToString(), token.Subject);
        Assert.Equal(email, token.GetClaim(JwtRegisteredClaimNames.Email).Value);
        Assert.Equal("TaskTracker.API", token.Issuer);
        Assert.Equal("TaskTracker.Clients", Assert.Single(token.Audiences));
    }

    [Fact]
    public async Task Accepts_the_email_in_any_upper_or_lower_case()
    {
        var email = NewEmail();
        var user = await RegisterAsync(email);

        var login = await LoginAsync($"  {email.ToUpperInvariant()}  ", ValidPassword);

        Assert.Equal(user.Id, login.User.Id);
    }

    [Fact]
    public async Task Refuses_a_wrong_password_with_the_generic_message()
    {
        var email = NewEmail();
        await RegisterAsync(email);

        var error = await Assert.ThrowsAsync<InvalidCredentialsException>(() => LoginAsync(email, "Wrong@Pass123"));

        Assert.Equal("Invalid email or password.", error.Message);
    }

    [Fact]
    public async Task Refuses_an_unregistered_email_with_the_same_generic_message()
    {
        var error = await Assert.ThrowsAsync<InvalidCredentialsException>(() => LoginAsync(NewEmail(), ValidPassword));

        Assert.Equal("Invalid email or password.", error.Message);
    }

    [Theory]
    [InlineData("", ValidPassword)]
    [InlineData("   ", ValidPassword)]
    [InlineData("someone@test.local", "")]
    public async Task Refuses_an_empty_email_or_password(string email, string password)
    {
        var error = await Assert.ThrowsAsync<BadUserInputException>(() => LoginAsync(email, password));

        Assert.Equal("Email and password are required.", error.Message);
    }

    [Fact]
    public async Task Locks_the_account_after_five_wrong_passwords()
    {
        var email = NewEmail();
        await RegisterAsync(email);
        for (var attempt = 0; attempt < 5; attempt++)
            await Assert.ThrowsAsync<InvalidCredentialsException>(() => LoginAsync(email, "Wrong@Pass123"));

        var error = await Assert.ThrowsAsync<InvalidCredentialsException>(() => LoginAsync(email, ValidPassword));

        Assert.Equal("Invalid email or password.", error.Message);
    }

    private async Task<UserNode> RegisterAsync(string email)
    {
        using var scope = _factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<RegisterHandler>().HandleAsync(new RegisterInput(email, ValidPassword));
    }

    private async Task<LoginPayload> LoginAsync(string email, string password)
    {
        using var scope = _factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<LoginHandler>().HandleAsync(new LoginInput(email, password));
    }

    private static string NewEmail() => $"{Guid.NewGuid():N}@test.local";
}
