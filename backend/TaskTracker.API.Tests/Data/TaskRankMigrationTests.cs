using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Testcontainers.PostgreSql;
using TaskTracker.API.Data;

namespace TaskTracker.API.Tests.Data;

public class TaskRankMigrationTests : IAsyncLifetime
{
    private const string MigrationBeforeRanks = "20261121103813_AddProjectVersion";

    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder("postgres:17").Build();

    public Task InitializeAsync() => _container.StartAsync();

    public Task DisposeAsync() => _container.DisposeAsync().AsTask();

    [Fact]
    public async Task Existing_tasks_get_ranks_that_keep_the_backlog_order_they_had_before()
    {
        await using var db = new ApplicationDbContext(
            new DbContextOptionsBuilder<ApplicationDbContext>().UseNpgsql(_container.GetConnectionString()).Options);
        var migrator = db.GetService<IMigrator>();
        await migrator.MigrateAsync(MigrationBeforeRanks);

        await db.Database.ExecuteSqlRawAsync("""
            INSERT INTO projects ("Id", "Name", "Key", "LastTaskNumber", "IsDeleted", "CreatedAt") VALUES
                ('00000000-0000-0000-0000-0000000000a1', 'First', 'ONE', 0, false, now()),
                ('00000000-0000-0000-0000-0000000000a2', 'Second', 'TWO', 0, false, now());
            INSERT INTO boards ("Id", "ProjectId", "Name", "Position", "IsArchived", "IsDeleted", "CreatedAt") VALUES
                ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'First board', 'V', false, false, now()),
                ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 'Second board', 'l', false, false, now()),
                ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000a2', 'Other', 'V', false, false, now());
            INSERT INTO board_columns ("Id", "BoardId", "Name", "Category", "Color", "Position", "CreatedAt") VALUES
                ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'Backlog', 'Backlog', '#000000', 'V', now()),
                ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b1', 'Done', 'Done', '#000000', 't', now()),
                ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000b2', 'To do', 'ToDo', '#000000', 'V', now()),
                ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000b3', 'Backlog', 'Backlog', '#000000', 'V', now());
            INSERT INTO tasks ("Id", "ProjectId", "BoardId", "ColumnId", "Title", "Position", "IsDeleted", "CreatedAt") VALUES
                ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c2', 'Done on first board', 'V', false, now()),
                ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c3', 'On second board', 'V', false, now()),
                ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'Second in backlog', 'W', false, now()),
                ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'First in backlog', 'V', false, now()),
                ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000c4', 'Other project', 'V', false, now());
            """);

        await migrator.MigrateAsync();

        var first = await db.Database
            .SqlQueryRaw<string>("""SELECT "Title" AS "Value" FROM tasks WHERE "ProjectId" = '00000000-0000-0000-0000-0000000000a1' ORDER BY "Rank", "Id" """)
            .ToListAsync();
        var ranks = await db.Database
            .SqlQueryRaw<string>("""SELECT "Rank" AS "Value" FROM tasks ORDER BY "Rank", "Id" """)
            .ToListAsync();

        Assert.Equal(new[] { "First in backlog", "Second in backlog", "Done on first board", "On second board" }, first);
        Assert.Equal(new[] { "0000000001", "0000000001", "0000000002", "0000000003", "0000000004" }, ranks);
    }
}
