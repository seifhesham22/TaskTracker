using TaskTracker.API.Data;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Domain.Enums;

namespace TaskTracker.API.Tests.Infrastructure;

public record TestProject(
    Guid ProjectId,
    string Key,
    Guid BoardId,
    Guid BacklogColumnId,
    Guid InProgressColumnId,
    Guid DoneColumnId,
    Guid MemberId);

public static class TestData
{
    public static async Task<TestProject> CreateProjectAsync(ApplicationDbContext db)
    {
        var member = NewUser();
        var project = new Project { Name = "Test project", Key = NewProjectKey() };
        project.ProjectMembers.Add(new ProjectMember
        {
            UserId = member.Id,
            ProjectRole = ProjectRole.Owner,
            JoinedAt = DateTime.UtcNow
        });

        var backlog = NewColumn("Backlog", ColumnCategory.Backlog, "V");
        var inProgress = NewColumn("In requirement state", ColumnCategory.InProgress, "l");
        var done = NewColumn("Done", ColumnCategory.Done, "t");

        var board = new Board { Name = "Board", Position = "V" };
        board.Columns.Add(backlog);
        board.Columns.Add(inProgress);
        board.Columns.Add(done);
        project.Boards.Add(board);

        db.Users.Add(member);
        db.Add(project);
        await db.SaveChangesAsync();

        return new TestProject(project.Id, project.Key, board.Id, backlog.Id, inProgress.Id, done.Id, member.Id);
    }

    public static async Task<Guid> CreateUserAsync(ApplicationDbContext db)
    {
        var user = NewUser();
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user.Id;
    }

    public static async Task<(Guid BoardId, Guid ColumnId)> CreateBoardWithColumnAsync(ApplicationDbContext db, Guid projectId)
    {
        var column = NewColumn("Other column", ColumnCategory.ToDo, "V");
        var board = new Board { ProjectId = projectId, Name = "Other board", Position = "l" };
        board.Columns.Add(column);

        db.Add(board);
        await db.SaveChangesAsync();
        return (board.Id, column.Id);
    }

    public static async Task<Guid> CreateEmptyBoardAsync(ApplicationDbContext db, Guid projectId)
    {
        var board = new Board { ProjectId = projectId, Name = "Empty board", Position = "t" };
        db.Add(board);
        await db.SaveChangesAsync();
        return board.Id;
    }

    private static string NewProjectKey() => "T" + Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();

    private static User NewUser()
    {
        var email = $"{Guid.NewGuid():N}@test.local";
        return new User { Id = Guid.NewGuid(), UserName = email, Email = email };
    }

    private static BoardColumn NewColumn(string name, ColumnCategory category, string position) =>
        new() { Name = name, Category = category, Color = "#8A90A0", Position = position };
}