using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using TaskTracker.API.Domain.Entities;

namespace TaskTracker.API.Tests;

public class SmokeTests
{
    [Fact]
    public void App_starts_and_resolves_identity_services()
    {
        using var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder => builder.UseEnvironment("Testing"));

        using var scope = factory.Services.CreateScope();
        var userManager = scope.ServiceProvider.GetService<UserManager<User>>();

        Assert.NotNull(userManager);
    }
}
