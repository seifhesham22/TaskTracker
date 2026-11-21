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
using TaskTracker.API.Domain.Enums;
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

        var json = await PostGraphQLAsMemberAsync(project, $$"""
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

        var json = await PostGraphQLAsMemberAsync(project, $$"""
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

        var created = await PostGraphQLAsMemberAsync(project, $$"""
            mutation { createTask(input: { boardId: "{{project.BoardId}}", title: "Board A task" }) { id title } }
            """);
        var task = created.GetProperty("data").GetProperty("createTask");
        var taskId = task.GetProperty("id").GetString();
        Assert.Equal("Board A task", task.GetProperty("title").GetString());

        var onRequestedBoard = await PostGraphQLAsMemberAsync(project, $$"""
            query { tasks(boardId: "{{project.BoardId}}") { id } }
            """);
        var listedTask = Assert.Single(onRequestedBoard.GetProperty("data").GetProperty("tasks").EnumerateArray());
        Assert.Equal(taskId, listedTask.GetProperty("id").GetString());

        var onOtherBoard = await PostGraphQLAsMemberAsync(project, $$"""
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

        await PostGraphQLAsMemberAsync(project, $$"""
            mutation { createTask(input: { boardId: "{{project.BoardId}}", title: "Assigned", assigneeId: "{{project.MemberId}}" }) { id } }
            """);
        await PostGraphQLAsMemberAsync(project, $$"""
            mutation { createTask(input: { boardId: "{{project.BoardId}}", title: "Nobody" }) { id } }
            """);

        var json = await PostGraphQLAsMemberAsync(project, $$"""
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

        var json = await PostGraphQLAsMemberAsync(project, $$"""
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

        var json = await PostGraphQLAsMemberAsync(project, $$"""
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

        var json = await PostGraphQLAsMemberAsync(first, $$"""
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
    public async Task Projects_of_another_user_come_back_with_AUTH_NOT_AUTHORIZED()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);

        var json = await PostGraphQLAsync($$"""
            query { projects(userId: "{{project.MemberId}}") { id projectMembers { userName } } }
            """);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("AUTH_NOT_AUTHORIZED", error.GetProperty("extensions").GetProperty("code").GetString());
        Assert.Equal("You can only list your own projects.", error.GetProperty("message").GetString());
        Assert.Equal(JsonValueKind.Null, json.GetProperty("data").ValueKind);
    }

    [Fact]
    public async Task Projects_without_a_user_id_lists_the_projects_of_the_logged_in_user()
    {
        TestProject mine;
        await using (var db = database.CreateDbContext())
        {
            mine = await TestData.CreateProjectAsync(db);
            await TestData.CreateProjectAsync(db);
        }

        var json = await PostGraphQLAsMemberAsync(mine, "query { projects { id role } }");

        var listed = Assert.Single(json.GetProperty("data").GetProperty("projects").EnumerateArray());
        Assert.Equal(mine.ProjectId.ToString(), listed.GetProperty("id").GetString());
        Assert.Equal("OWNER", listed.GetProperty("role").GetString());
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

        var parentJson = await PostGraphQLAsMemberAsync(project, $$"""
            mutation { createTask(input: { boardId: "{{project.BoardId}}", title: "Parent" }) { id parentTaskId } }
            """);
        var parent = parentJson.GetProperty("data").GetProperty("createTask");
        var parentId = parent.GetProperty("id").GetString();
        Assert.Equal(JsonValueKind.Null, parent.GetProperty("parentTaskId").ValueKind);

        var childJson = await PostGraphQLAsMemberAsync(project, $$"""
            mutation { createTask(input: { boardId: "{{project.BoardId}}", title: "Child", parentTaskId: "{{parentId}}" }) { parentTaskId } }
            """);
        Assert.Equal(parentId, childJson.GetProperty("data").GetProperty("createTask").GetProperty("parentTaskId").GetString());

        var tasksJson = await PostGraphQLAsMemberAsync(project, $$"""
            query { tasks(boardId: "{{project.BoardId}}") { title parentTaskId } }
            """);
        var tasks = tasksJson.GetProperty("data").GetProperty("tasks").EnumerateArray().ToList();
        Assert.Equal(JsonValueKind.Null, tasks.Single(t => t.GetProperty("title").GetString() == "Parent").GetProperty("parentTaskId").ValueKind);
        Assert.Equal(parentId, tasks.Single(t => t.GetProperty("title").GetString() == "Child").GetProperty("parentTaskId").GetString());
    }

    [Fact]
    public async Task A_subtask_with_a_parent_in_another_project_comes_back_with_BAD_USER_INPUT()
    {
        TestProject project, otherProject;
        await using (var db = database.CreateDbContext())
        {
            project = await TestData.CreateProjectAsync(db);
            otherProject = await TestData.CreateProjectAsync(db);
            await TestData.AddMemberAsync(db, otherProject.ProjectId, ProjectRole.Writer, project.MemberId);
        }
        var (parentId, _) = await CreateTaskThroughTheApiAsync(otherProject.BoardId, "Parent elsewhere");

        var json = await PostGraphQLAsMemberAsync(project, $$"""
            mutation { createTask(input: { boardId: "{{project.BoardId}}", title: "Child", parentTaskId: "{{parentId}}" }) { id } }
            """);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("BAD_USER_INPUT", error.GetProperty("extensions").GetProperty("code").GetString());
        Assert.Equal(
            $"Parent task '{parentId}' is in another project. A subtask must be in the same project as its parent.",
            error.GetProperty("message").GetString());
    }

    [Fact]
    public async Task A_subtask_with_a_parent_in_a_project_the_user_is_not_in_comes_back_with_NOT_FOUND()
    {
        TestProject project, hiddenProject;
        await using (var db = database.CreateDbContext())
        {
            project = await TestData.CreateProjectAsync(db);
            hiddenProject = await TestData.CreateProjectAsync(db);
        }
        var (parentId, _) = await CreateTaskThroughTheApiAsync(hiddenProject.BoardId, "Hidden parent");

        var json = await PostGraphQLAsMemberAsync(project, $$"""
            mutation { createTask(input: { boardId: "{{project.BoardId}}", title: "Child", parentTaskId: "{{parentId}}" }) { id } }
            """);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("NOT_FOUND", error.GetProperty("extensions").GetProperty("code").GetString());
        Assert.Equal($"Parent task '{parentId}' was not found.", error.GetProperty("message").GetString());
    }

    [Fact]
    public async Task MoveTask_refuses_to_complete_a_parent_with_open_subtasks_until_they_are_done()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);
        var (parentId, _) = await CreateTaskThroughTheApiAsync(project.BoardId, "Parent");
        var (firstId, firstReadableId) = await CreateTaskThroughTheApiAsync(project.BoardId, "First", parentId);
        var (secondId, secondReadableId) = await CreateTaskThroughTheApiAsync(project.BoardId, "Second", parentId);
        var completeParent = $$"""
            mutation { moveTask(input: { taskId: "{{parentId}}", columnId: "{{project.DoneColumnId}}" }) { status } }
            """;

        var refused = await PostGraphQLAsMemberAsync(project, completeParent);

        var error = Assert.Single(refused.GetProperty("errors").EnumerateArray());
        var extensions = error.GetProperty("extensions");
        Assert.Equal("BAD_USER_INPUT", extensions.GetProperty("code").GetString());
        Assert.Equal(
            new[] { firstReadableId, secondReadableId },
            extensions.GetProperty("incompleteSubtasks").EnumerateArray().Select(s => s.GetProperty("readableId").GetString()));

        foreach (var subtaskId in new[] { firstId, secondId })
            await PostGraphQLAsMemberAsync(project, $$"""
                mutation { moveTask(input: { taskId: "{{subtaskId}}", columnId: "{{project.DoneColumnId}}" }) { id } }
                """);

        var accepted = await PostGraphQLAsMemberAsync(project, completeParent);

        Assert.Equal("DONE", accepted.GetProperty("data").GetProperty("moveTask").GetProperty("status").GetString());
    }

    [Fact]
    public async Task A_subtask_with_an_unknown_parent_comes_back_with_the_NOT_FOUND_code()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);
        var parentId = Guid.NewGuid();

        var json = await PostGraphQLAsMemberAsync(project, $$"""
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

        var created = await PostGraphQLAsMemberAsync(project, $$"""
            mutation { createTask(input: { boardId: "{{project.BoardId}}", title: "Move me" }) { id } }
            """);
        var taskId = created.GetProperty("data").GetProperty("createTask").GetProperty("id").GetString();

        var json = await PostGraphQLAsMemberAsync(project, $$"""
            mutation { moveTask(input: { taskId: "{{taskId}}", columnId: "{{project.InProgressColumnId}}" }) { id status columnId column { name category } } }
            """);

        var moved = json.GetProperty("data").GetProperty("moveTask");
        Assert.Equal(taskId, moved.GetProperty("id").GetString());
        Assert.Equal("IN_PROGRESS", moved.GetProperty("status").GetString());
        Assert.Equal(project.InProgressColumnId.ToString(), moved.GetProperty("columnId").GetString());
        Assert.Equal("In requirement state", moved.GetProperty("column").GetProperty("name").GetString());

        var tasksJson = await PostGraphQLAsMemberAsync(project, $$"""
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

        var created = await PostGraphQLAsMemberAsync(project, $$"""
            mutation { createTask(input: { boardId: "{{project.BoardId}}", title: "Stay" }) { id } }
            """);
        var taskId = created.GetProperty("data").GetProperty("createTask").GetProperty("id").GetString();

        var json = await PostGraphQLAsMemberAsync(project, $$"""
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
    [InlineData("query { backlog(projectId: \"00000000-0000-0000-0000-000000000001\") { totalCount } }")]
    [InlineData("mutation { addTaskDependency(input: { blockingTaskId: \"00000000-0000-0000-0000-000000000001\", blockedTaskId: \"00000000-0000-0000-0000-000000000002\" }) { blockedTask { id } } }")]
    [InlineData("mutation { createProject(input: { name: \"No token\" }) { id } }")]
    [InlineData("mutation { createBoard(input: { projectId: \"00000000-0000-0000-0000-000000000001\", name: \"No token\" }) { id } }")]
    [InlineData("mutation { assignTask(input: { taskId: \"00000000-0000-0000-0000-000000000001\", userId: \"00000000-0000-0000-0000-000000000002\" }) { id } }")]
    [InlineData("mutation { unassignTask(input: { taskId: \"00000000-0000-0000-0000-000000000001\", userId: \"00000000-0000-0000-0000-000000000002\" }) { id } }")]
    [InlineData("mutation { addProjectMember(input: { projectId: \"00000000-0000-0000-0000-000000000001\", email: \"a@b.c\" }) { userId } }")]
    [InlineData("mutation { removeProjectMember(input: { projectId: \"00000000-0000-0000-0000-000000000001\", userId: \"00000000-0000-0000-0000-000000000002\" }) { userId } }")]
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

        var json = await PostGraphQLAsMemberAsync(project, $$"""
            mutation { createTask(input: { boardId: "{{project.BoardId}}", title: "With dates", startDate: "2026-11-02T00:00:00Z", dueDate: "2026-11-09T00:00:00Z" }) { startDate dueDate } }
            """);

        var created = json.GetProperty("data").GetProperty("createTask");
        Assert.Equal(new DateTimeOffset(2026, 11, 2, 0, 0, 0, TimeSpan.Zero), created.GetProperty("startDate").GetDateTimeOffset());

        var tasks = await PostGraphQLAsMemberAsync(project, $$"""
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

        var json = await PostGraphQLAsMemberAsync(project, $$"""
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

        var json = await PostGraphQLAsOwnerOfBoardAsync(boardId, $$"""
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

        var tasks = await PostGraphQLAsOwnerOfBoardAsync(boardId, $$"""
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
        var (boardId, taskId) = await GivenTaskThroughTheApiAsync();

        var json = await PostGraphQLAsOwnerOfBoardAsync(boardId, $$"""
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

        var json = await PostGraphQLAsOwnerOfBoardAsync(boardId, $$"""
            mutation { updateTask(input: { taskId: "{{taskId}}", title: "", priority: CRITICAL }) { id } }
            """);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("BAD_USER_INPUT", error.GetProperty("extensions").GetProperty("code").GetString());
        Assert.Equal("Title cannot be empty or only spaces.", error.GetProperty("message").GetString());

        var tasks = await PostGraphQLAsOwnerOfBoardAsync(boardId, $$"""
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

    [Theory]
    [InlineData("where: { status: { eq: IN_PROGRESS } }", "Login API|Signup API")]
    [InlineData("where: { priority: { in: [HIGH, CRITICAL] } }", "Login API|Signup API|Login tests")]
    [InlineData("where: { status: { neq: DONE }, priority: { eq: HIGH } }", "Login API|Signup API")]
    [InlineData("where: { or: [{ status: { eq: BACKLOG } }, { priority: { eq: CRITICAL } }] }", "Login page|Login tests")]
    [InlineData("search: \"LOGIN\"", "Login page|Login API|Login tests")]
    [InlineData("search: \"login\", where: { priority: { eq: HIGH } }", "Login API")]
    public async Task Backlog_applies_the_search_and_the_filters_sent_by_the_frontend(string arguments, string expected)
    {
        var project = await GivenBacklogAsync();

        var json = await PostGraphQLAsMemberAsync(project, $$"""
            query { backlog(projectId: "{{project.ProjectId}}", {{arguments}}) { items { title } } }
            """);

        Assert.Equal(expected.Split('|'), BacklogTitles(json));
    }

    [Fact]
    public async Task Backlog_takes_the_filter_as_a_variable_within_the_cost_limit()
    {
        var project = await GivenBacklogAsync();

        var json = await SendGraphQLAsync(
            """
            query Backlog($projectId: UUID!, $search: String, $where: BacklogFilterInput, $page: Int!, $pageSize: Int!) {
              backlog(projectId: $projectId, search: $search, where: $where, page: $page, pageSize: $pageSize) {
                items {
                  id readableId title description priority status startDate dueDate parentTaskId boardId columnId position
                  column { id name category }
                  assignees { id userName }
                }
                totalCount page pageSize totalPages hasNextPage hasPreviousPage
              }
            }
            """,
            TokenFor(project.MemberId),
            new
            {
                projectId = project.ProjectId,
                search = (string?)null,
                where = new { status = new { @in = new[] { "BACKLOG", "DONE" } } },
                page = 1,
                pageSize = 20
            });

        Assert.Equal(new[] { "Login page", "Login tests" }, BacklogTitles(json));
    }

    [Fact]
    public async Task Backlog_can_list_only_the_tasks_that_are_not_subtasks()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);
        var (parentId, _) = await CreateTaskThroughTheApiAsync(project.BoardId, "Parent");
        await CreateTaskThroughTheApiAsync(project.BoardId, "Child", parentId);

        var json = await PostGraphQLAsMemberAsync(project, $$"""
            query { backlog(projectId: "{{project.ProjectId}}", where: { parentTaskId: { eq: null } }) { items { title } } }
            """);

        Assert.Equal(new[] { "Parent" }, BacklogTitles(json));
    }

    [Fact]
    public async Task Backlog_returns_each_tasks_story_points_and_null_when_it_has_none()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);
        var (estimatedId, _) = await CreateTaskThroughTheApiAsync(project.BoardId, "Estimated");
        await CreateTaskThroughTheApiAsync(project.BoardId, "Not estimated");
        await using (var db = database.CreateDbContext())
        {
            var estimated = await db.Set<TaskItem>().SingleAsync(t => t.Id == Guid.Parse(estimatedId));
            estimated.StoryPoints = 3;
            await db.SaveChangesAsync();
        }

        var json = await PostGraphQLAsMemberAsync(project, $$"""
            query { backlog(projectId: "{{project.ProjectId}}") { items { title storyPoints } } }
            """);

        var items = json.GetProperty("data").GetProperty("backlog").GetProperty("items").EnumerateArray().ToList();
        Assert.Equal(new[] { "Estimated", "Not estimated" }, items.Select(i => i.GetProperty("title").GetString()));
        Assert.Equal(3, items[0].GetProperty("storyPoints").GetInt32());
        Assert.Equal(JsonValueKind.Null, items[1].GetProperty("storyPoints").ValueKind);
    }

    [Fact]
    public async Task Backlog_returns_the_requested_page_with_its_metadata()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);
        foreach (var title in new[] { "One", "Two", "Three" })
            await CreateTaskThroughTheApiAsync(project.BoardId, title);

        var json = await PostGraphQLAsMemberAsync(project, $$"""
            query {
              backlog(projectId: "{{project.ProjectId}}", page: 2, pageSize: 2) {
                items { readableId title status }
                totalCount page pageSize totalPages hasNextPage hasPreviousPage
              }
            }
            """);

        Assert.Equal(new[] { "Three" }, BacklogTitles(json));
        var backlog = json.GetProperty("data").GetProperty("backlog");
        var item = Assert.Single(backlog.GetProperty("items").EnumerateArray());
        Assert.Equal($"{project.Key}-3", item.GetProperty("readableId").GetString());
        Assert.Equal("BACKLOG", item.GetProperty("status").GetString());
        Assert.Equal(3, backlog.GetProperty("totalCount").GetInt32());
        Assert.Equal(2, backlog.GetProperty("page").GetInt32());
        Assert.Equal(2, backlog.GetProperty("pageSize").GetInt32());
        Assert.Equal(2, backlog.GetProperty("totalPages").GetInt32());
        Assert.False(backlog.GetProperty("hasNextPage").GetBoolean());
        Assert.True(backlog.GetProperty("hasPreviousPage").GetBoolean());
    }

    [Fact]
    public async Task Backlog_with_a_page_size_over_the_limit_comes_back_with_BAD_USER_INPUT()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);

        var json = await PostGraphQLAsMemberAsync(project, $$"""
            query { backlog(projectId: "{{project.ProjectId}}", pageSize: 500) { totalCount } }
            """);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("BAD_USER_INPUT", error.GetProperty("extensions").GetProperty("code").GetString());
        Assert.Equal("Page size must be between 1 and 100.", error.GetProperty("message").GetString());
    }

    [Fact]
    public async Task Backlog_of_an_unknown_project_comes_back_with_the_NOT_FOUND_code()
    {
        var projectId = Guid.NewGuid();

        var json = await PostGraphQLAsync($$"""
            query { backlog(projectId: "{{projectId}}") { totalCount } }
            """);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("NOT_FOUND", error.GetProperty("extensions").GetProperty("code").GetString());
        Assert.Equal($"Project '{projectId}' was not found.", error.GetProperty("message").GetString());
    }

    [Fact]
    public async Task Backlog_of_a_project_the_user_is_not_a_member_of_comes_back_with_NOT_FOUND_and_no_tasks()
    {
        var project = await GivenBacklogAsync();

        var json = await PostGraphQLAsync($$"""
            query { backlog(projectId: "{{project.ProjectId}}") { totalCount items { title } } }
            """);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("NOT_FOUND", error.GetProperty("extensions").GetProperty("code").GetString());
        Assert.Equal($"Project '{project.ProjectId}' was not found.", error.GetProperty("message").GetString());
        Assert.Equal(JsonValueKind.Null, json.GetProperty("data").ValueKind);
    }

    [Theory]
    [InlineData("where: { title: { eq: \"x\" } }", "title")]
    [InlineData("where: { createdBy: { passwordHash: { eq: \"x\" } } }", "createdBy")]
    public async Task Backlog_refuses_filters_on_fields_it_does_not_offer(string arguments, string field)
    {
        var json = await PostGraphQLAsync($$"""
            query { backlog(projectId: "{{Guid.NewGuid()}}", {{arguments}}) { totalCount } }
            """);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Contains($"`{field}`", error.GetProperty("message").GetString());
        Assert.False(json.TryGetProperty("data", out var data) && data.ValueKind != JsonValueKind.Null);
    }

    [Fact]
    public async Task AddTaskDependency_shows_the_dependency_on_both_tasks_in_the_right_direction()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);
        var a = await CreateTaskThroughTheApiAsync(project.BoardId, "Task A");
        var b = await CreateTaskThroughTheApiAsync(project.BoardId, "Task B");

        var json = await AddTaskDependencyAsync(project, a.Id, b.Id);

        Assert.False(json.TryGetProperty("errors", out var errors), errors.ToString());
        var payload = json.GetProperty("data").GetProperty("addTaskDependency");
        Assert.Equal(new[] { b.ReadableId }, ReadableIds(payload.GetProperty("blockingTask").GetProperty("blocks")));
        Assert.Equal(new[] { a.ReadableId }, ReadableIds(payload.GetProperty("blockedTask").GetProperty("blockedBy")));

        var tasks = await TasksWithDependenciesAsync(project);
        Assert.Equal(new[] { b.ReadableId }, ReadableIds(tasks[a.ReadableId].GetProperty("blocks")));
        Assert.Empty(ReadableIds(tasks[a.ReadableId].GetProperty("blockedBy")));
        Assert.Equal(new[] { a.ReadableId }, ReadableIds(tasks[b.ReadableId].GetProperty("blockedBy")));
        Assert.Empty(ReadableIds(tasks[b.ReadableId].GetProperty("blocks")));
    }

    [Fact]
    public async Task AddTaskDependency_that_closes_a_cycle_comes_back_with_BAD_USER_INPUT_and_is_not_saved()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);
        var a = await CreateTaskThroughTheApiAsync(project.BoardId, "Task A");
        var b = await CreateTaskThroughTheApiAsync(project.BoardId, "Task B");
        var c = await CreateTaskThroughTheApiAsync(project.BoardId, "Task C");
        await AddTaskDependencyAsync(project, a.Id, b.Id);
        await AddTaskDependencyAsync(project, b.Id, c.Id);

        var json = await AddTaskDependencyAsync(project, c.Id, a.Id);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("BAD_USER_INPUT", error.GetProperty("extensions").GetProperty("code").GetString());
        Assert.Equal(
            $"{c.ReadableId} can't block {a.ReadableId}: {a.ReadableId} already blocks {c.ReadableId} " +
            $"({a.ReadableId} → {b.ReadableId} → {c.ReadableId}), so this would create a cycle.",
            error.GetProperty("message").GetString());

        var tasks = await TasksWithDependenciesAsync(project);
        Assert.Empty(ReadableIds(tasks[c.ReadableId].GetProperty("blocks")));
        Assert.Empty(ReadableIds(tasks[a.ReadableId].GetProperty("blockedBy")));
        Assert.Equal(new[] { b.ReadableId }, ReadableIds(tasks[a.ReadableId].GetProperty("blocks")));
        Assert.Equal(new[] { c.ReadableId }, ReadableIds(tasks[b.ReadableId].GetProperty("blocks")));
    }

    [Fact]
    public async Task AddTaskDependency_between_projects_comes_back_with_BAD_USER_INPUT()
    {
        TestProject mine, other;
        await using (var db = database.CreateDbContext())
        {
            mine = await TestData.CreateProjectAsync(db);
            other = await TestData.CreateProjectAsync(db);
            await TestData.AddMemberAsync(db, other.ProjectId, ProjectRole.Writer, mine.MemberId);
        }
        var a = await CreateTaskThroughTheApiAsync(mine.BoardId, "Mine");
        var foreign = await CreateTaskThroughTheApiAsync(other.BoardId, "Foreign");

        var json = await AddTaskDependencyAsync(mine, a.Id, foreign.Id);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("BAD_USER_INPUT", error.GetProperty("extensions").GetProperty("code").GetString());
        Assert.Equal(
            $"{a.ReadableId} and {foreign.ReadableId} are in different projects. A task can only block a task of the same project.",
            error.GetProperty("message").GetString());
    }

    [Fact]
    public async Task AddTaskDependency_by_a_reader_comes_back_with_AUTH_NOT_AUTHORIZED()
    {
        TestProject project;
        Guid readerId;
        await using (var db = database.CreateDbContext())
        {
            project = await TestData.CreateProjectAsync(db);
            readerId = await TestData.AddMemberAsync(db, project.ProjectId, ProjectRole.Reader);
        }
        var a = await CreateTaskThroughTheApiAsync(project.BoardId, "Task A");
        var b = await CreateTaskThroughTheApiAsync(project.BoardId, "Task B");

        var json = await SendGraphQLAsync(AddTaskDependencyMutation(a.Id, b.Id), TokenFor(readerId));

        Assert.Equal("AUTH_NOT_AUTHORIZED", ErrorCode(json));
    }

    [Fact]
    public async Task CreateProject_makes_the_logged_in_user_owner_and_the_projects_query_lists_it()
    {
        var email = $"{Guid.NewGuid():N}@test.local";
        var userId = await RegisterAsync(email);
        var token = await LoginAsync(email);
        var key = "K" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();

        var json = await SendGraphQLAsync($$"""
            mutation {
              createProject(input: { name: "  API project  ", key: "{{key.ToLowerInvariant()}}", description: "Made through the API" }) {
                id key name description role
                boards { name columns { name } }
                projectMembers { userId role }
              }
            }
            """, token);

        Assert.False(json.TryGetProperty("errors", out var errors), errors.ToString());
        var project = json.GetProperty("data").GetProperty("createProject");
        Assert.Equal(key, project.GetProperty("key").GetString());
        Assert.Equal("API project", project.GetProperty("name").GetString());
        Assert.Equal("Made through the API", project.GetProperty("description").GetString());
        Assert.Equal("OWNER", project.GetProperty("role").GetString());
        var board = Assert.Single(project.GetProperty("boards").EnumerateArray());
        Assert.Equal("Board", board.GetProperty("name").GetString());
        Assert.Equal(
            new[] { "Backlog", "To do", "In progress", "Done" },
            board.GetProperty("columns").EnumerateArray().Select(c => c.GetProperty("name").GetString()));
        var member = Assert.Single(project.GetProperty("projectMembers").EnumerateArray());
        Assert.Equal(userId, member.GetProperty("userId").GetString());
        Assert.Equal("OWNER", member.GetProperty("role").GetString());

        var listed = await SendGraphQLAsync($$"""
            query { projects(userId: "{{userId}}") { id key role } }
            """, token);
        var listedProject = Assert.Single(listed.GetProperty("data").GetProperty("projects").EnumerateArray());
        Assert.Equal(project.GetProperty("id").GetString(), listedProject.GetProperty("id").GetString());
        Assert.Equal("OWNER", listedProject.GetProperty("role").GetString());
    }

    [Theory]
    [InlineData("name: \"\"", "Project name cannot be empty or only spaces.")]
    [InlineData("name: \"   \"", "Project name cannot be empty or only spaces.")]
    [InlineData("name: \"Website\", key: \"WEB-1\"", "Project key must be 2 to 10 letters or digits (A-Z, 0-9).")]
    public async Task CreateProject_with_wrong_input_comes_back_with_BAD_USER_INPUT(string fields, string message)
    {
        var json = await PostGraphQLAsync($$"""
            mutation { createProject(input: { {{fields}} }) { id } }
            """);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("BAD_USER_INPUT", error.GetProperty("extensions").GetProperty("code").GetString());
        Assert.Equal(message, error.GetProperty("message").GetString());
    }

    [Fact]
    public async Task AddProjectMember_gives_the_account_access_to_the_project()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);
        var email = $"{Guid.NewGuid():N}@test.local";
        var userId = await RegisterAsync(email);
        var token = await LoginAsync(email);
        Assert.Equal("NOT_FOUND", ErrorCode(await SendGraphQLAsync(BacklogOf(project), token)));

        var json = await PostGraphQLAsMemberAsync(project, $$"""
            mutation { addProjectMember(input: { projectId: "{{project.ProjectId}}", email: "{{email}}", role: READER }) { projectId userId userName role } }
            """);

        Assert.False(json.TryGetProperty("errors", out var errors), errors.ToString());
        var member = json.GetProperty("data").GetProperty("addProjectMember");
        Assert.Equal(userId, member.GetProperty("userId").GetString());
        Assert.Equal(email, member.GetProperty("userName").GetString());
        Assert.Equal("READER", member.GetProperty("role").GetString());

        var projects = await SendGraphQLAsync($$"""query { projects(userId: "{{userId}}") { id role } }""", token);
        var listed = Assert.Single(projects.GetProperty("data").GetProperty("projects").EnumerateArray());
        Assert.Equal(project.ProjectId.ToString(), listed.GetProperty("id").GetString());
        Assert.Equal("READER", listed.GetProperty("role").GetString());
        var backlog = await SendGraphQLAsync(BacklogOf(project), token);
        Assert.False(backlog.TryGetProperty("errors", out var backlogErrors), backlogErrors.ToString());
    }

    [Fact]
    public async Task RemoveProjectMember_ends_the_access_of_the_removed_account()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);
        var email = $"{Guid.NewGuid():N}@test.local";
        var userId = await RegisterAsync(email);
        var token = await LoginAsync(email);
        await PostGraphQLAsMemberAsync(project, $$"""
            mutation { addProjectMember(input: { projectId: "{{project.ProjectId}}", email: "{{email}}" }) { userId } }
            """);
        Assert.False((await SendGraphQLAsync(BacklogOf(project), token)).TryGetProperty("errors", out _));

        var json = await PostGraphQLAsMemberAsync(project, $$"""
            mutation { removeProjectMember(input: { projectId: "{{project.ProjectId}}", userId: "{{userId}}" }) { userId role } }
            """);

        Assert.False(json.TryGetProperty("errors", out var errors), errors.ToString());
        var removed = json.GetProperty("data").GetProperty("removeProjectMember");
        Assert.Equal(userId, removed.GetProperty("userId").GetString());
        Assert.Equal("WRITER", removed.GetProperty("role").GetString());
        Assert.Equal("NOT_FOUND", ErrorCode(await SendGraphQLAsync(BacklogOf(project), token)));
        var projects = await SendGraphQLAsync($$"""query { projects(userId: "{{userId}}") { id } }""", token);
        Assert.Empty(projects.GetProperty("data").GetProperty("projects").EnumerateArray());
    }

    [Fact]
    public async Task RemoveProjectMember_of_the_owner_comes_back_with_BAD_USER_INPUT()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);

        var json = await PostGraphQLAsMemberAsync(project, $$"""
            mutation { removeProjectMember(input: { projectId: "{{project.ProjectId}}", userId: "{{project.MemberId}}" }) { userId } }
            """);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("BAD_USER_INPUT", error.GetProperty("extensions").GetProperty("code").GetString());
        Assert.EndsWith("is the owner of this project and can't be removed.", error.GetProperty("message").GetString());
        Assert.False((await PostGraphQLAsMemberAsync(project, BacklogOf(project))).TryGetProperty("errors", out _));
    }

    [Fact]
    public async Task AddProjectMember_as_OWNER_comes_back_with_BAD_USER_INPUT()
    {
        TestProject project;
        (Guid Id, string Email) account;
        await using (var db = database.CreateDbContext())
        {
            project = await TestData.CreateProjectAsync(db);
            account = await TestData.CreateAccountAsync(db);
        }

        var json = await PostGraphQLAsMemberAsync(project, $$"""
            mutation { addProjectMember(input: { projectId: "{{project.ProjectId}}", email: "{{account.Email}}", role: OWNER }) { userId } }
            """);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("BAD_USER_INPUT", error.GetProperty("extensions").GetProperty("code").GetString());
        Assert.Equal(
            "A project has only one owner. New members can be readers or writers.",
            error.GetProperty("message").GetString());
    }

    [Fact]
    public async Task AddProjectMember_by_a_reader_comes_back_with_AUTH_NOT_AUTHORIZED()
    {
        TestProject project;
        Guid readerId;
        (Guid Id, string Email) account;
        await using (var db = database.CreateDbContext())
        {
            project = await TestData.CreateProjectAsync(db);
            readerId = await TestData.AddMemberAsync(db, project.ProjectId, ProjectRole.Reader);
            account = await TestData.CreateAccountAsync(db);
        }

        var json = await SendGraphQLAsync($$"""
            mutation { addProjectMember(input: { projectId: "{{project.ProjectId}}", email: "{{account.Email}}" }) { userId } }
            """, TokenFor(readerId));

        Assert.Equal("AUTH_NOT_AUTHORIZED", ErrorCode(json));
    }

    [Theory]
    [InlineData("tasks", false)]
    [InlineData("board", false)]
    [InlineData("backlog", false)]
    [InlineData("createTask", false)]
    [InlineData("moveTask", false)]
    [InlineData("updateTask", false)]
    [InlineData("addTaskDependency", false)]
    [InlineData("tasks", true)]
    [InlineData("board", true)]
    [InlineData("backlog", true)]
    [InlineData("createTask", true)]
    [InlineData("moveTask", true)]
    [InlineData("updateTask", true)]
    [InlineData("addTaskDependency", true)]
    [InlineData("assignTask", false)]
    [InlineData("unassignTask", false)]
    [InlineData("assignTask", true)]
    [InlineData("unassignTask", true)]
    public async Task Someone_who_is_not_or_no_longer_a_member_gets_NOT_FOUND_and_changes_nothing(string operation, bool wasMember)
    {
        var (project, taskId, otherTaskId) = await GivenProjectWithTwoTasksAsync();
        (Guid Id, string Email) outsider;
        await using (var db = database.CreateDbContext())
        {
            outsider = await TestData.CreateAccountAsync(db);
            if (wasMember)
                await TestData.AddMemberAsync(db, project.ProjectId, ProjectRole.Writer, outsider.Id);
        }
        if (wasMember)
        {
            var removed = await PostGraphQLAsMemberAsync(project, $$"""
                mutation { removeProjectMember(input: { projectId: "{{project.ProjectId}}", userId: "{{outsider.Id}}" }) { userId } }
                """);
            Assert.False(removed.TryGetProperty("errors", out var removeErrors), removeErrors.ToString());
        }

        var json = await SendGraphQLAsync(AccessQuery(operation, project, taskId, otherTaskId), TokenFor(outsider.Id));

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("NOT_FOUND", error.GetProperty("extensions").GetProperty("code").GetString());
        Assert.Equal(NotFoundMessage(operation, project, taskId), error.GetProperty("message").GetString());
        Assert.Equal(JsonValueKind.Null, json.GetProperty("data").ValueKind);
        await AssertTasksUnchangedAsync(project);
    }

    [Theory]
    [InlineData("tasks")]
    [InlineData("board")]
    [InlineData("backlog")]
    public async Task A_reader_can_read_the_project(string operation)
    {
        var (project, taskId, otherTaskId) = await GivenProjectWithTwoTasksAsync();
        Guid readerId;
        await using (var db = database.CreateDbContext())
            readerId = await TestData.AddMemberAsync(db, project.ProjectId, ProjectRole.Reader);

        var json = await SendGraphQLAsync(AccessQuery(operation, project, taskId, otherTaskId), TokenFor(readerId));

        Assert.False(json.TryGetProperty("errors", out var errors), errors.ToString());
    }

    [Theory]
    [InlineData("createTask", "Only writers and owners of the project can create tasks.")]
    [InlineData("moveTask", "Only writers and owners of the project can move tasks.")]
    [InlineData("updateTask", "Only writers and owners of the project can edit tasks.")]
    [InlineData("addTaskDependency", "Only writers and owners of the project can add dependencies.")]
    [InlineData("assignTask", "Only writers and owners of the project can assign tasks.")]
    [InlineData("unassignTask", "Only writers and owners of the project can unassign tasks.")]
    public async Task A_reader_cannot_change_tasks(string operation, string message)
    {
        var (project, taskId, otherTaskId) = await GivenProjectWithTwoTasksAsync();
        Guid readerId;
        await using (var db = database.CreateDbContext())
            readerId = await TestData.AddMemberAsync(db, project.ProjectId, ProjectRole.Reader);

        var json = await SendGraphQLAsync(AccessQuery(operation, project, taskId, otherTaskId), TokenFor(readerId));

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("AUTH_NOT_AUTHORIZED", error.GetProperty("extensions").GetProperty("code").GetString());
        Assert.Equal(message, error.GetProperty("message").GetString());
        await AssertTasksUnchangedAsync(project);
    }

    [Theory]
    [InlineData("createTask")]
    [InlineData("moveTask")]
    [InlineData("updateTask")]
    [InlineData("addTaskDependency")]
    [InlineData("assignTask")]
    [InlineData("unassignTask")]
    public async Task A_writer_can_change_tasks(string operation)
    {
        var (project, taskId, otherTaskId) = await GivenProjectWithTwoTasksAsync();
        Guid writerId;
        await using (var db = database.CreateDbContext())
            writerId = await TestData.AddMemberAsync(db, project.ProjectId, ProjectRole.Writer);

        var json = await SendGraphQLAsync(AccessQuery(operation, project, taskId, otherTaskId), TokenFor(writerId));

        Assert.False(json.TryGetProperty("errors", out var errors), errors.ToString());
    }

    [Fact]
    public async Task Tasks_without_a_board_lists_only_the_tasks_of_the_users_projects()
    {
        TestProject mine, theirs;
        await using (var db = database.CreateDbContext())
        {
            mine = await TestData.CreateProjectAsync(db);
            theirs = await TestData.CreateProjectAsync(db);
        }
        var (_, myTask) = await CreateTaskThroughTheApiAsync(mine.BoardId, "Mine");
        await CreateTaskThroughTheApiAsync(theirs.BoardId, "Theirs");

        var json = await PostGraphQLAsMemberAsync(mine, "query { tasks { readableId title } }");

        var task = Assert.Single(json.GetProperty("data").GetProperty("tasks").EnumerateArray());
        Assert.Equal(myTask, task.GetProperty("readableId").GetString());
    }

    [Fact]
    public async Task CreateBoard_returns_the_new_board_with_its_columns_and_it_is_ready_for_tasks()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);

        var json = await PostGraphQLAsMemberAsync(project, $$"""
            mutation { createBoard(input: { projectId: "{{project.ProjectId}}", name: "  Sprint 2  " }) { id projectId name columns { name category } } }
            """);

        Assert.False(json.TryGetProperty("errors", out var errors), errors.ToString());
        var board = json.GetProperty("data").GetProperty("createBoard");
        var boardId = board.GetProperty("id").GetString();
        Assert.Equal("Sprint 2", board.GetProperty("name").GetString());
        Assert.Equal(project.ProjectId.ToString(), board.GetProperty("projectId").GetString());
        Assert.Equal(
            new[] { "BACKLOG", "TO_DO", "IN_PROGRESS", "DONE" },
            board.GetProperty("columns").EnumerateArray().Select(c => c.GetProperty("category").GetString()));

        var projects = await PostGraphQLAsMemberAsync(project, "query { projects { boards { id name } } }");
        var boards = Assert.Single(projects.GetProperty("data").GetProperty("projects").EnumerateArray()).GetProperty("boards");
        Assert.Equal(new[] { "Board", "Sprint 2" }, boards.EnumerateArray().Select(b => b.GetProperty("name").GetString()));

        var task = await PostGraphQLAsMemberAsync(project, $$"""
            mutation { createTask(input: { boardId: "{{boardId}}", title: "First on the new board" }) { boardId status } }
            """);
        Assert.Equal(boardId, task.GetProperty("data").GetProperty("createTask").GetProperty("boardId").GetString());
    }

    [Fact]
    public async Task CreateBoard_with_a_name_already_used_in_the_project_comes_back_with_BAD_USER_INPUT()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);

        var json = await PostGraphQLAsMemberAsync(project, $$"""
            mutation { createBoard(input: { projectId: "{{project.ProjectId}}", name: "board" }) { id } }
            """);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("BAD_USER_INPUT", error.GetProperty("extensions").GetProperty("code").GetString());
        Assert.Equal("A board named 'board' already exists in this project.", error.GetProperty("message").GetString());
    }

    [Theory]
    [InlineData(ProjectRole.Writer)]
    [InlineData(ProjectRole.Reader)]
    public async Task CreateBoard_by_a_writer_or_reader_comes_back_with_AUTH_NOT_AUTHORIZED(ProjectRole role)
    {
        TestProject project;
        Guid memberId;
        await using (var db = database.CreateDbContext())
        {
            project = await TestData.CreateProjectAsync(db);
            memberId = await TestData.AddMemberAsync(db, project.ProjectId, role);
        }

        var json = await SendGraphQLAsync($$"""
            mutation { createBoard(input: { projectId: "{{project.ProjectId}}", name: "Sprint 2" }) { id } }
            """, TokenFor(memberId));

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("AUTH_NOT_AUTHORIZED", error.GetProperty("extensions").GetProperty("code").GetString());
        Assert.Equal("Only the owner of the project can create boards.", error.GetProperty("message").GetString());
    }

    [Fact]
    public async Task CreateBoard_by_a_non_member_comes_back_with_NOT_FOUND()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);

        var json = await PostGraphQLAsync($$"""
            mutation { createBoard(input: { projectId: "{{project.ProjectId}}", name: "Sprint 2" }) { id } }
            """);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("NOT_FOUND", error.GetProperty("extensions").GetProperty("code").GetString());
        Assert.Equal($"Project '{project.ProjectId}' was not found.", error.GetProperty("message").GetString());
    }

    [Fact]
    public async Task AssignTask_adds_assignees_and_unassignTask_removes_only_that_one()
    {
        var (project, taskId, _) = await GivenProjectWithTwoTasksAsync();
        Guid writerId;
        await using (var db = database.CreateDbContext())
            writerId = await TestData.AddMemberAsync(db, project.ProjectId, ProjectRole.Writer);

        await PostGraphQLAsMemberAsync(project, $$"""
            mutation { assignTask(input: { taskId: "{{taskId}}", userId: "{{project.MemberId}}" }) { id } }
            """);
        var assigned = await PostGraphQLAsMemberAsync(project, $$"""
            mutation { assignTask(input: { taskId: "{{taskId}}", userId: "{{writerId}}" }) { id assignees { id userName } } }
            """);

        Assert.False(assigned.TryGetProperty("errors", out var errors), errors.ToString());
        var both = new[] { project.MemberId.ToString(), writerId.ToString() }.Order().ToArray();
        Assert.Equal(both, assigned.GetProperty("data").GetProperty("assignTask").GetProperty("assignees")
            .EnumerateArray().Select(a => a.GetProperty("id").GetString()).Order());
        Assert.Equal(both, (await AssigneeIdsInTasksQueryAsync(project, taskId)).Order());

        var unassigned = await PostGraphQLAsMemberAsync(project, $$"""
            mutation { unassignTask(input: { taskId: "{{taskId}}", userId: "{{project.MemberId}}" }) { id assignees { id } } }
            """);

        var remaining = Assert.Single(unassigned.GetProperty("data").GetProperty("unassignTask").GetProperty("assignees").EnumerateArray());
        Assert.Equal(writerId.ToString(), remaining.GetProperty("id").GetString());
        Assert.Equal(new[] { writerId.ToString() }, await AssigneeIdsInTasksQueryAsync(project, taskId));
    }

    [Fact]
    public async Task AssignTask_of_a_user_outside_the_project_comes_back_with_BAD_USER_INPUT()
    {
        var (project, taskId, _) = await GivenProjectWithTwoTasksAsync();
        (Guid Id, string Email) outsider;
        await using (var db = database.CreateDbContext())
            outsider = await TestData.CreateAccountAsync(db);

        var json = await PostGraphQLAsMemberAsync(project, $$"""
            mutation { assignTask(input: { taskId: "{{taskId}}", userId: "{{outsider.Id}}" }) { id } }
            """);

        var error = Assert.Single(json.GetProperty("errors").EnumerateArray());
        Assert.Equal("BAD_USER_INPUT", error.GetProperty("extensions").GetProperty("code").GetString());
        Assert.Equal(
            $"User '{outsider.Id}' is not a member of project {project.Key}, so they can't be assigned to this task.",
            error.GetProperty("message").GetString());
        Assert.Empty(await AssigneeIdsInTasksQueryAsync(project, taskId));
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
        var json = await PostGraphQLAsOwnerOfBoardAsync(boardId, $$"""
            query { board(id: "{{boardId}}") { id name columns { id name category position } } }
            """);

        var board = json.GetProperty("data").GetProperty("board");
        Assert.Equal(boardId.ToString(), board.GetProperty("id").GetString());
        return board.GetProperty("columns").EnumerateArray().ToList();
    }

    private Task<JsonElement> PostGraphQLAsync(string query) => SendGraphQLAsync(query, Token);

    private Task<JsonElement> PostAnonymousGraphQLAsync(string query) => SendGraphQLAsync(query, token: null);

    private Task<JsonElement> PostGraphQLAsMemberAsync(TestProject project, string query) =>
        SendGraphQLAsync(query, TokenFor(project.MemberId));

    private async Task<JsonElement> PostGraphQLAsOwnerOfBoardAsync(Guid boardId, string query)
    {
        Guid ownerId;
        await using (var db = database.CreateDbContext())
            ownerId = await TestData.OwnerOfBoardAsync(db, boardId);
        return await SendGraphQLAsync(query, TokenFor(ownerId));
    }

    private Task<JsonElement> AddTaskDependencyAsync(TestProject project, string blockingTaskId, string blockedTaskId) =>
        PostGraphQLAsMemberAsync(project, AddTaskDependencyMutation(blockingTaskId, blockedTaskId));

    private static string AddTaskDependencyMutation(string blockingTaskId, string blockedTaskId) => $$"""
        mutation {
          addTaskDependency(input: { blockingTaskId: "{{blockingTaskId}}", blockedTaskId: "{{blockedTaskId}}" }) {
            blockingTask { readableId blocks { readableId } }
            blockedTask { readableId blockedBy { readableId } }
          }
        }
        """;

    private async Task<Dictionary<string, JsonElement>> TasksWithDependenciesAsync(TestProject project)
    {
        var json = await PostGraphQLAsMemberAsync(project, $$"""
            query { tasks(boardId: "{{project.BoardId}}") { readableId blocks { readableId } blockedBy { readableId } } }
            """);
        return json.GetProperty("data").GetProperty("tasks").EnumerateArray()
            .ToDictionary(t => t.GetProperty("readableId").GetString()!);
    }

    private static string[] ReadableIds(JsonElement tasks) =>
        tasks.EnumerateArray().Select(t => t.GetProperty("readableId").GetString()!).ToArray();

    private async Task<(TestProject Project, string TaskId, string OtherTaskId)> GivenProjectWithTwoTasksAsync()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);
        var (taskId, _) = await CreateTaskThroughTheApiAsync(project.BoardId, "First");
        var (otherTaskId, _) = await CreateTaskThroughTheApiAsync(project.BoardId, "Second");
        return (project, taskId, otherTaskId);
    }

    private static string AccessQuery(string operation, TestProject project, string taskId, string otherTaskId) => operation switch
    {
        "tasks" => $$"""query { tasks(boardId: "{{project.BoardId}}") { id title } }""",
        "board" => $$"""query { board(id: "{{project.BoardId}}") { id name columns { id } } }""",
        "backlog" => $$"""query { backlog(projectId: "{{project.ProjectId}}") { totalCount items { title } } }""",
        "createTask" => $$"""mutation { createTask(input: { boardId: "{{project.BoardId}}", title: "Added" }) { id } }""",
        "moveTask" => $$"""mutation { moveTask(input: { taskId: "{{taskId}}", columnId: "{{project.InProgressColumnId}}" }) { id } }""",
        "updateTask" => $$"""mutation { updateTask(input: { taskId: "{{taskId}}", title: "Changed" }) { id } }""",
        "addTaskDependency" => $$"""mutation { addTaskDependency(input: { blockingTaskId: "{{taskId}}", blockedTaskId: "{{otherTaskId}}" }) { blockedTask { id } } }""",
        "assignTask" => $$"""mutation { assignTask(input: { taskId: "{{taskId}}", userId: "{{project.MemberId}}" }) { id assignees { id } } }""",
        "unassignTask" => $$"""mutation { unassignTask(input: { taskId: "{{taskId}}", userId: "{{project.MemberId}}" }) { id assignees { id } } }""",
        _ => throw new ArgumentOutOfRangeException(nameof(operation), operation, null)
    };

    private static string NotFoundMessage(string operation, TestProject project, string taskId) => operation switch
    {
        "tasks" or "board" or "createTask" => $"Board '{project.BoardId}' was not found.",
        "backlog" => $"Project '{project.ProjectId}' was not found.",
        _ => $"Task '{taskId}' was not found."
    };

    private async Task AssertTasksUnchangedAsync(TestProject project)
    {
        await using var db = database.CreateDbContext();
        var tasks = await db.Set<TaskItem>()
            .Where(t => t.ProjectId == project.ProjectId)
            .OrderBy(t => t.Number)
            .Select(t => new { t.Title, t.ColumnId })
            .ToListAsync();
        Assert.Equal(new[] { "First", "Second" }, tasks.Select(t => t.Title));
        Assert.All(tasks, t => Assert.Equal(project.BacklogColumnId, t.ColumnId));
        Assert.False(await db.taskDependencies.AnyAsync(d => d.BlockingTask.ProjectId == project.ProjectId));
        Assert.False(await db.assignees.AnyAsync(a => a.Task.ProjectId == project.ProjectId));
    }

    private async Task<string[]> AssigneeIdsInTasksQueryAsync(TestProject project, string taskId)
    {
        var json = await PostGraphQLAsMemberAsync(project, $$"""
            query { tasks(boardId: "{{project.BoardId}}") { id assignees { id } } }
            """);
        var task = json.GetProperty("data").GetProperty("tasks").EnumerateArray()
            .Single(t => t.GetProperty("id").GetString() == taskId);
        return task.GetProperty("assignees").EnumerateArray().Select(a => a.GetProperty("id").GetString()!).ToArray();
    }

    private static string BacklogOf(TestProject project) =>
        $$"""query { backlog(projectId: "{{project.ProjectId}}") { totalCount } }""";

    private string TokenFor(Guid userId) =>
        _factory.Services.GetRequiredService<IAccessTokenService>().Create(userId, $"{userId:N}@test.local").Token;

    private async Task<JsonElement> SendGraphQLAsync(string query, string? token, object? variables = null)
    {
        using var client = _factory.CreateClient();
        if (token is not null)
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.PostAsJsonAsync("/graphql", new { query, variables });
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private async Task<TestProject> GivenBacklogAsync()
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);

        await CreateTaskInColumnAsync(project.BoardId, project.InProgressColumnId, "Login API", "HIGH");
        await CreateTaskInColumnAsync(project.BoardId, project.BacklogColumnId, "Login page", "LOW");
        await CreateTaskInColumnAsync(project.BoardId, project.DoneColumnId, "Login tests", "CRITICAL");
        await CreateTaskInColumnAsync(project.BoardId, project.InProgressColumnId, "Signup API", "HIGH");
        return project;
    }

    private async Task CreateTaskInColumnAsync(Guid boardId, Guid columnId, string title, string priority)
    {
        var json = await PostGraphQLAsOwnerOfBoardAsync(boardId, $$"""
            mutation { createTask(input: { boardId: "{{boardId}}", columnId: "{{columnId}}", title: "{{title}}", priority: {{priority}} }) { id } }
            """);
        Assert.False(json.TryGetProperty("errors", out var errors), errors.ToString());
    }

    private static string[] BacklogTitles(JsonElement json)
    {
        Assert.False(json.TryGetProperty("errors", out var errors), errors.ToString());
        return json.GetProperty("data").GetProperty("backlog").GetProperty("items").EnumerateArray()
            .Select(t => t.GetProperty("title").GetString()!)
            .ToArray();
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

        var json = await PostGraphQLAsMemberAsync(project, $$"""
            mutation { createTask(input: { boardId: "{{project.BoardId}}", title: "Original title", description: "Original description", priority: LOW }) { id } }
            """);
        return (project.BoardId, json.GetProperty("data").GetProperty("createTask").GetProperty("id").GetString()!);
    }

    private async Task<(string Id, string ReadableId)> CreateTaskThroughTheApiAsync(Guid boardId, string title, string? parentId = null)
    {
        var parent = parentId is null ? "" : $", parentTaskId: \"{parentId}\"";
        var json = await PostGraphQLAsOwnerOfBoardAsync(boardId, $$"""
            mutation { createTask(input: { boardId: "{{boardId}}", title: "{{title}}"{{parent}} }) { id readableId } }
            """);
        var created = json.GetProperty("data").GetProperty("createTask");
        return (created.GetProperty("id").GetString()!, created.GetProperty("readableId").GetString()!);
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
