using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Domain.Exceptions;
using TaskTracker.API.Features.Tasks;
using TaskTracker.API.Features.Tasks.AddTaskDependency;
using TaskTracker.API.Features.Tasks.CreateTask;
using TaskTracker.API.Shared.Dependencies;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.Membership;
using TaskTracker.API.Shared.Positions;
using TaskTracker.API.Shared.Tasks;
using TaskTracker.API.Tests.Infrastructure;

namespace TaskTracker.API.Tests.Features.Tasks;

[Collection(nameof(PostgresCollection))]
public class AddTaskDependencyHandlerTests(PostgresFixture database)
{
    [Fact]
    public async Task Saves_the_dependency_in_the_right_direction_and_returns_both_tasks()
    {
        var project = await GivenProjectAsync();
        var a = await CreateTaskAsync(project.BoardId, "A");
        var b = await CreateTaskAsync(project.BoardId, "B");

        var payload = await AddAsync(project, a, b);

        Assert.Equal(a.Id, payload.BlockingTask.Id);
        Assert.Equal(b.Id, payload.BlockedTask.Id);
        Assert.Equal(new[] { (a.Id, b.Id) }, await SavedDependenciesAsync(project));
    }

    [Fact]
    public async Task Adding_the_same_dependency_twice_saves_it_once()
    {
        var project = await GivenProjectAsync();
        var a = await CreateTaskAsync(project.BoardId, "A");
        var b = await CreateTaskAsync(project.BoardId, "B");

        await AddAsync(project, a, b);
        var again = await AddAsync(project, a, b);

        Assert.Equal(b.Id, again.BlockedTask.Id);
        Assert.Single(await SavedDependenciesAsync(project));
    }

    [Fact]
    public async Task A_task_cannot_block_itself()
    {
        var project = await GivenProjectAsync();
        var a = await CreateTaskAsync(project.BoardId, "A");

        var error = await Assert.ThrowsAsync<DomainException>(() => AddAsync(project, a, a));

        Assert.Equal("A task can't block itself.", error.Message);
        Assert.Empty(await SavedDependenciesAsync(project));
    }

    [Fact]
    public async Task Tasks_of_different_projects_are_refused_and_nothing_is_saved()
    {
        var mine = await GivenProjectAsync();
        var other = await GivenProjectAsync();
        await using (var db = database.CreateDbContext())
            await TestData.AddMemberAsync(db, other.ProjectId, ProjectRole.Writer, mine.MemberId);
        var a = await CreateTaskAsync(mine.BoardId, "A");
        var foreign = await CreateTaskAsync(other.BoardId, "Foreign");

        var error = await Assert.ThrowsAsync<BadUserInputException>(() => AddAsync(mine, a, foreign));

        Assert.Equal(
            $"{a.ReadableId} and {foreign.ReadableId} are in different projects. A task can only block a task of the same project.",
            error.Message);
        Assert.Empty(await SavedDependenciesAsync(mine));
        Assert.Empty(await SavedDependenciesAsync(other));
    }

    [Fact]
    public async Task A_task_in_a_project_the_user_is_not_in_comes_back_as_not_found()
    {
        var mine = await GivenProjectAsync();
        var hidden = await GivenProjectAsync();
        var a = await CreateTaskAsync(mine.BoardId, "A");
        var notMine = await CreateTaskAsync(hidden.BoardId, "Not mine");

        var error = await Assert.ThrowsAsync<NotFoundException>(() => AddAsync(mine, a, notMine));

        Assert.Equal($"Task '{notMine.Id}' was not found.", error.Message);
    }

    [Fact]
    public async Task A_user_who_is_not_a_member_gets_not_found_and_nothing_is_saved()
    {
        var project = await GivenProjectAsync();
        var a = await CreateTaskAsync(project.BoardId, "A");
        var b = await CreateTaskAsync(project.BoardId, "B");
        Guid outsiderId;
        await using (var db = database.CreateDbContext())
            outsiderId = await TestData.CreateUserAsync(db);

        var error = await Assert.ThrowsAsync<NotFoundException>(() => AddAsync(a.Id, b.Id, outsiderId));

        Assert.Equal($"Task '{a.Id}' was not found.", error.Message);
        Assert.Empty(await SavedDependenciesAsync(project));
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task An_unknown_task_comes_back_as_not_found(bool blockingIsUnknown)
    {
        var project = await GivenProjectAsync();
        var known = await CreateTaskAsync(project.BoardId, "Known");
        var unknownId = Guid.NewGuid();

        var error = await Assert.ThrowsAsync<NotFoundException>(() => blockingIsUnknown
            ? AddAsync(unknownId, known.Id, project.MemberId)
            : AddAsync(known.Id, unknownId, project.MemberId));

        Assert.Equal($"Task '{unknownId}' was not found.", error.Message);
    }

    [Fact]
    public async Task A_deleted_task_comes_back_as_not_found()
    {
        var project = await GivenProjectAsync();
        var a = await CreateTaskAsync(project.BoardId, "A");
        var deleted = await CreateTaskAsync(project.BoardId, "Deleted");
        await using (var db = database.CreateDbContext())
            await db.Set<TaskItem>().Where(t => t.Id == deleted.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.IsDeleted, true));

        var error = await Assert.ThrowsAsync<NotFoundException>(() => AddAsync(project, a, deleted));

        Assert.Equal($"Task '{deleted.Id}' was not found.", error.Message);
    }

    [Fact]
    public async Task A_reader_cannot_add_dependencies()
    {
        var project = await GivenProjectAsync();
        var a = await CreateTaskAsync(project.BoardId, "A");
        var b = await CreateTaskAsync(project.BoardId, "B");
        var readerId = await AddMemberAsync(project, ProjectRole.Reader);

        var error = await Assert.ThrowsAsync<ForbiddenException>(() => AddAsync(a.Id, b.Id, readerId));

        Assert.Equal("Only writers and owners of the project can add dependencies.", error.Message);
        Assert.Empty(await SavedDependenciesAsync(project));
    }

    [Theory]
    [InlineData(ProjectRole.Writer)]
    [InlineData(ProjectRole.Owner)]
    public async Task Writers_and_owners_can_add_dependencies(ProjectRole role)
    {
        var project = await GivenProjectAsync();
        var a = await CreateTaskAsync(project.BoardId, "A");
        var b = await CreateTaskAsync(project.BoardId, "B");
        var memberId = role == ProjectRole.Owner ? project.MemberId : await AddMemberAsync(project, role);

        await AddAsync(a.Id, b.Id, memberId);

        Assert.Single(await SavedDependenciesAsync(project));
    }

    [Fact]
    public async Task A_direct_cycle_is_refused_and_the_existing_dependency_stays()
    {
        var project = await GivenProjectAsync();
        var (a, b) = (await CreateTaskAsync(project.BoardId, "A"), await CreateTaskAsync(project.BoardId, "B"));
        await AddAsync(project, a, b);

        var error = await Assert.ThrowsAsync<BadUserInputException>(() => AddAsync(project, b, a));

        Assert.Equal(
            $"{b.ReadableId} can't block {a.ReadableId}: {a.ReadableId} already blocks {b.ReadableId} " +
            $"({a.ReadableId} → {b.ReadableId}), so this would create a cycle.",
            error.Message);
        Assert.Equal(new[] { (a.Id, b.Id) }, await SavedDependenciesAsync(project));
    }

    [Fact]
    public async Task A_cycle_of_three_tasks_is_refused_and_nothing_is_saved()
    {
        var project = await GivenProjectAsync();
        var t = await CreateTasksAsync(project, 3);
        await AddAsync(project, t[0], t[1]);
        await AddAsync(project, t[1], t[2]);

        var error = await Assert.ThrowsAsync<BadUserInputException>(() => AddAsync(project, t[2], t[0]));

        Assert.Equal(
            $"{t[2].ReadableId} can't block {t[0].ReadableId}: {t[0].ReadableId} already blocks {t[2].ReadableId} " +
            $"({t[0].ReadableId} → {t[1].ReadableId} → {t[2].ReadableId}), so this would create a cycle.",
            error.Message);
        Assert.Equal(new[] { (t[0].Id, t[1].Id), (t[1].Id, t[2].Id) }, await SavedDependenciesAsync(project));
    }

    [Fact]
    public async Task A_longer_cycle_is_refused()
    {
        var project = await GivenProjectAsync();
        var t = await CreateTasksAsync(project, 5);
        for (var i = 0; i < 4; i++)
            await AddAsync(project, t[i], t[i + 1]);

        var error = await Assert.ThrowsAsync<BadUserInputException>(() => AddAsync(project, t[4], t[0]));

        Assert.Contains(
            $"({string.Join(" → ", t.Select(x => x.ReadableId))})",
            error.Message);
        Assert.Equal(4, (await SavedDependenciesAsync(project)).Count);
    }

    [Fact]
    public async Task A_cycle_through_one_branch_of_several_is_found()
    {
        var project = await GivenProjectAsync();
        var t = await CreateTasksAsync(project, 4);
        await AddAsync(project, t[0], t[1]);
        await AddAsync(project, t[0], t[2]);
        await AddAsync(project, t[2], t[3]);

        var error = await Assert.ThrowsAsync<BadUserInputException>(() => AddAsync(project, t[3], t[0]));

        Assert.Contains($"({t[0].ReadableId} → {t[2].ReadableId} → {t[3].ReadableId})", error.Message);
    }

    [Fact]
    public async Task Chains_without_a_cycle_are_accepted()
    {
        var project = await GivenProjectAsync();
        var t = await CreateTasksAsync(project, 5);

        await AddAsync(project, t[0], t[1]);
        await AddAsync(project, t[1], t[2]);
        await AddAsync(project, t[0], t[2]);
        await AddAsync(project, t[3], t[0]);
        await AddAsync(project, t[2], t[4]);

        Assert.Equal(5, (await SavedDependenciesAsync(project)).Count);
    }

    [Fact]
    public async Task Two_requests_at_the_same_time_cannot_close_a_cycle_together()
    {
        var project = await GivenProjectAsync();
        var (a, b) = (await CreateTaskAsync(project.BoardId, "A"), await CreateTaskAsync(project.BoardId, "B"));

        var results = await Task.WhenAll(
            TryAddAsync(project, a, b),
            TryAddAsync(project, b, a));

        Assert.Single(results, r => r is null);
        Assert.Single(results, r => r is BadUserInputException);
        Assert.Single(await SavedDependenciesAsync(project));
    }

    private async Task<Exception?> TryAddAsync(TestProject project, TaskDto blocking, TaskDto blocked)
    {
        try
        {
            await AddAsync(project, blocking, blocked);
            return null;
        }
        catch (Exception ex)
        {
            return ex;
        }
    }

    private async Task<TestProject> GivenProjectAsync()
    {
        await using var db = database.CreateDbContext();
        return await TestData.CreateProjectAsync(db);
    }

    private async Task<Guid> AddMemberAsync(TestProject project, ProjectRole role)
    {
        await using var db = database.CreateDbContext();
        return await TestData.AddMemberAsync(db, project.ProjectId, role);
    }

    private async Task<TaskDto> CreateTaskAsync(Guid boardId, string title)
    {
        await using var db = database.CreateDbContext();
        return await new CreateTaskHandler(db, new TaskPositionService(db), new ProjectMembershipService(database))
            .HandleAsync(new CreateTaskInput(boardId, null, title, null, null, null, null), await TestData.OwnerOfBoardAsync(db, boardId), CancellationToken.None);
    }

    private async Task<TaskDto[]> CreateTasksAsync(TestProject project, int count)
    {
        var created = new TaskDto[count];
        for (var i = 0; i < count; i++)
            created[i] = await CreateTaskAsync(project.BoardId, $"Task {i + 1}");
        return created;
    }

    private Task<TaskDependencyPayload> AddAsync(TestProject project, TaskDto blocking, TaskDto blocked) =>
        AddAsync(blocking.Id, blocked.Id, project.MemberId);

    private async Task<TaskDependencyPayload> AddAsync(Guid blockingId, Guid blockedId, Guid userId)
    {
        await using var db = database.CreateDbContext();
        var handler = new AddTaskDependencyHandler(
            db, new TaskLookupService(db, new ProjectMembershipService(database)), new TaskDependencyCycleGuard(db));
        return await handler.HandleAsync(new AddTaskDependencyInput(blockingId, blockedId), userId, CancellationToken.None);
    }

    private async Task<List<(Guid BlockingTaskId, Guid BlockedTaskId)>> SavedDependenciesAsync(TestProject project)
    {
        await using var db = database.CreateDbContext();
        var rows = await db.taskDependencies
            .Where(d => d.BlockingTask.ProjectId == project.ProjectId)
            .OrderBy(d => d.BlockingTask.Number)
            .ThenBy(d => d.BlockedTask.Number)
            .Select(d => new { d.BlockingTaskId, d.BlockedTaskId })
            .ToListAsync();
        return rows.Select(r => (r.BlockingTaskId, r.BlockedTaskId)).ToList();
    }
}
