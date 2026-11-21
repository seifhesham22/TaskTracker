using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Features.Tasks;
using TaskTracker.API.Features.Tasks.CreateTask;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.Membership;
using TaskTracker.API.Shared.Positions;
using TaskTracker.API.Shared.Tasks;
using TaskTracker.API.Tests.Infrastructure;

namespace TaskTracker.API.Tests.Shared;

[Collection(nameof(PostgresCollection))]
public class TaskLookupServiceTests(PostgresFixture database)
{
    [Theory]
    [InlineData(ProjectRole.Reader)]
    [InlineData(ProjectRole.Writer)]
    public async Task Gives_a_member_the_task_with_its_project_and_their_role(ProjectRole role)
    {
        var project = await GivenProjectAsync();
        var task = await CreateTaskAsync(project);
        Guid memberId;
        await using (var db = database.CreateDbContext())
            memberId = await TestData.AddMemberAsync(db, project.ProjectId, role);

        var (found, foundRole) = await LookUpAsync(task.Id, memberId);

        Assert.Equal(task.Id, found.Id);
        Assert.Equal(project.Key, found.Project.Key);
        Assert.Equal(role, foundRole);
    }

    [Fact]
    public async Task Someone_who_is_not_a_member_gets_the_same_not_found_as_for_an_unknown_task()
    {
        var project = await GivenProjectAsync();
        var other = await GivenProjectAsync();
        var task = await CreateTaskAsync(project);
        var unknownId = Guid.NewGuid();

        var hidden = await Assert.ThrowsAsync<NotFoundException>(() => LookUpAsync(task.Id, other.MemberId));
        var unknown = await Assert.ThrowsAsync<NotFoundException>(() => LookUpAsync(unknownId, project.MemberId));

        Assert.Equal($"Task '{task.Id}' was not found.", hidden.Message);
        Assert.Equal($"Task '{unknownId}' was not found.", unknown.Message);
    }

    [Fact]
    public async Task A_deleted_task_is_not_found_even_for_its_owner()
    {
        var project = await GivenProjectAsync();
        var task = await CreateTaskAsync(project);
        await using (var db = database.CreateDbContext())
            await db.Set<TaskItem>().Where(t => t.Id == task.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.IsDeleted, true));

        var error = await Assert.ThrowsAsync<NotFoundException>(() => LookUpAsync(task.Id, project.MemberId));

        Assert.Equal($"Task '{task.Id}' was not found.", error.Message);
    }

    private async Task<TestProject> GivenProjectAsync()
    {
        await using var db = database.CreateDbContext();
        return await TestData.CreateProjectAsync(db);
    }

    private async Task<TaskDto> CreateTaskAsync(TestProject project)
    {
        await using var db = database.CreateDbContext();
        return await new CreateTaskHandler(db, new TaskPositionService(db), new ProjectMembershipService(database))
            .HandleAsync(new CreateTaskInput(project.BoardId, null, "Task", null, null, null, null), project.MemberId, CancellationToken.None);
    }

    private async Task<MemberTask> LookUpAsync(Guid taskId, Guid userId)
    {
        await using var db = database.CreateDbContext();
        return await new TaskLookupService(db, new ProjectMembershipService(database)).GetAsync(taskId, userId, CancellationToken.None);
    }
}
