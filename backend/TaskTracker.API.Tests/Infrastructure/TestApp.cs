using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace TaskTracker.API.Tests.Infrastructure;

public static class TestApp
{
    public const string JwtKey = "test-only-jwt-signing-key-0123456789-abcdefghij";

    public static WebApplicationFactory<Program> Create(string? connectionString = null) =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("Jwt:Key", JwtKey);

            if (connectionString is not null)
                builder.UseSetting("ConnectionStrings:DefaultConnection", connectionString);
        });
}
