using TaskTracker.API.Data.DataLoaders;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Features.Boards.Nodes;
using TaskTracker.API.Shared.Exceptions;

namespace TaskTracker.API.Features.Tasks.GetTasks
{
    [GraphQLName("Task")]
    public sealed class TaskNode(TaskItem task, string projectKey)
    {
        public Guid Id => task.Id;
        public int Number => task.Number;
        public string ReadableId => TaskItem.ReadableId(projectKey, task.Number);
        public string Title => task.Title;
        public string? Description => task.GetDescription();
        public TaskPriority? Priority => task.Priority;
        public DateTime? StartDate => task.StartDate;
        public DateTime? DueDate => task.DueDate;
        public Guid BoardId => task.BoardId;
        public Guid ColumnId => task.ColumnId;
        public string Position => task.Position;
        public Guid? ParentTaskId => task.ParentTaskId;

        public async Task<ColumnNode> GetColumnAsync(ColumnByIdDataLoader loader, CancellationToken ct)
            => await loader.LoadAsync(task.ColumnId, ct)
            ?? throw new NotFoundException("Couldn't find a column associated with this task");

        public async Task<ColumnCategory> GetStatusAsync(ColumnByIdDataLoader loader, CancellationToken ct)
            => (await GetColumnAsync(loader, ct)).category;

        public async Task<AssigneeNode[]> GetAssigneesAsync(AssigneesByTaskIdDataLoader loader, CancellationToken ct)
            => await loader.LoadAsync(task.Id, ct) ?? [];
    }
}