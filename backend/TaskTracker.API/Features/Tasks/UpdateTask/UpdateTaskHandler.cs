using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Features.Tasks.GetTasks;
using TaskTracker.API.Shared.Exceptions;

namespace TaskTracker.API.Features.Tasks.UpdateTask
{
    public class UpdateTaskHandler(ApplicationDbContext db)
    {
        public async Task<TaskNode> HandleAsync(UpdateTaskInput input, CancellationToken ct)
        {
            var task = await db.Set<TaskItem>()
                .Include(t => t.Project)
                .FirstOrDefaultAsync(t => t.Id == input.TaskId, ct)
                ?? throw new NotFoundException($"Task '{input.TaskId}' was not found.");

            if (input.Title.HasValue)
                task.Rename(input.Title.Value ?? string.Empty);

            if (input.Description.HasValue)
                task.SetDescription(input.Description.Value);

            if (input.Priority.HasValue)
                task.Priority = input.Priority.Value;

            if (input.StartDate.HasValue && input.DueDate.HasValue)
                task.Reschedule(input.StartDate.Value, input.DueDate.Value);
            else if (input.StartDate.HasValue)
                task.SetStartDate(input.StartDate.Value);
            else if (input.DueDate.HasValue)
                task.SetDueDate(input.DueDate.Value);

            await db.SaveChangesAsync(ct);

            return new TaskNode(task, task.Project.Key);
        }
    }
}