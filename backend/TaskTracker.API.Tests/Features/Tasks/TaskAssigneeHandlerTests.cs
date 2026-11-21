using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Features.Tasks;
using TaskTracker.API.Features.Tasks.AssignTask;
using TaskTracker.API.Features.Tasks.CreateTask;
using TaskTracker.API.Features.Tasks.GetTasks;
using TaskTracker.API.Features.Tasks.UnassignTask;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.Membership;
using TaskTracker.API.Shared.Positions;
using TaskTracker.API.Shared.Tasks;
using TaskTracker.API.Tests.Infrastructure;

namespace TaskTracker.API.Tests.Features.Tasks;

[Collection(nameof(PostgresCollection))]
public class TaskAssigneeHandlerTests(PostgresFixture database)
{
    [Fact]
    public async Task The_owner_assigns_a_member_and_it_is_saved()
    {
        var project = await GivenProjectAsync();
        var writerId = await GivenMemberAsync(project, ProjectRole.Writer);
        var task = await CreateTaskAsync(project);

        var assigned = await AssignAsync(task.Id, writerId, project.MemberId);

        Assert.Equal(task.Id, assigned.Id);
        Assert.Equal(new[] { writerId }, await SavedAssigneesAsync(task.Id));
    }

    [Fact]
    public async Task Several_members_can_be_assigned_to_the_same_task()
    {
        var project = await GivenProjectAsync();
        var writerId = await GivenMemberAsync(project, ProjectRole.Writer);
        var readerId = await GivenMemberAsync(project, ProjectRole.Reader);
        var task = await CreateTaskAsync(project, assigneeId: project.MemberId);

        await AssignAsync(task.Id, writerId, project.MemberId);
        await AssignAsync(task.Id, readerId, project.MemberId);

        Assert.Equal(new[] { project.MemberId, writerId, readerId }.Order(), (await SavedAssigneesAsync(task.Id)).Order());
    }

    [Fact]
    public async Task Assigning_the_same_member_again_is_safe_and_keeps_one_entry()
    {
        var project = await GivenProjectAsync();
        var task = await CreateTaskAsync(project);

        await AssignAsync(task.Id, project.MemberId, project.MemberId);
        await AssignAsync(task.Id, project.MemberId, project.MemberId);

        Assert.Equal(new[] { project.MemberId }, await SavedAssigneesAsync(task.Id));
    }

    [Fact]
    public async Task Unassigning_removes_only_that_member_and_is_safe_to_repeat()
    {
        var project = await GivenProjectAsync();
        var writerId = await GivenMemberAsync(project, ProjectRole.Writer);
        var task = await CreateTaskAsync(project, assigneeId: project.MemberId);
        await AssignAsync(task.Id, writerId, project.MemberId);

        await UnassignAsync(task.Id, writerId, project.MemberId);
        await UnassignAsync(task.Id, writerId, project.MemberId);

        Assert.Equal(new[] { project.MemberId }, await SavedAssigneesAsync(task.Id));
    }

    [Fact]
    public async Task Unassigning_the_last_assignee_leaves_the_task_without_assignees()
    {
        var project = await GivenProjectAsync();
        var task = await CreateTaskAsync(project, assigneeId: project.MemberId);

        await UnassignAsync(task.Id, project.MemberId, project.MemberId);

        Assert.Empty(await SavedAssigneesAsync(task.Id));
    }

    [Fact]
    public async Task A_member_who_left_the_project_can_still_be_unassigned()
    {
        var project = await GivenProjectAsync();
        var writerId = await GivenMemberAsync(project, ProjectRole.Writer);
        var task = await CreateTaskAsync(project, assigneeId: writerId);
        await using (var db = database.CreateDbContext())
            await db.projectMembers.Where(m => m.ProjectId == project.ProjectId && m.UserId == writerId).ExecuteDeleteAsync();

        await UnassignAsync(task.Id, writerId, project.MemberId);

        Assert.Empty(await SavedAssigneesAsync(task.Id));
    }

    [Fact]
    public async Task A_writer_can_assign_and_unassign()
    {
        var project = await GivenProjectAsync();
        var writerId = await GivenMemberAsync(project, ProjectRole.Writer);
        var task = await CreateTaskAsync(project);

        await AssignAsync(task.Id, project.MemberId, writerId);
        Assert.Equal(new[] { project.MemberId }, await SavedAssigneesAsync(task.Id));

        await UnassignAsync(task.Id, project.MemberId, writerId);
        Assert.Empty(await SavedAssigneesAsync(task.Id));
    }

    [Fact]
    public async Task A_reader_can_be_assigned_but_cannot_assign_or_unassign()
    {
        var project = await GivenProjectAsync();
        var readerId = await GivenMemberAsync(project, ProjectRole.Reader);
        var task = await CreateTaskAsync(project, assigneeId: readerId);

        var assign = await Assert.ThrowsAsync<ForbiddenException>(() => AssignAsync(task.Id, project.MemberId, readerId));
        var unassign = await Assert.ThrowsAsync<ForbiddenException>(() => UnassignAsync(task.Id, readerId, readerId));

        Assert.Equal("Only writers and owners of the project can assign tasks.", assign.Message);
        Assert.Equal("Only writers and owners of the project can unassign tasks.", unassign.Message);
        Assert.Equal(new[] { readerId }, await SavedAssigneesAsync(task.Id));
    }

    [Fact]
    public async Task A_user_outside_the_project_cannot_be_assigned_and_nothing_changes()
    {
        var project = await GivenProjectAsync();
        var outsider = await GivenProjectAsync();
        var task = await CreateTaskAsync(project, assigneeId: project.MemberId);

        var error = await Assert.ThrowsAsync<BadUserInputException>(
            () => AssignAsync(task.Id, outsider.MemberId, project.MemberId));

        Assert.Equal(
            $"User '{outsider.MemberId}' is not a member of project {project.Key}, so they can't be assigned to this task.",
            error.Message);
        Assert.Equal(new[] { project.MemberId }, await SavedAssigneesAsync(task.Id));
    }

    [Fact]
    public async Task Someone_who_is_not_a_member_gets_not_found()
    {
        var project = await GivenProjectAsync();
        var outsider = await GivenProjectAsync();
        var task = await CreateTaskAsync(project, assigneeId: project.MemberId);

        var assign = await Assert.ThrowsAsync<NotFoundException>(() => AssignAsync(task.Id, outsider.MemberId, outsider.MemberId));
        var unassign = await Assert.ThrowsAsync<NotFoundException>(() => UnassignAsync(task.Id, project.MemberId, outsider.MemberId));

        Assert.Equal($"Task '{task.Id}' was not found.", assign.Message);
        Assert.Equal($"Task '{task.Id}' was not found.", unassign.Message);
        Assert.Equal(new[] { project.MemberId }, await SavedAssigneesAsync(task.Id));
    }

    [Fact]
    public async Task An_unknown_task_comes_back_as_not_found()
    {
        var project = await GivenProjectAsync();
        var taskId = Guid.NewGuid();

        var error = await Assert.ThrowsAsync<NotFoundException>(() => AssignAsync(taskId, project.MemberId, project.MemberId));

        Assert.Equal($"Task '{taskId}' was not found.", error.Message);
    }

    [Fact]
    public async Task Two_members_assigned_at_the_same_time_are_both_saved()
    {
        var project = await GivenProjectAsync();
        var writerId = await GivenMemberAsync(project, ProjectRole.Writer);
        var readerId = await GivenMemberAsync(project, ProjectRole.Reader);
        var task = await CreateTaskAsync(project);

        await Task.WhenAll(
            AssignAsync(task.Id, writerId, project.MemberId),
            AssignAsync(task.Id, readerId, writerId));

        Assert.Equal(new[] { writerId, readerId }.Order(), (await SavedAssigneesAsync(task.Id)).Order());
    }

    [Fact]
    public async Task The_same_member_assigned_twice_at_the_same_time_is_saved_once()
    {
        var project = await GivenProjectAsync();
        var writerId = await GivenMemberAsync(project, ProjectRole.Writer);
        var task = await CreateTaskAsync(project);

        await Task.WhenAll(
            AssignAsync(task.Id, writerId, project.MemberId),
            AssignAsync(task.Id, writerId, writerId));

        Assert.Equal(new[] { writerId }, await SavedAssigneesAsync(task.Id));
    }

    private async Task<TestProject> GivenProjectAsync()
    {
        await using var db = database.CreateDbContext();
        return await TestData.CreateProjectAsync(db);
    }

    private async Task<Guid> GivenMemberAsync(TestProject project, ProjectRole role)
    {
        await using var db = database.CreateDbContext();
        return await TestData.AddMemberAsync(db, project.ProjectId, role);
    }

    private async Task<TaskDto> CreateTaskAsync(TestProject project, Guid? assigneeId = null)
    {
        await using var db = database.CreateDbContext();
        return await new CreateTaskHandler(db, new TaskPositionService(db), new ProjectMembershipService(database)).HandleAsync(
            new CreateTaskInput(project.BoardId, null, "Task", null, assigneeId, null, null),
            project.MemberId,
            CancellationToken.None);
    }

    private async Task<TaskNode> AssignAsync(Guid taskId, Guid assigneeId, Guid userId)
    {
        await using var db = database.CreateDbContext();
        var membership = new ProjectMembershipService(database);
        return await new AssignTaskHandler(db, new TaskLookupService(db, membership), membership)
            .HandleAsync(new AssignTaskInput(taskId, assigneeId), userId, CancellationToken.None);
    }

    private async Task UnassignAsync(Guid taskId, Guid assigneeId, Guid userId)
    {
        await using var db = database.CreateDbContext();
        await new UnassignTaskHandler(db, new TaskLookupService(db, new ProjectMembershipService(database)))
            .HandleAsync(new UnassignTaskInput(taskId, assigneeId), userId, CancellationToken.None);
    }

    private async Task<Guid[]> SavedAssigneesAsync(Guid taskId)
    {
        await using var db = database.CreateDbContext();
        return await db.assignees.Where(a => a.TaskId == taskId).Select(a => a.UserId).ToArrayAsync();
    }
}
