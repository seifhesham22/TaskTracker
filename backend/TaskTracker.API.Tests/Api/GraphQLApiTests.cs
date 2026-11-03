using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TaskTracker.API.Tests.Infrastructure;

namespace TaskTracker.API.Tests.Api;

[Collection(nameof(PostgresCollection))]
public class GraphQLApiTests(PostgresFixture database) : IDisposable
{
    private const string FrontendOrigin = "http://localhost:5173";

    private readonly WebApplicationFactory<Program> _factory = new WebApplicationFactory<Program>()
        .WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("ConnectionStrings:DefaultConnection", database.ConnectionString);
        });

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

    private async Task<JsonElement> PostGraphQLAsync(string query)
    {
        using var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/graphql", new { query });
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

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