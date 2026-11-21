using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Features.Projects.GetWorkload;
using TaskTracker.API.Features.Projects.Nodes;
using TaskTracker.API.Features.Projects.RemoveProjectMember;
using TaskTracker.API.Features.Tasks;
using TaskTracker.API.Features.Tasks.AssignTask;
using TaskTracker.API.Features.Tasks.CreateTask;
using TaskTracker.API.Features.Tasks.MoveTask;
using TaskTracker.API.Features.Tasks.UnassignTask;
using TaskTracker.API.Shared.Completion;
using TaskTracker.API.Shared.Dependencies;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.Membership;
using TaskTracker.API.Shared.Positions;
using TaskTracker.API.Shared.Tasks;
using TaskTracker.API.Tests.Infrastructure;

namespace TaskTracker.API.Tests.Features.Projects;

[Collection(nameof(PostgresCollection))]
public class GetWorkloadHandlerTests(PostgresFixture database)
{
    [Fact]
    public async Task Counts_each_members_open_tasks_most_loaded_first()
    {
        var project = await GivenProjectAsync();
        var writerId = await GivenMemberAsync(project, ProjectRole.Writer);
        var readerId = await GivenMemberAsync(project, ProjectRole.Reader);
        var first = await CreateTaskAsync(project, "First", assigneeId: writerId);
        var second = await CreateTaskAsync(project, "Second", assigneeId: writerId);
        var third = await CreateTaskAsync(project, "Third", assigneeId: project.MemberId);
        var nobodys = await CreateTaskAsync(project, "Nobody's");

        var workload = await WorkloadAsync(project);

        Assert.Equal(new[] { writerId, project.MemberId, readerId }, workload.Members.Select(m => m.UserId));
        Assert.Equal(new[] { 2, 1, 0 }, workload.Members.Select(m => m.OpenTaskCount));
        Assert.Equal(new[] { first.Id, second.Id }, workload.Members[0].OpenTasks.Select(t => t.Id));
        Assert.Equal(new[] { third.Id }, workload.Members[1].OpenTasks.Select(t => t.Id));
        Assert.Empty(workload.Members[2].OpenTasks);
        Assert.Equal(ProjectRole.Writer, workload.Members[0].Role);
        Assert.Equal(nobodys.Id, Assert.Single(workload.Unassigned).Id);
        Assert.Equal(1.0, workload.AverageOpenTasks);
    }

    [Fact]
    public async Task Done_and_cancelled_tasks_are_not_counted()
    {
        var project = await GivenProjectAsync();
        var cancelledColumn = await AddCancelledColumnAsync(project);
        var writerId = await GivenMemberAsync(project, ProjectRole.Writer);
        var backlog = await CreateTaskAsync(project, "Backlog", assigneeId: writerId);
        var inProgress = await CreateTaskAsync(project, "In progress", project.InProgressColumnId, writerId);
        await CreateTaskAsync(project, "Done", project.DoneColumnId, writerId);
        await CreateTaskAsync(project, "Cancelled", cancelledColumn, writerId);
        await CreateTaskAsync(project, "Done and nobody's", project.DoneColumnId);

        var workload = await WorkloadAsync(project);

        var writer = workload.Members.Single(m => m.UserId == writerId);
        Assert.Equal(2, writer.OpenTaskCount);
        Assert.Equal(new[] { backlog.Id, inProgress.Id }, writer.OpenTasks.Select(t => t.Id));
        Assert.Empty(workload.Unassigned);
    }

    [Fact]
    public async Task A_task_with_several_assignees_counts_for_each_of_them()
    {
        var project = await GivenProjectAsync();
        var writerId = await GivenMemberAsync(project, ProjectRole.Writer);
        var shared = await CreateTaskAsync(project, "Shared", assigneeId: writerId);
        await AssignAsync(project, shared.Id, project.MemberId);

        var workload = await WorkloadAsync(project);

        Assert.All(workload.Members, m => Assert.Equal(shared.Id, Assert.Single(m.OpenTasks).Id));
        Assert.Empty(workload.Unassigned);
    }

    [Fact]
    public async Task Someone_who_left_is_not_listed_and_their_open_tasks_become_unassigned()
    {
        var project = await GivenProjectAsync();
        var leaverId = await GivenMemberAsync(project, ProjectRole.Writer);
        var onlyTheirs = await CreateTaskAsync(project, "Only theirs", assigneeId: leaverId);
        var shared = await CreateTaskAsync(project, "Shared", assigneeId: leaverId);
        await AssignAsync(project, shared.Id, project.MemberId);
        await using (var db = database.CreateDbContext())
            await db.projectMembers.Where(m => m.ProjectId == project.ProjectId && m.UserId == leaverId).ExecuteDeleteAsync();

        var workload = await WorkloadAsync(project);

        var owner = Assert.Single(workload.Members);
        Assert.Equal(project.MemberId, owner.UserId);
        Assert.Equal(shared.Id, Assert.Single(owner.OpenTasks).Id);
        Assert.Equal(onlyTheirs.Id, Assert.Single(workload.Unassigned).Id);
    }

    [Fact]
    public async Task Deleted_tasks_tasks_on_deleted_boards_and_other_projects_are_not_counted()
    {
        var project = await GivenProjectAsync();
        var other = await GivenProjectAsync();
        var writerId = await GivenMemberAsync(project, ProjectRole.Writer);
        await using (var db = database.CreateDbContext())
            await TestData.AddMemberAsync(db, other.ProjectId, ProjectRole.Writer, writerId);
        Guid deletedBoardId, deletedBoardColumn;
        await using (var db = database.CreateDbContext())
            (deletedBoardId, deletedBoardColumn) = await TestData.CreateBoardWithColumnAsync(db, project.ProjectId);
        var kept = await CreateTaskAsync(project, "Kept", assigneeId: writerId);
        var deleted = await CreateTaskAsync(project, "Deleted", assigneeId: writerId);
        await CreateTaskAsync(project, "On a deleted board", deletedBoardColumn, writerId, deletedBoardId);
        await CreateTaskAsync(other, "Other project", assigneeId: writerId);
        await using (var db = database.CreateDbContext())
        {
            await db.Set<TaskItem>().Where(t => t.Id == deleted.Id).ExecuteUpdateAsync(s => s.SetProperty(t => t.IsDeleted, true));
            await db.boards.Where(b => b.Id == deletedBoardId).ExecuteUpdateAsync(s => s.SetProperty(b => b.IsDeleted, true));
        }

        var workload = await WorkloadAsync(project);

        var writer = workload.Members.Single(m => m.UserId == writerId);
        Assert.Equal(kept.Id, Assert.Single(writer.OpenTasks).Id);
        Assert.Empty(workload.Unassigned);
    }

    [Fact]
    public async Task Reassignment_status_and_membership_changes_show_up_at_once()
    {
        var project = await GivenProjectAsync();
        var writerId = await GivenMemberAsync(project, ProjectRole.Writer);
        var readerId = await GivenMemberAsync(project, ProjectRole.Reader);
        var task = await CreateTaskAsync(project, "Moving around", project.InProgressColumnId);
        Assert.Single((await WorkloadAsync(project)).Unassigned);

        await AssignAsync(project, task.Id, writerId);
        Assert.Equal(1, await OpenCountAsync(project, writerId));
        Assert.Empty((await WorkloadAsync(project)).Unassigned);

        await AssignAsync(project, task.Id, readerId);
        await UnassignAsync(project, task.Id, writerId);
        Assert.Equal(0, await OpenCountAsync(project, writerId));
        Assert.Equal(1, await OpenCountAsync(project, readerId));

        await MoveAsync(project, task.Id, project.DoneColumnId);
        Assert.Equal(0, await OpenCountAsync(project, readerId));

        await MoveAsync(project, task.Id, project.InProgressColumnId);
        Assert.Equal(1, await OpenCountAsync(project, readerId));

        await RemoveMemberAsync(project, readerId);
        var workload = await WorkloadAsync(project);
        Assert.DoesNotContain(workload.Members, m => m.UserId == readerId);
        Assert.Equal(task.Id, Assert.Single(workload.Unassigned).Id);
    }

    [Fact]
    public async Task A_project_without_open_tasks_has_zero_for_everyone()
    {
        var project = await GivenProjectAsync();
        await GivenMemberAsync(project, ProjectRole.Writer);

        var workload = await WorkloadAsync(project);

        Assert.All(workload.Members, m => Assert.Equal(0, m.OpenTaskCount));
        Assert.Equal(0, workload.AverageOpenTasks);
        Assert.Empty(workload.Unassigned);
    }

    [Theory]
    [InlineData(ProjectRole.Writer)]
    [InlineData(ProjectRole.Reader)]
    public async Task Only_the_owner_can_see_the_workload(ProjectRole role)
    {
        var project = await GivenProjectAsync();
        var memberId = await GivenMemberAsync(project, role);

        var error = await Assert.ThrowsAsync<ForbiddenException>(() => WorkloadAsync(project, memberId));

        Assert.Equal("Only the owner of the project can see the workload.", error.Message);
    }

    [Fact]
    public async Task Someone_who_is_not_a_member_gets_not_found()
    {
        var project = await GivenProjectAsync();
        var other = await GivenProjectAsync();

        var error = await Assert.ThrowsAsync<NotFoundException>(() => WorkloadAsync(project, other.MemberId));

        Assert.Equal($"Project '{project.ProjectId}' was not found.", error.Message);
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

    private async Task<Guid> AddCancelledColumnAsync(TestProject project)
    {
        await using var db = database.CreateDbContext();
        var column = new BoardColumn
        {
            BoardId = project.BoardId,
            Name = "Cancelled",
            Category = ColumnCategory.Cancelled,
            Color = "#8A90A0",
            Position = "z"
        };
        db.boardColumns.Add(column);
        await db.SaveChangesAsync();
        return column.Id;
    }

    private async Task<TaskDto> CreateTaskAsync(
        TestProject project, string title, Guid? columnId = null, Guid? assigneeId = null, Guid? boardId = null)
    {
        await using var db = database.CreateDbContext();
        return await new CreateTaskHandler(db, new TaskPositionService(db), new ProjectMembershipService(database)).HandleAsync(
            new CreateTaskInput(boardId ?? project.BoardId, columnId, title, null, assigneeId, null, null),
            project.MemberId,
            CancellationToken.None);
    }

    private async Task AssignAsync(TestProject project, Guid taskId, Guid assigneeId)
    {
        await using var db = database.CreateDbContext();
        var membership = new ProjectMembershipService(database);
        await new AssignTaskHandler(db, new TaskLookupService(db, membership), membership)
            .HandleAsync(new AssignTaskInput(taskId, assigneeId), project.MemberId, CancellationToken.None);
    }

    private async Task UnassignAsync(TestProject project, Guid taskId, Guid assigneeId)
    {
        await using var db = database.CreateDbContext();
        await new UnassignTaskHandler(db, new TaskLookupService(db, new ProjectMembershipService(database)))
            .HandleAsync(new UnassignTaskInput(taskId, assigneeId), project.MemberId, CancellationToken.None);
    }

    private async Task MoveAsync(TestProject project, Guid taskId, Guid columnId)
    {
        await using var db = database.CreateDbContext();
        await new MoveTaskHandler(
                db,
                new TaskLookupService(db, new ProjectMembershipService(database)),
                new TaskPositionService(db),
                new TaskCompletionGuard(db),
                new TaskBlockerGuard(db))
            .HandleAsync(new MoveTaskInput(taskId, columnId), project.MemberId, CancellationToken.None);
    }

    private async Task RemoveMemberAsync(TestProject project, Guid memberId)
    {
        await using var db = database.CreateDbContext();
        await new RemoveProjectMemberHandler(db, new ProjectMembershipService(database))
            .HandleAsync(new RemoveProjectMemberInput(project.ProjectId, memberId), project.MemberId, CancellationToken.None);
    }

    private Task<ProjectWorkloadNode> WorkloadAsync(TestProject project, Guid? userId = null) =>
        new GetWorkloadHandler(database, new ProjectMembershipService(database))
            .HandleAsync(project.ProjectId, userId ?? project.MemberId, CancellationToken.None);

    private async Task<int> OpenCountAsync(TestProject project, Guid userId) =>
        (await WorkloadAsync(project)).Members.Single(m => m.UserId == userId).OpenTaskCount;
}
