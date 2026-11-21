using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Features.Tasks;
using TaskTracker.API.Features.Tasks.CreateTask;
using TaskTracker.API.Features.Tasks.GetBacklog;
using TaskTracker.API.Features.Tasks.RankTask;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.Membership;
using TaskTracker.API.Shared.Positions;
using TaskTracker.API.Shared.Tasks;
using TaskTracker.API.Tests.Infrastructure;

namespace TaskTracker.API.Tests.Features.Tasks;

[Collection(nameof(PostgresCollection))]
public class RankTaskHandlerTests(PostgresFixture database)
{
    [Fact]
    public async Task A_task_can_be_moved_to_the_top()
    {
        var (project, t) = await GivenBacklogAsync("A", "B", "C", "D");

        await RankAsync(project, t["D"], after: null);

        Assert.Equal(new[] { "D", "A", "B", "C" }, await BacklogAsync(project));
    }

    [Fact]
    public async Task A_task_can_be_moved_after_another()
    {
        var (project, t) = await GivenBacklogAsync("A", "B", "C", "D");

        await RankAsync(project, t["A"], after: t["C"]);

        Assert.Equal(new[] { "B", "C", "A", "D" }, await BacklogAsync(project));
    }

    [Fact]
    public async Task A_task_can_be_moved_to_the_bottom()
    {
        var (project, t) = await GivenBacklogAsync("A", "B", "C", "D");

        await RankAsync(project, t["A"], after: t["D"]);

        Assert.Equal(new[] { "B", "C", "D", "A" }, await BacklogAsync(project));
    }

    [Fact]
    public async Task Moving_a_task_where_it_already_is_changes_nothing()
    {
        var (project, t) = await GivenBacklogAsync("A", "B", "C");
        var rankBefore = await RankOfAsync(t["B"]);

        await RankAsync(project, t["B"], after: t["A"]);
        await RankAsync(project, t["A"], after: null);

        Assert.Equal(new[] { "A", "B", "C" }, await BacklogAsync(project));
        Assert.Equal(rankBefore, await RankOfAsync(t["B"]));
    }

    [Fact]
    public async Task The_new_order_is_saved_and_every_member_sees_it()
    {
        var (project, t) = await GivenBacklogAsync("A", "B", "C");
        var readerId = await GivenMemberAsync(project, ProjectRole.Reader);

        await RankAsync(project, t["C"], after: null);

        Assert.Equal(new[] { "C", "A", "B" }, await BacklogAsync(project, readerId));
    }

    [Fact]
    public async Task A_writer_can_change_the_order()
    {
        var (project, t) = await GivenBacklogAsync("A", "B");
        var writerId = await GivenMemberAsync(project, ProjectRole.Writer);

        await RankAsAsync(t["B"], after: null, writerId);

        Assert.Equal(new[] { "B", "A" }, await BacklogAsync(project));
    }

    [Fact]
    public async Task A_reader_cannot_change_the_order()
    {
        var (project, t) = await GivenBacklogAsync("A", "B");
        var readerId = await GivenMemberAsync(project, ProjectRole.Reader);

        var error = await Assert.ThrowsAsync<ForbiddenException>(() => RankAsAsync(t["B"], after: null, readerId));

        Assert.Equal("Only writers and owners of the project can change the backlog order.", error.Message);
        Assert.Equal(new[] { "A", "B" }, await BacklogAsync(project));
    }

    [Fact]
    public async Task Someone_who_is_not_a_member_gets_not_found()
    {
        var (project, t) = await GivenBacklogAsync("A", "B");
        var (other, _) = await GivenBacklogAsync();

        var error = await Assert.ThrowsAsync<NotFoundException>(() => RankAsAsync(t["B"], after: null, other.MemberId));

        Assert.Equal($"Task '{t["B"]}' was not found.", error.Message);
        Assert.Equal(new[] { "A", "B" }, await BacklogAsync(project));
    }

    [Fact]
    public async Task A_task_cannot_be_placed_after_itself()
    {
        var (project, t) = await GivenBacklogAsync("A", "B");

        var error = await Assert.ThrowsAsync<BadUserInputException>(() => RankAsync(project, t["A"], after: t["A"]));

        Assert.Equal("A task can't be placed after itself.", error.Message);
    }

    [Fact]
    public async Task A_task_cannot_be_placed_after_a_task_of_another_project()
    {
        var (project, t) = await GivenBacklogAsync("A", "B");
        var (_, other) = await GivenBacklogAsync("Elsewhere");

        var error = await Assert.ThrowsAsync<NotFoundException>(() => RankAsync(project, t["A"], after: other["Elsewhere"]));

        Assert.Equal($"Task '{other["Elsewhere"]}' was not found in this project.", error.Message);
        Assert.Equal(new[] { "A", "B" }, await BacklogAsync(project));
    }

    [Fact]
    public async Task New_tasks_go_to_the_bottom_after_a_reorder()
    {
        var (project, t) = await GivenBacklogAsync("A", "B", "C");
        await RankAsync(project, t["C"], after: null);

        await CreateTaskAsync(project, "New");

        Assert.Equal(new[] { "C", "A", "B", "New" }, await BacklogAsync(project));
    }

    [Fact]
    public async Task Many_moves_keep_the_order_the_user_asked_for()
    {
        var names = new[] { "A", "B", "C", "D", "E", "F" };
        var (project, t) = await GivenBacklogAsync(names);
        var expected = names.ToList();
        var moves = new (string Task, string? After)[]
        {
            ("F", null), ("A", "F"), ("C", "E"), ("B", null), ("E", "B"), ("D", "A"),
            ("F", "C"), ("A", null), ("C", "A"), ("B", "F"), ("E", null), ("D", "E")
        };

        foreach (var (task, after) in moves)
        {
            await RankAsync(project, t[task], after is null ? null : t[after]);
            expected.Remove(task);
            expected.Insert(after is null ? 0 : expected.IndexOf(after) + 1, task);
        }

        Assert.Equal(expected, await BacklogAsync(project));
    }

    [Fact]
    public async Task Pages_of_a_reordered_backlog_list_every_task_once_in_the_new_order()
    {
        var (project, t) = await GivenBacklogAsync("A", "B", "C", "D", "E", "F", "G");
        await RankAsync(project, t["G"], after: null);
        await RankAsync(project, t["A"], after: t["D"]);
        await RankAsync(project, t["E"], after: t["G"]);
        var all = await BacklogAsync(project);

        var pages = new List<string>();
        for (var page = 1; page <= 3; page++)
            pages.AddRange(await BacklogAsync(project, page: page, pageSize: 3));

        Assert.Equal(new[] { "G", "E", "B", "C", "D", "A", "F" }, all);
        Assert.Equal(all, pages);
    }

    [Fact]
    public async Task When_ranks_get_too_long_the_backlog_is_renumbered_in_the_asked_order()
    {
        var (project, t) = await GivenBacklogAsync("A", "B", "C");
        await SetRankAsync(t["A"], new string('0', RankTaskHandler.MaxRankLength - 1) + "1");

        await RankAsync(project, t["C"], after: null);

        Assert.Equal(new[] { "C", "A", "B" }, await BacklogAsync(project));
        Assert.Equal(new[] { "0000000001", "0000000002", "0000000003" }, await RanksInOrderAsync(project));
    }

    [Fact]
    public async Task Renumbering_also_works_when_placing_after_another_task()
    {
        var (project, t) = await GivenBacklogAsync("A", "B", "C");
        var prefix = new string('0', RankTaskHandler.MaxRankLength - 1);
        await SetRankAsync(t["A"], prefix + "1");
        await SetRankAsync(t["B"], prefix + "2");

        await RankAsync(project, t["C"], after: t["A"]);

        Assert.Equal(new[] { "A", "C", "B" }, await BacklogAsync(project));
        Assert.All(await RanksInOrderAsync(project), rank => Assert.Equal(10, rank.Length));
    }

    [Fact]
    public async Task Two_moves_at_the_same_time_are_both_applied()
    {
        var (project, t) = await GivenBacklogAsync("A", "B", "C", "D");

        await Task.WhenAll(RankAsync(project, t["D"], after: null), RankAsync(project, t["A"], after: t["B"]));

        Assert.Equal(new[] { "D", "B", "A", "C" }, await BacklogAsync(project));
    }

    [Fact]
    public async Task Two_tasks_moved_to_the_top_at_the_same_time_get_different_ranks()
    {
        var (project, t) = await GivenBacklogAsync("A", "B", "C", "D");

        await Task.WhenAll(RankAsync(project, t["C"], after: null), RankAsync(project, t["D"], after: null));

        var order = await BacklogAsync(project);
        Assert.Equal(new[] { "C", "D" }.Order(), order.Take(2).Order());
        Assert.Equal(new[] { "A", "B" }, order.Skip(2));
        Assert.NotEqual(await RankOfAsync(t["C"]), await RankOfAsync(t["D"]));
    }

    private async Task<(TestProject Project, Dictionary<string, Guid> Tasks)> GivenBacklogAsync(params string[] titles)
    {
        TestProject project;
        await using (var db = database.CreateDbContext())
            project = await TestData.CreateProjectAsync(db);

        var tasks = new Dictionary<string, Guid>();
        foreach (var title in titles)
            tasks[title] = (await CreateTaskAsync(project, title)).Id;
        return (project, tasks);
    }

    private async Task<Guid> GivenMemberAsync(TestProject project, ProjectRole role)
    {
        await using var db = database.CreateDbContext();
        return await TestData.AddMemberAsync(db, project.ProjectId, role);
    }

    private async Task<TaskDto> CreateTaskAsync(TestProject project, string title)
    {
        await using var db = database.CreateDbContext();
        return await new CreateTaskHandler(db, new TaskPositionService(db), new ProjectMembershipService(database)).HandleAsync(
            new CreateTaskInput(project.BoardId, null, title, null, null, null, null), project.MemberId, CancellationToken.None);
    }

    private Task RankAsync(TestProject project, Guid taskId, Guid? after) => RankAsAsync(taskId, after, project.MemberId);

    private async Task RankAsAsync(Guid taskId, Guid? after, Guid userId)
    {
        await using var db = database.CreateDbContext();
        await new RankTaskHandler(db, new TaskLookupService(db, new ProjectMembershipService(database)))
            .HandleAsync(new RankTaskInput(taskId, after), userId, CancellationToken.None);
    }

    private async Task<string[]> BacklogAsync(TestProject project, Guid? userId = null, int page = 1, int pageSize = 100)
    {
        var backlog = await new GetBacklogHandler(database, new ProjectMembershipService(database)).HandleAsync(
            project.ProjectId, userId ?? project.MemberId, null, null, page, pageSize, CancellationToken.None);
        return backlog.Items.Select(i => i.Title).ToArray();
    }

    private async Task SetRankAsync(Guid taskId, string rank)
    {
        await using var db = database.CreateDbContext();
        await db.Set<TaskItem>().Where(x => x.Id == taskId).ExecuteUpdateAsync(s => s.SetProperty(x => x.Rank, rank));
    }

    private async Task<string[]> RanksInOrderAsync(TestProject project)
    {
        await using var db = database.CreateDbContext();
        return await db.Set<TaskItem>()
            .Where(x => x.ProjectId == project.ProjectId)
            .OrderBy(x => x.Rank)
            .Select(x => x.Rank)
            .ToArrayAsync();
    }

    private async Task<string> RankOfAsync(Guid taskId)
    {
        await using var db = database.CreateDbContext();
        return await db.Set<TaskItem>().Where(x => x.Id == taskId).Select(x => x.Rank).SingleAsync();
    }
}
