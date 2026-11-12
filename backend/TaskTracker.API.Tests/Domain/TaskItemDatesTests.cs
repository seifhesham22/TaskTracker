using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Domain.Exceptions;

namespace TaskTracker.API.Tests.Domain;

public class TaskItemDatesTests
{
    private static readonly DateTimeOffset November2 = new(2026, 11, 2, 0, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset November5 = new(2026, 11, 5, 0, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset November10 = new(2026, 11, 10, 0, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset November12 = new(2026, 11, 12, 0, 0, 0, TimeSpan.Zero);

    [Fact]
    public void A_due_date_before_the_saved_start_date_is_refused_and_nothing_changes()
    {
        var task = NewTask();
        task.Reschedule(November5, November10);

        var error = Assert.Throws<DomainException>(() => task.SetDueDate(November2));

        Assert.Equal("The due date cannot be before the start date.", error.Message);
        Assert.Equal(November5.UtcDateTime, task.StartDate);
        Assert.Equal(November10.UtcDateTime, task.DueDate);
    }

    [Fact]
    public void A_start_date_after_the_saved_due_date_is_refused_and_nothing_changes()
    {
        var task = NewTask();
        task.Reschedule(November2, November5);

        var error = Assert.Throws<DomainException>(() => task.SetStartDate(November10));

        Assert.Equal("The due date cannot be before the start date.", error.Message);
        Assert.Equal(November2.UtcDateTime, task.StartDate);
        Assert.Equal(November5.UtcDateTime, task.DueDate);
    }

    [Fact]
    public void Changing_one_date_keeps_the_other_one()
    {
        var task = NewTask();
        task.Reschedule(November2, November10);

        task.SetDueDate(November12);

        Assert.Equal(November2.UtcDateTime, task.StartDate);
        Assert.Equal(November12.UtcDateTime, task.DueDate);
    }

    [Fact]
    public void Rescheduling_can_move_both_dates_past_the_old_due_date()
    {
        var task = NewTask();
        task.Reschedule(November2, November5);

        task.Reschedule(November10, November12);

        Assert.Equal(November10.UtcDateTime, task.StartDate);
        Assert.Equal(November12.UtcDateTime, task.DueDate);
    }

    [Fact]
    public void Clearing_the_start_date_allows_any_due_date()
    {
        var task = NewTask();
        task.Reschedule(November5, November10);

        task.SetStartDate(null);
        task.SetDueDate(November2);

        Assert.Null(task.StartDate);
        Assert.Equal(November2.UtcDateTime, task.DueDate);
    }

    private static TaskItem NewTask() => new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "A task", "V");
}
