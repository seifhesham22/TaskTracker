using TaskTracker.API.Domain.Entities;

namespace TaskTracker.API.Tests.Domain;

public class TaskItemAssigneeTests
{
    private static TaskItem NewTask() => new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "Task", "V");

    [Fact]
    public void Assigning_adds_the_person_to_the_assignees()
    {
        var task = NewTask();
        var userId = Guid.NewGuid();

        Assert.True(task.AssignTo(userId));

        Assert.Equal(userId, Assert.Single(task.Assignees).UserId);
    }

    [Fact]
    public void Several_people_can_work_on_the_same_task()
    {
        var task = NewTask();
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();

        task.AssignTo(first);
        task.AssignTo(second);

        Assert.Equal(new[] { first, second }, task.Assignees.Select(a => a.UserId));
    }

    [Fact]
    public void Assigning_the_same_person_again_changes_nothing()
    {
        var task = NewTask();
        var userId = Guid.NewGuid();
        task.AssignTo(userId);

        Assert.False(task.AssignTo(userId));

        Assert.Single(task.Assignees);
    }

    [Fact]
    public void Unassigning_removes_only_that_person()
    {
        var task = NewTask();
        var leaving = Guid.NewGuid();
        var staying = Guid.NewGuid();
        task.AssignTo(leaving);
        task.AssignTo(staying);

        Assert.True(task.Unassign(leaving));

        Assert.Equal(staying, Assert.Single(task.Assignees).UserId);
    }

    [Fact]
    public void Unassigning_someone_who_is_not_assigned_changes_nothing()
    {
        var task = NewTask();
        var assigned = Guid.NewGuid();
        task.AssignTo(assigned);

        Assert.False(task.Unassign(Guid.NewGuid()));

        Assert.Equal(assigned, Assert.Single(task.Assignees).UserId);
    }

    [Fact]
    public void Unassigning_the_last_assignee_leaves_the_task_without_assignees()
    {
        var task = NewTask();
        var userId = Guid.NewGuid();
        task.AssignTo(userId);

        task.Unassign(userId);

        Assert.Empty(task.Assignees);
    }
}
