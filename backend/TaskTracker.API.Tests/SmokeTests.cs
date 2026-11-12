using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Tests.Infrastructure;

namespace TaskTracker.API.Tests;

public class SmokeTests
{
    [Fact]
    public void App_starts_and_resolves_identity_services()
    {
        using var factory = TestApp.Create();

        using var scope = factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetService<UserManager<User>>();

        Assert.NotNull(userManager);
    }
}
