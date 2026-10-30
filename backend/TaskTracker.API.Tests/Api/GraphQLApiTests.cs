using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
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