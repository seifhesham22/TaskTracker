using HotChocolate;
using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Domain.Exceptions;
using TaskTracker.API.Features.Tasks;
using TaskTracker.API.Features.Tasks.CreateTask;
using TaskTracker.API.Features.Tasks.GetTasks;
using TaskTracker.API.Features.Tasks.UpdateTask;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.Positions;
using TaskTracker.API.Tests.Infrastructure;

namespace TaskTracker.API.Tests.Features.Tasks;

[Collection(nameof(PostgresCollection))]
public class UpdateTaskHandlerTests(PostgresFixture database)
{
    private static readonly DateTimeOffset November2 = new(2026, 11, 2, 0, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset November5 = new(2026, 11, 5, 0, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task Updates_the_title()
    {
        var task = await GivenTaskAsync();

        await UpdateAsync(new UpdateTaskInput(task.Id, Title: "  New title  "));

        Assert.Equal("New title", (await SavedAsync(task.Id)).Title);
    }

    [Fact]
    public async Task Updates_the_description_and_priority()
    {
        var task = await GivenTaskAsync();

        await UpdateAsync(new UpdateTaskInput(task.Id, Description: "New description", Priority: TaskPriority.Critical));

        var saved = await SavedAsync(task.Id);
        Assert.Equal("New description", saved.GetDescription());
        Assert.Equal(TaskPriority.Critical, saved.Priority);
    }

    [Fact]
    public async Task Changes_the_start_and_due_dates()
    {
        var task = await GivenTaskAsync();

        await UpdateAsync(new UpdateTaskInput(task.Id, StartDate: November2, DueDate: November5.AddDays(3)));

        var saved = await SavedAsync(task.Id);
        Assert.Equal(November2.UtcDateTime, saved.StartDate);
        Assert.Equal(November5.AddDays(3).UtcDateTime, saved.DueDate);
    }

    [Fact]
    public async Task Returns_the_updated_task()
    {
        var task = await GivenTaskAsync();

        var updated = await UpdateAsync(new UpdateTaskInput(task.Id, Title: "Returned", Priority: TaskPriority.High));

        Assert.Equal(task.Id, updated.Id);
        Assert.Equal(task.ReadableId, updated.ReadableId);
        Assert.Equal("Returned", updated.Title);
        Assert.Equal(TaskPriority.High, updated.Priority);
        Assert.Equal("Original description", updated.Description);
    }

    [Fact]
    public async Task Leaves_the_fields_that_were_not_sent_unchanged()
    {
        var task = await GivenTaskAsync();

        await UpdateAsync(new UpdateTaskInput(task.Id, Title: "Only the title"));

        var saved = await SavedAsync(task.Id);
        Assert.Equal("Original description", saved.GetDescription());
        Assert.Equal(TaskPriority.Low, saved.Priority);
        Assert.Equal(November5.UtcDateTime, saved.DueDate);
    }

    [Fact]
    public async Task Clears_the_fields_that_were_sent_as_null()
    {
        var task = await GivenTaskAsync();

        await UpdateAsync(new UpdateTaskInput(
            task.Id,
            Description: new Optional<string?>(null),
            Priority: new Optional<TaskPriority?>(null),
            DueDate: new Optional<DateTimeOffset?>(null)));

        var saved = await SavedAsync(task.Id);
        Assert.Null(saved.GetDescription());
        Assert.Null(saved.Priority);
        Assert.Null(saved.DueDate);
        Assert.Equal("Original title", saved.Title);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public async Task Refuses_an_empty_or_missing_title_and_changes_nothing(string? title)
    {
        var task = await GivenTaskAsync();

        var error = await Assert.ThrowsAsync<DomainException>(() =>
            UpdateAsync(new UpdateTaskInput(task.Id, Title: title, Description: "Should not be saved")));

        Assert.Equal("Title cannot be empty or only spaces.", error.Message);
        await AssertUnchangedAsync(task.Id);
    }

    [Fact]
    public async Task Refuses_a_title_longer_than_200_characters_and_changes_nothing()
    {
        var task = await GivenTaskAsync();

        var error = await Assert.ThrowsAsync<DomainException>(() =>
            UpdateAsync(new UpdateTaskInput(task.Id, Title: new string('x', TaskItem.TitleMaxLength + 1))));

        Assert.Equal("Title cannot be longer than 200 characters.", error.Message);
        await AssertUnchangedAsync(task.Id);
    }

    [Fact]
    public async Task Refuses_a_due_date_before_the_start_date_and_changes_nothing()
    {
        var task = await GivenTaskAsync();

        var error = await Assert.ThrowsAsync<DomainException>(() =>
            UpdateAsync(new UpdateTaskInput(task.Id, Title: "Should not be saved", StartDate: November5, DueDate: November2)));

        Assert.Equal("The due date cannot be before the start date.", error.Message);
        await AssertUnchangedAsync(task.Id);
    }

    [Fact]
    public async Task Refuses_a_new_due_date_before_the_saved_start_date()
    {
        var task = await GivenTaskAsync();
        await UpdateAsync(new UpdateTaskInput(task.Id, StartDate: November5));

        var error = await Assert.ThrowsAsync<DomainException>(() =>
            UpdateAsync(new UpdateTaskInput(task.Id, DueDate: November2)));

        Assert.Equal("The due date cannot be before the start date.", error.Message);
        Assert.Equal(November5.UtcDateTime, (await SavedAsync(task.Id)).DueDate);
    }

    [Fact]
    public async Task Refuses_a_new_start_date_after_the_saved_due_date_and_changes_nothing()
    {
        var task = await GivenTaskAsync();

        var error = await Assert.ThrowsAsync<DomainException>(() =>
            UpdateAsync(new UpdateTaskInput(task.Id, StartDate: November5.AddDays(1))));

        Assert.Equal("The due date cannot be before the start date.", error.Message);
        await AssertUnchangedAsync(task.Id);
    }

    [Fact]
    public async Task Returns_not_found_for_a_task_that_does_not_exist()
    {
        var taskId = Guid.NewGuid();

        var error = await Assert.ThrowsAsync<NotFoundException>(() => UpdateAsync(new UpdateTaskInput(taskId, Title: "Nobody")));

        Assert.Equal($"Task '{taskId}' was not found.", error.Message);
    }

    private async Task<TaskDto> GivenTaskAsync()
    {
        await using var db = database.CreateDbContext();
        var project = await TestData.CreateProjectAsync(db);
        return await new CreateTaskHandler(db, new TaskPositionService(db)).HandleAsync(
            new CreateTaskInput(project.BoardId, null, "Original title", "Original description", null, TaskPriority.Low, November5),
            CancellationToken.None);
    }

    private async Task<TaskNode> UpdateAsync(UpdateTaskInput input)
    {
        await using var db = database.CreateDbContext();
        return await new UpdateTaskHandler(db).HandleAsync(input, CancellationToken.None);
    }

    private async Task<TaskItem> SavedAsync(Guid taskId)
    {
        await using var db = database.CreateDbContext();
        return await db.Set<TaskItem>().AsNoTracking().SingleAsync(t => t.Id == taskId);
    }

    private async Task AssertUnchangedAsync(Guid taskId)
    {
        var saved = await SavedAsync(taskId);
        Assert.Equal("Original title", saved.Title);
        Assert.Equal("Original description", saved.GetDescription());
        Assert.Equal(TaskPriority.Low, saved.Priority);
        Assert.Null(saved.StartDate);
        Assert.Equal(November5.UtcDateTime, saved.DueDate);
    }
}
