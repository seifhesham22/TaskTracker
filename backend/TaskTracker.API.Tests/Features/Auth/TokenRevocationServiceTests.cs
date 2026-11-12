using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using TaskTracker.API.Shared.Auth;
using TaskTracker.API.Tests.Infrastructure;

namespace TaskTracker.API.Tests.Features.Auth;

[Collection(nameof(PostgresCollection))]
public class TokenRevocationServiceTests(PostgresFixture database) : IDisposable
{
    private readonly WebApplicationFactory<Program> _factory = TestApp.Create(database.ConnectionString);

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task A_revoked_token_is_reported_as_revoked()
    {
        var userId = await GivenUserAsync();
        var tokenId = Guid.NewGuid().ToString();
        Assert.False(await IsRevokedAsync(tokenId));

        await RevokeAsync(tokenId, userId, DateTimeOffset.UtcNow.AddHours(1));

        Assert.True(await IsRevokedAsync(tokenId));
    }

    [Fact]
    public async Task Revoking_the_same_token_twice_is_harmless()
    {
        var userId = await GivenUserAsync();
        var tokenId = Guid.NewGuid().ToString();

        await RevokeAsync(tokenId, userId, DateTimeOffset.UtcNow.AddHours(1));
        await RevokeAsync(tokenId, userId, DateTimeOffset.UtcNow.AddHours(1));

        Assert.True(await IsRevokedAsync(tokenId));
    }

    [Fact]
    public async Task Revocations_of_tokens_that_have_expired_are_cleaned_up()
    {
        var userId = await GivenUserAsync();
        var expiredTokenId = Guid.NewGuid().ToString();
        await RevokeAsync(expiredTokenId, userId, DateTimeOffset.UtcNow.AddHours(-1));

        await RevokeAsync(Guid.NewGuid().ToString(), userId, DateTimeOffset.UtcNow.AddHours(1));

        Assert.False(await IsRevokedAsync(expiredTokenId));
    }

    private async Task<Guid> GivenUserAsync()
    {
        await using var db = database.CreateDbContext();
        return await TestData.CreateUserAsync(db);
    }

    private async Task RevokeAsync(string tokenId, Guid userId, DateTimeOffset expiresAt)
    {
        using var scope = _factory.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<ITokenRevocationService>().RevokeAsync(tokenId, userId, expiresAt, CancellationToken.None);
    }

    private async Task<bool> IsRevokedAsync(string tokenId)
    {
        using var scope = _factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<ITokenRevocationService>().IsRevokedAsync(tokenId, CancellationToken.None);
    }
}
