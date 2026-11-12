using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Shared.Auth;
using TaskTracker.API.Tests.Infrastructure;

namespace TaskTracker.API.Tests.Api;

[Collection(nameof(PostgresCollection))]
public class GraphQLApiTests(PostgresFixture database) : IDisposable
{
    private const string FrontendOrigin = "http://localhost:5173";

    private const string ValidPassword = "Valid@Pass123";

    private readonly WebApplicationFactory<Program> _factory = TestApp.Create(database.ConnectionString);

    private string? _token;

    private string Token => _token ??= _factory.Services.GetRequiredService<IAccessTokenService>()
        .Create(Guid.CreateVersion7(), "tester@test.local").Token;

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task CreateTask_returns_the_new_task()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);

        var json = await PostGraphQLAsync($$"""
            mutation { createTask(input: { boardId: "{{project.BoardId}}", title: "From the API" }) { readableId status } }
            """);

        var task = json.GetProperty("data").GetProperty("createTask");
        Assert.Equal($"{project.Key}-1", task.GetProperty("readableId").GetString());
        Assert.Equal("BACKLOG", task.GetProperty("status").GetString());
    }

    [Fact]
    public async Task A_missing_title_is_refused_by_the_schema()
    {
        var json = await PostGraphQLAsync($$"""
            mutation { createTask(input: { boardId: "{{Guid.NewGuid()}}" }) { id } }
            """);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("`title` is a required field and cannot be null.", error.GetProperty("message").GetString());
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task An_empty_title_comes_back_with_the_BAD_USER_INPUT_code(string title)
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);

        var json = await PostGraphQLAsync($$"""
            mutation { createTask(input: { boardId: "{{project.BoardId}}", title: "{{title}}" }) { id } }
            """);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("BAD_USER_INPUT", error.GetProperty("extensions").GetProperty("code").GetString());
        Assert.Equal("Title cannot be empty or only spaces.", error.GetProperty("message").GetString());

        await using var check = database.CreateDbContext();
        Assert.False(await check.Set<TaskItem>().AnyAsync(t => t.BoardId == project.BoardId));
    }

    [Fact]
    public async Task A_missing_board_id_is_refused_by_the_schema()
    {
        var json = await PostGraphQLAsync("""
            mutation { createTask(input: { title: "No board" }) { id } }
            """);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("`boardId` is a required field and cannot be null.", error.GetProperty("message").GetString());
    }

    [Fact]
    public async Task An_unknown_board_comes_back_with_the_NOT_FOUND_code()
    {
        var boardId = Guid.NewGuid();

        var json = await PostGraphQLAsync($$"""
            mutation { createTask(input: { boardId: "{{boardId}}", title: "Lost" }) { id } }
            """);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("NOT_FOUND", error.GetProperty("extensions").GetProperty("code").GetString());
        Assert.Equal($"Board '{boardId}' was not found.", error.GetProperty("message").GetString());
    }

    [Fact]
    public async Task CreateTask_saves_the_task_only_on_the_requested_board()
    {
        TestProject project;
        Guid otherBoardId;
        await using (var db = database.CreateDbContext())
        {
            project = await TestData.CreateProjectAsync(db);
            (otherBoardId, _) = await TestData.CreateBoardWithColumnAsync(db, project.ProjectId);
        }

        var created = await PostGraphQLAsync($$"""
            mutation { createTask(input: { boardId: "{{project.BoardId}}", title: "Board A task" }) { id title } }
            """);
        var task = created.GetProperty("data").GetProperty("createTask");
        var taskId = task.GetProperty("id").GetString();
        Assert.Equal("Board A task", task.GetProperty("title").GetString());

        var onRequestedBoard = await PostGraphQLAsync($$"""
            query { tasks(boardId: "{{project.BoardId}}") { id } }
            """);
        var listedTask = Assert.Single(onRequestedBoard.GetProperty("data").GetProperty("tasks").EnumerateArray());
        Assert.Equal(taskId, listedTask.GetProperty("id").GetString());

        var onOtherBoard = await PostGraphQLAsync($$"""
            query { tasks(boardId: "{{otherBoardId}}") { id } }
            """);
        Assert.Empty(onOtherBoard.GetProperty("data").GetProperty("tasks").EnumerateArray());

        await using var check = database.CreateDbContext();
        var saved = await check.Set<TaskItem>().SingleAsync(t => t.Id == Guid.Parse(taskId!));
        Assert.Equal(project.BoardId, saved.BoardId);
    }

    [Fact]
    public async Task Tasks_returns_each_task_with_its_column_and_assignees()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);

        await PostGraphQLAsync($$"""
            mutation { createTask(input: { boardId: "{{project.BoardId}}", title: "Assigned", assigneeId: "{{project.MemberId}}" }) { id } }
            """);
        await PostGraphQLAsync($$"""
            mutation { createTask(input: { boardId: "{{project.BoardId}}", title: "Nobody" }) { id } }
            """);

        var json = await PostGraphQLAsync($$"""
            query { tasks(boardId: "{{project.BoardId}}") { readableId title column { name category } assignees { id userName } } }
            """);

        var tasks = json.GetProperty("data").GetProperty("tasks").EnumerateArray().ToList();
        Assert.Equal(2, tasks.Count);

        var assigned = tasks[0];
        Assert.Equal($"{project.Key}-1", assigned.GetProperty("readableId").GetString());
        Assert.Equal("Backlog", assigned.GetProperty("column").GetProperty("name").GetString());
        Assert.Equal("BACKLOG", assigned.GetProperty("column").GetProperty("category").GetString());
        var assignee = Assert.Single(assigned.GetProperty("assignees").EnumerateArray());
        Assert.Equal(project.MemberId.ToString(), assignee.GetProperty("id").GetString());
        Assert.False(string.IsNullOrEmpty(assignee.GetProperty("userName").GetString()));

        Assert.Equal("Nobody", tasks[1].GetProperty("title").GetString());
        Assert.Empty(tasks[1].GetProperty("assignees").EnumerateArray());
    }

    [Fact]
    public async Task Tasks_of_an_unknown_board_come_back_with_the_NOT_FOUND_code()
    {
        var boardId = Guid.NewGuid();

        var json = await PostGraphQLAsync($$"""
            query { tasks(boardId: "{{boardId}}") { id } }
            """);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("NOT_FOUND", error.GetProperty("extensions").GetProperty("code").GetString());
        Assert.Equal($"Board '{boardId}' was not found.", error.GetProperty("message").GetString());
    }

    [Fact]
    public async Task Projects_returns_the_projects_of_the_user_with_their_role_and_members()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);

        var json = await PostGraphQLAsync($$"""
            query { projects(userId: "{{project.MemberId}}") { id key role projectMembers { userId userName role } } }
            """);

        var result = Assert.Single(json.GetProperty("data").GetProperty("projects").EnumerateArray());
        Assert.Equal(project.ProjectId.ToString(), result.GetProperty("id").GetString());
        Assert.Equal(project.Key, result.GetProperty("key").GetString());
        Assert.Equal("OWNER", result.GetProperty("role").GetString());

        var member = Assert.Single(result.GetProperty("projectMembers").EnumerateArray());
        Assert.Equal(project.MemberId.ToString(), member.GetProperty("userId").GetString());
        Assert.False(string.IsNullOrEmpty(member.GetProperty("userName").GetString()));
        Assert.Equal("OWNER", member.GetProperty("role").GetString());
    }

    [Fact]
    public async Task Projects_returns_the_boards_of_a_project_in_board_order_without_deleted_boards()
    {
        TestProject project;
        Guid otherBoardId;
        await using (var db = database.CreateDbContext())
        {
            project = await TestData.CreateProjectAsync(db);
            (otherBoardId, _) = await TestData.CreateBoardWithColumnAsync(db, project.ProjectId);
            var deletedBoardId = await TestData.CreateEmptyBoardAsync(db, project.ProjectId);
            await db.boards
                .Where(b => b.Id == deletedBoardId)
                .ExecuteUpdateAsync(s => s.SetProperty(b => b.IsDeleted, true));
        }

        var json = await PostGraphQLAsync($$"""
            query { projects(userId: "{{project.MemberId}}") { boards { id name } } }
            """);

        var boards = Assert.Single(json.GetProperty("data").GetProperty("projects").EnumerateArray())
            .GetProperty("boards").EnumerateArray().ToList();
        Assert.Equal(new[] { project.BoardId.ToString(), otherBoardId.ToString() }, boards.Select(b => b.GetProperty("id").GetString()));
        Assert.Equal(new[] { "Board", "Other board" }, boards.Select(b => b.GetProperty("name").GetString()));
    }

    [Fact]
    public async Task Projects_gives_each_project_only_its_own_boards()
    {
        TestProject first, second;
        await using (var db = database.CreateDbContext())
        {
            first = await TestData.CreateProjectAsync(db);
            second = await TestData.CreateProjectAsync(db);
            db.Add(new TaskTracker.API.Domain.Entities.ProjectMember
            {
                ProjectId = second.ProjectId,
                UserId = first.MemberId,
                ProjectRole = TaskTracker.API.Domain.Enums.ProjectRole.Reader,
                JoinedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        var json = await PostGraphQLAsync($$"""
            query { projects(userId: "{{first.MemberId}}") { id boards { id } } }
            """);

        var projects = json.GetProperty("data").GetProperty("projects").EnumerateArray().ToList();
        Assert.Equal(2, projects.Count);
        foreach (var (projectId, boardId) in new[] { (first.ProjectId, first.BoardId), (second.ProjectId, second.BoardId) })
        {
            var project = projects.Single(p => p.GetProperty("id").GetString() == projectId.ToString());
            Assert.Equal(boardId.ToString(), Assert.Single(project.GetProperty("boards").EnumerateArray()).GetProperty("id").GetString());
        }
    }

    [Fact]
    public async Task Projects_of_an_unknown_user_come_back_with_the_NOT_FOUND_code()
    {
        var userId = Guid.NewGuid();

        var json = await PostGraphQLAsync($$"""
            query { projects(userId: "{{userId}}") { id } }
            """);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("NOT_FOUND", error.GetProperty("extensions").GetProperty("code").GetString());
        Assert.Equal($"User '{userId}' was not found.", error.GetProperty("message").GetString());
    }

    [Fact]
    public async Task Board_returns_its_columns_in_board_order()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);

        var columns = await GetBoardColumnsAsync(project.BoardId);

        Assert.Equal(new[] { "Backlog", "In requirement state", "Done" }, columns.Select(c => c.GetProperty("name").GetString()));
        Assert.Equal(new[] { "BACKLOG", "IN_PROGRESS", "DONE" }, columns.Select(c => c.GetProperty("category").GetString()));
        Assert.Equal(project.BacklogColumnId.ToString(), columns[0].GetProperty("id").GetString());
    }

    [Fact]
    public async Task Board_columns_follow_a_change_of_position()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
        {
            project = await TestData.CreateProjectAsync(db);
            await db.boardColumns
                .Where(c => c.Id == project.BacklogColumnId)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.Position, "z"));
        }

        var columns = await GetBoardColumnsAsync(project.BoardId);

        Assert.Equal(new[] { "In requirement state", "Done", "Backlog" }, columns.Select(c => c.GetProperty("name").GetString()));
    }

    [Fact]
    public async Task A_board_without_columns_has_an_empty_list_of_columns()
    {
        Guid emptyBoardId;
        await using (var db = database.CreateDbContext())
        {
            var project = await TestData.CreateProjectAsync(db);
            emptyBoardId = await TestData.CreateEmptyBoardAsync(db, project.ProjectId);
        }

        Assert.Empty(await GetBoardColumnsAsync(emptyBoardId));
    }

    [Fact]
    public async Task Board_of_an_unknown_id_comes_back_with_the_NOT_FOUND_code()
    {
        var boardId = Guid.NewGuid();

        var json = await PostGraphQLAsync($$"""
            query { board(id: "{{boardId}}") { id } }
            """);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("NOT_FOUND", error.GetProperty("extensions").GetProperty("code").GetString());
        Assert.Equal($"Board '{boardId}' was not found.", error.GetProperty("message").GetString());
    }

    [Fact]
    public async Task A_subtask_created_through_the_API_shows_its_parent_in_the_tasks_query()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);

        var parentJson = await PostGraphQLAsync($$"""
            mutation { createTask(input: { boardId: "{{project.BoardId}}", title: "Parent" }) { id parentTaskId } }
            """);
        var parent = parentJson.GetProperty("data").GetProperty("createTask");
        var parentId = parent.GetProperty("id").GetString();
        Assert.Equal(JsonValueKind.Null, parent.GetProperty("parentTaskId").ValueKind);

        var childJson = await PostGraphQLAsync($$"""
            mutation { createTask(input: { boardId: "{{project.BoardId}}", title: "Child", parentTaskId: "{{parentId}}" }) { parentTaskId } }
            """);
        Assert.Equal(parentId, childJson.GetProperty("data").GetProperty("createTask").GetProperty("parentTaskId").GetString());

        var tasksJson = await PostGraphQLAsync($$"""
            query { tasks(boardId: "{{project.BoardId}}") { title parentTaskId } }
            """);
        var tasks = tasksJson.GetProperty("data").GetProperty("tasks").EnumerateArray().ToList();
        Assert.Equal(JsonValueKind.Null, tasks.Single(t => t.GetProperty("title").GetString() == "Parent").GetProperty("parentTaskId").ValueKind);
        Assert.Equal(parentId, tasks.Single(t => t.GetProperty("title").GetString() == "Child").GetProperty("parentTaskId").GetString());
    }

    [Fact]
    public async Task A_subtask_with_an_unknown_parent_comes_back_with_the_NOT_FOUND_code()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);
        var parentId = Guid.NewGuid();

        var json = await PostGraphQLAsync($$"""
            mutation { createTask(input: { boardId: "{{project.BoardId}}", title: "Child", parentTaskId: "{{parentId}}" }) { id } }
            """);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("NOT_FOUND", error.GetProperty("extensions").GetProperty("code").GetString());
        Assert.Equal($"Parent task '{parentId}' was not found.", error.GetProperty("message").GetString());
    }

    [Fact]
    public async Task MoveTask_returns_the_new_status_and_the_tasks_query_shows_it()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);

        var created = await PostGraphQLAsync($$"""
            mutation { createTask(input: { boardId: "{{project.BoardId}}", title: "Move me" }) { id } }
            """);
        var taskId = created.GetProperty("data").GetProperty("createTask").GetProperty("id").GetString();

        var json = await PostGraphQLAsync($$"""
            mutation { moveTask(input: { taskId: "{{taskId}}", columnId: "{{project.InProgressColumnId}}" }) { id status columnId column { name category } } }
            """);

        var moved = json.GetProperty("data").GetProperty("moveTask");
        Assert.Equal(taskId, moved.GetProperty("id").GetString());
        Assert.Equal("IN_PROGRESS", moved.GetProperty("status").GetString());
        Assert.Equal(project.InProgressColumnId.ToString(), moved.GetProperty("columnId").GetString());
        Assert.Equal("In requirement state", moved.GetProperty("column").GetProperty("name").GetString());

        var tasksJson = await PostGraphQLAsync($$"""
            query { tasks(boardId: "{{project.BoardId}}") { id status } }
            """);
        var task = Assert.Single(tasksJson.GetProperty("data").GetProperty("tasks").EnumerateArray());
        Assert.Equal("IN_PROGRESS", task.GetProperty("status").GetString());
    }

    [Fact]
    public async Task MoveTask_to_a_column_of_another_board_comes_back_with_the_NOT_FOUND_code()
    {
        TestProject project;
        Guid otherColumnId;
        await using (var db = database.CreateDbContext())
        {
            project = await TestData.CreateProjectAsync(db);
            (_, otherColumnId) = await TestData.CreateBoardWithColumnAsync(db, project.ProjectId);
        }

        var created = await PostGraphQLAsync($$"""
            mutation { createTask(input: { boardId: "{{project.BoardId}}", title: "Stay" }) { id } }
            """);
        var taskId = created.GetProperty("data").GetProperty("createTask").GetProperty("id").GetString();

        var json = await PostGraphQLAsync($$"""
            mutation { moveTask(input: { taskId: "{{taskId}}", columnId: "{{otherColumnId}}" }) { id } }
            """);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("NOT_FOUND", error.GetProperty("extensions").GetProperty("code").GetString());
        Assert.Equal($"Column '{otherColumnId}' was not found on board '{project.BoardId}'.", error.GetProperty("message").GetString());
    }

    [Fact]
    public async Task Register_returns_the_account_without_the_password()
    {
        var email = $"{Guid.NewGuid():N}@test.local";
        const string password = ValidPassword;

        var json = await PostAnonymousGraphQLAsync($$"""
            mutation { register(input: { email: "{{email}}", password: "{{password}}" }) { id email } }
            """);

        var user = json.GetProperty("data").GetProperty("register");
        Assert.True(Guid.TryParse(user.GetProperty("id").GetString(), out _));
        Assert.Equal(email, user.GetProperty("email").GetString());
        Assert.DoesNotContain(password, json.GetRawText());

        var withSecrets = await PostAnonymousGraphQLAsync($$"""
            mutation { register(input: { email: "{{Guid.NewGuid():N}}@test.local", password: "{{password}}" }) { id password passwordHash } }
            """);
        var messages = withSecrets.GetProperty("errors").EnumerateArray()
            .Select(e => e.GetProperty("message").GetString())
            .ToList();
        Assert.Equal(
            new[]
            {
                "The field `password` does not exist on the type `User`.",
                "The field `passwordHash` does not exist on the type `User`."
            },
            messages);
    }

    [Fact]
    public async Task Register_with_an_email_that_is_already_registered_comes_back_with_BAD_USER_INPUT()
    {
        var email = $"{Guid.NewGuid():N}@test.local";
        var mutation = $$"""
            mutation { register(input: { email: "{{email}}", password: "Valid@Pass123" }) { id } }
            """;
        await PostAnonymousGraphQLAsync(mutation);

        var json = await PostAnonymousGraphQLAsync(mutation);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("BAD_USER_INPUT", error.GetProperty("extensions").GetProperty("code").GetString());
        Assert.Equal($"An account with the email '{email}' already exists.", error.GetProperty("message").GetString());
    }

    [Fact]
    public async Task Register_without_a_password_is_refused_by_the_schema()
    {
        var json = await PostAnonymousGraphQLAsync($$"""
            mutation { register(input: { email: "{{Guid.NewGuid():N}}@test.local" }) { id } }
            """);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Contains("password", error.GetProperty("message").GetString());
    }

    [Fact]
    public async Task Login_returns_a_token_that_identifies_the_user_who_logged_in()
    {
        var email = $"{Guid.NewGuid():N}@test.local";
        var userId = await RegisterAsync(email);

        var login = await PostAnonymousGraphQLAsync($$"""
            mutation { login(input: { email: "{{email}}", password: "{{ValidPassword}}" }) { accessToken tokenType expiresAt user { id email } } }
            """);

        var payload = login.GetProperty("data").GetProperty("login");
        Assert.Equal("Bearer", payload.GetProperty("tokenType").GetString());
        Assert.Equal(userId, payload.GetProperty("user").GetProperty("id").GetString());
        Assert.True(payload.GetProperty("expiresAt").GetDateTimeOffset() > DateTimeOffset.UtcNow);

        var me = await SendGraphQLAsync("query { me { id email } }", payload.GetProperty("accessToken").GetString());

        Assert.Equal(userId, me.GetProperty("data").GetProperty("me").GetProperty("id").GetString());
        Assert.Equal(email, me.GetProperty("data").GetProperty("me").GetProperty("email").GetString());
    }

    [Fact]
    public async Task A_wrong_password_and_an_unknown_email_get_the_same_INVALID_CREDENTIALS_error()
    {
        var email = $"{Guid.NewGuid():N}@test.local";
        await RegisterAsync(email);

        var wrongPassword = await PostAnonymousGraphQLAsync($$"""
            mutation { login(input: { email: "{{email}}", password: "Wrong@Pass123" }) { accessToken } }
            """);
        var unknownEmail = await PostAnonymousGraphQLAsync($$"""
            mutation { login(input: { email: "{{Guid.NewGuid():N}}@test.local", password: "{{ValidPassword}}" }) { accessToken } }
            """);

        var first = Assert.Single(wrongPassword.GetProperty("errors").EnumerateArray());
        var second = Assert.Single(unknownEmail.GetProperty("errors").EnumerateArray());
        Assert.Equal("INVALID_CREDENTIALS", first.GetProperty("extensions").GetProperty("code").GetString());
        Assert.Equal("Invalid email or password.", first.GetProperty("message").GetString());
        Assert.Equal(first.GetProperty("message").GetString(), second.GetProperty("message").GetString());
        Assert.Equal(
            first.GetProperty("extensions").GetProperty("code").GetString(),
            second.GetProperty("extensions").GetProperty("code").GetString());
    }

    [Theory]
    [InlineData("query { tasks { id } }")]
    [InlineData("query { projects(userId: \"00000000-0000-0000-0000-000000000001\") { id } }")]
    [InlineData("query { board(id: \"00000000-0000-0000-0000-000000000001\") { id } }")]
    [InlineData("query { me { id } }")]
    [InlineData("mutation { createTask(input: { boardId: \"00000000-0000-0000-0000-000000000001\", title: \"No token\" }) { id } }")]
    [InlineData("mutation { moveTask(input: { taskId: \"00000000-0000-0000-0000-000000000001\", columnId: \"00000000-0000-0000-0000-000000000001\" }) { id } }")]
    [InlineData("mutation { updateTask(input: { taskId: \"00000000-0000-0000-0000-000000000001\", title: \"No token\" }) { id } }")]
    public async Task Protected_operations_are_refused_without_a_token(string query)
    {
        var json = await PostAnonymousGraphQLAsync(query);

        Assert.Equal("AUTH_NOT_AUTHENTICATED", ErrorCode(json));
    }

    [Fact]
    public async Task A_token_signed_with_another_key_is_refused()
    {
        var forged = CreateToken("someone-elses-signing-key-0123456789-abcdefghij", DateTime.UtcNow, DateTime.UtcNow.AddHours(1));

        var json = await SendGraphQLAsync("query { me { id } }", forged);

        Assert.Equal("AUTH_NOT_AUTHENTICATED", ErrorCode(json));
    }

    [Fact]
    public async Task An_expired_token_is_refused()
    {
        var expired = CreateToken(TestApp.JwtKey, DateTime.UtcNow.AddHours(-2), DateTime.UtcNow.AddHours(-1));

        var json = await SendGraphQLAsync("query { me { id } }", expired);

        Assert.Equal("AUTH_NOT_AUTHENTICATED", ErrorCode(json));
    }

    [Fact]
    public async Task CreateTask_with_a_start_date_returns_it_and_the_tasks_query_shows_it()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);

        var json = await PostGraphQLAsync($$"""
            mutation { createTask(input: { boardId: "{{project.BoardId}}", title: "With dates", startDate: "2026-11-02T00:00:00Z", dueDate: "2026-11-09T00:00:00Z" }) { startDate dueDate } }
            """);

        var created = json.GetProperty("data").GetProperty("createTask");
        Assert.Equal(new DateTimeOffset(2026, 11, 2, 0, 0, 0, TimeSpan.Zero), created.GetProperty("startDate").GetDateTimeOffset());

        var tasks = await PostGraphQLAsync($$"""
            query { tasks(boardId: "{{project.BoardId}}") { startDate dueDate } }
            """);
        var task = Assert.Single(tasks.GetProperty("data").GetProperty("tasks").EnumerateArray());
        Assert.Equal(new DateTimeOffset(2026, 11, 2, 0, 0, 0, TimeSpan.Zero), task.GetProperty("startDate").GetDateTimeOffset());
        Assert.Equal(new DateTimeOffset(2026, 11, 9, 0, 0, 0, TimeSpan.Zero), task.GetProperty("dueDate").GetDateTimeOffset());
    }

    [Fact]
    public async Task CreateTask_with_a_due_date_before_the_start_date_comes_back_with_BAD_USER_INPUT()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);

        var json = await PostGraphQLAsync($$"""
            mutation { createTask(input: { boardId: "{{project.BoardId}}", title: "Bad dates", startDate: "2026-11-09T00:00:00Z", dueDate: "2026-11-02T00:00:00Z" }) { id } }
            """);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("BAD_USER_INPUT", error.GetProperty("extensions").GetProperty("code").GetString());
        Assert.Equal("The due date cannot be before the start date.", error.GetProperty("message").GetString());
    }

    [Fact]
    public async Task UpdateTask_saves_the_changes_and_the_tasks_query_shows_them()
    {
        var (boardId, taskId) = await GivenTaskThroughTheApiAsync();

        var json = await PostGraphQLAsync($$"""
            mutation {
              updateTask(input: {
                taskId: "{{taskId}}"
                title: "Updated title"
                description: "Updated description"
                priority: HIGH
                startDate: "2026-11-02T00:00:00Z"
                dueDate: "2026-11-09T00:00:00Z"
              }) { id title description priority startDate dueDate }
            }
            """);

        var updated = json.GetProperty("data").GetProperty("updateTask");
        Assert.Equal("Updated title", updated.GetProperty("title").GetString());
        Assert.Equal("HIGH", updated.GetProperty("priority").GetString());

        var tasks = await PostGraphQLAsync($$"""
            query { tasks(boardId: "{{boardId}}") { id title description priority startDate dueDate } }
            """);
        var task = Assert.Single(tasks.GetProperty("data").GetProperty("tasks").EnumerateArray());
        Assert.Equal("Updated title", task.GetProperty("title").GetString());
        Assert.Equal("Updated description", task.GetProperty("description").GetString());
        Assert.Equal("HIGH", task.GetProperty("priority").GetString());
        Assert.Equal(new DateTimeOffset(2026, 11, 2, 0, 0, 0, TimeSpan.Zero), task.GetProperty("startDate").GetDateTimeOffset());
        Assert.Equal(new DateTimeOffset(2026, 11, 9, 0, 0, 0, TimeSpan.Zero), task.GetProperty("dueDate").GetDateTimeOffset());
    }

    [Fact]
    public async Task UpdateTask_clears_a_field_sent_as_null_and_keeps_the_fields_left_out()
    {
        var (_, taskId) = await GivenTaskThroughTheApiAsync();

        var json = await PostGraphQLAsync($$"""
            mutation { updateTask(input: { taskId: "{{taskId}}", description: null }) { title description priority } }
            """);

        var updated = json.GetProperty("data").GetProperty("updateTask");
        Assert.Equal(JsonValueKind.Null, updated.GetProperty("description").ValueKind);
        Assert.Equal("Original title", updated.GetProperty("title").GetString());
        Assert.Equal("LOW", updated.GetProperty("priority").GetString());
    }

    [Fact]
    public async Task UpdateTask_with_an_empty_title_comes_back_with_BAD_USER_INPUT_and_changes_nothing()
    {
        var (boardId, taskId) = await GivenTaskThroughTheApiAsync();

        var json = await PostGraphQLAsync($$"""
            mutation { updateTask(input: { taskId: "{{taskId}}", title: "", priority: CRITICAL }) { id } }
            """);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("BAD_USER_INPUT", error.GetProperty("extensions").GetProperty("code").GetString());
        Assert.Equal("Title cannot be empty or only spaces.", error.GetProperty("message").GetString());

        var tasks = await PostGraphQLAsync($$"""
            query { tasks(boardId: "{{boardId}}") { title priority } }
            """);
        var task = Assert.Single(tasks.GetProperty("data").GetProperty("tasks").EnumerateArray());
        Assert.Equal("Original title", task.GetProperty("title").GetString());
        Assert.Equal("LOW", task.GetProperty("priority").GetString());
    }

    [Fact]
    public async Task UpdateTask_without_a_task_id_is_refused_by_the_schema()
    {
        var json = await PostGraphQLAsync("""
            mutation { updateTask(input: { title: "No id" }) { id } }
            """);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Contains("taskId", error.GetProperty("message").GetString());
    }

    [Fact]
    public async Task Logout_ends_the_session_so_its_token_no_longer_works()
    {
        var email = $"{Guid.NewGuid():N}@test.local";
        await RegisterAsync(email);
        var token = await LoginAsync(email);
        var before = await SendGraphQLAsync("query { me { email } }", token);
        Assert.Equal(email, before.GetProperty("data").GetProperty("me").GetProperty("email").GetString());

        var logout = await SendGraphQLAsync("mutation { logout }", token);

        Assert.True(logout.GetProperty("data").GetProperty("logout").GetBoolean());
        var after = await SendGraphQLAsync("query { me { email } }", token);
        Assert.Equal("AUTH_NOT_AUTHENTICATED", ErrorCode(after));
    }

    [Fact]
    public async Task Logout_does_not_end_other_users_sessions()
    {
        var mine = $"{Guid.NewGuid():N}@test.local";
        var theirs = $"{Guid.NewGuid():N}@test.local";
        await RegisterAsync(mine);
        await RegisterAsync(theirs);
        var myToken = await LoginAsync(mine);
        var theirToken = await LoginAsync(theirs);

        await SendGraphQLAsync("mutation { logout }", myToken);

        var json = await SendGraphQLAsync("query { me { email } }", theirToken);
        Assert.Equal(theirs, json.GetProperty("data").GetProperty("me").GetProperty("email").GetString());
    }

    [Fact]
    public async Task Logout_ends_only_the_current_session_of_the_same_user()
    {
        var email = $"{Guid.NewGuid():N}@test.local";
        await RegisterAsync(email);
        var laptop = await LoginAsync(email);
        var phone = await LoginAsync(email);

        await SendGraphQLAsync("mutation { logout }", laptop);

        Assert.Equal("AUTH_NOT_AUTHENTICATED", ErrorCode(await SendGraphQLAsync("query { me { email } }", laptop)));
        var stillIn = await SendGraphQLAsync("query { me { email } }", phone);
        Assert.Equal(email, stillIn.GetProperty("data").GetProperty("me").GetProperty("email").GetString());
    }

    [Fact]
    public async Task Logging_out_again_with_an_ended_session_is_refused_safely()
    {
        var email = $"{Guid.NewGuid():N}@test.local";
        await RegisterAsync(email);
        var token = await LoginAsync(email);
        await SendGraphQLAsync("mutation { logout }", token);

        var json = await SendGraphQLAsync("mutation { logout }", token);

        Assert.Equal("AUTH_NOT_AUTHENTICATED", ErrorCode(json));
    }

    [Fact]
    public async Task Logout_without_a_token_is_refused()
    {
        var json = await PostAnonymousGraphQLAsync("mutation { logout }");

        Assert.Equal("AUTH_NOT_AUTHENTICATED", ErrorCode(json));
    }

    [Fact]
    public async Task Cors_allows_any_origin()
    {
        var policy = await _factory.Services.GetRequiredService<ICorsPolicyProvider>()
            .GetPolicyAsync(new DefaultHttpContext(), policyName: null);

        Assert.NotNull(policy);
        Assert.True(policy.AllowAnyOrigin);
    }

    [Fact]
    public async Task Cors_is_off_outside_development()
    {
        var response = await SendPreflightAsync(FrontendOrigin);

        Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
    }

    private async Task<List<JsonElement>> GetBoardColumnsAsync(Guid boardId)
    {
        var json = await PostGraphQLAsync($$"""
            query { board(id: "{{boardId}}") { id name columns { id name category position } } }
            """);

        var board = json.GetProperty("data").GetProperty("board");
        Assert.Equal(boardId.ToString(), board.GetProperty("id").GetString());
        return board.GetProperty("columns").EnumerateArray().ToList();
    }

    private Task<JsonElement> PostGraphQLAsync(string query) => SendGraphQLAsync(query, Token);

    private Task<JsonElement> PostAnonymousGraphQLAsync(string query) => SendGraphQLAsync(query, token: null);

    private async Task<JsonElement> SendGraphQLAsync(string query, string? token)
    {
        using var client = _factory.CreateClient();
        if (token is not null)
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.PostAsJsonAsync("/graphql", new { query });
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private async Task<string> RegisterAsync(string email)
    {
        var json = await PostAnonymousGraphQLAsync($$"""
            mutation { register(input: { email: "{{email}}", password: "{{ValidPassword}}" }) { id } }
            """);
        return json.GetProperty("data").GetProperty("register").GetProperty("id").GetString()!;
    }

    private async Task<(Guid BoardId, string TaskId)> GivenTaskThroughTheApiAsync()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);

        var json = await PostGraphQLAsync($$"""
            mutation { createTask(input: { boardId: "{{project.BoardId}}", title: "Original title", description: "Original description", priority: LOW }) { id } }
            """);
        return (project.BoardId, json.GetProperty("data").GetProperty("createTask").GetProperty("id").GetString()!);
    }

    private async Task<string> LoginAsync(string email)
    {
        var json = await PostAnonymousGraphQLAsync($$"""
            mutation { login(input: { email: "{{email}}", password: "{{ValidPassword}}" }) { accessToken } }
            """);
        return json.GetProperty("data").GetProperty("login").GetProperty("accessToken").GetString()!;
    }

    private string CreateToken(string signingKey, DateTime notBefore, DateTime expires)
    {
        var jwt = _factory.Services.GetRequiredService<IOptions<JwtOptions>>().Value;
        return new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = jwt.Issuer,
            Audience = jwt.Audience,
            IssuedAt = notBefore,
            NotBefore = notBefore,
            Expires = expires,
            Claims = new Dictionary<string, object> { [JwtRegisteredClaimNames.Sub] = Guid.CreateVersion7().ToString() },
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)), SecurityAlgorithms.HmacSha256)
        });
    }

    private static string ErrorCode(JsonElement json) =>
        Assert.Single(json.GetProperty("errors").EnumerateArray())
            .GetProperty("extensions").GetProperty("code").GetString()!;

    private async Task<HttpResponseMessage> SendPreflightAsync(string origin)
    {
        using var client = _factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Options, "/graphql");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "content-type");
        return await client.SendAsync(request);
    }
}
