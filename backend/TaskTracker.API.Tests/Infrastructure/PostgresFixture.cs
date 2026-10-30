using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using TaskTracker.API.Data;

namespace TaskTracker.API.Tests.Infrastructure;

public class PostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder("postgres:17").Build();

    public string ConnectionString => _container.GetConnectionString();

    public async Task InitializeAsync()
    {
        await _container.StartAsync();

        await using var db = CreateDbContext();
        await db.Database.MigrateAsync();
    }

    public Task DisposeAsync() => _container.DisposeAsync().AsTask();

    public ApplicationDbContext CreateDbContext() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>().UseNpgsql(ConnectionString).Options);
}

[CollectionDefinition(nameof(PostgresCollection))]
public class PostgresCollection : ICollectionFixture<PostgresFixture>;