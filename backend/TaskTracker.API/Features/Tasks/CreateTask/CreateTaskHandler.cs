using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.Positions;

namespace TaskTracker.API.Features.Tasks.CreateTask
{
    public class CreateTaskHandler(ApplicationDbContext db)
    {
        private record ColumnInfo(Guid Id, string Name, ColumnCategory Category);
        private record BoardInfo(Guid Id, Guid ProjectId, string ProjectKey, ColumnInfo? Column);

        public async Task<TaskDto> HandleAsync(CreateTaskInput input, CancellationToken ct)
        {
            var board = await GetBoardAsync(input.BoardId, input.ColumnId, ct);

            var column = board.Column ?? throw (input.ColumnId is null
                ? new BadUserInputException("This board has no columns, so the task can't get a status.")
                : new NotFoundException($"Column '{input.ColumnId}' was not found on board '{input.BoardId}'."));

            if (input.AssigneeId is Guid assigneeId)
                await EnsureProjectMemberAsync(board, assigneeId, ct);

            var task = new TaskItem(
                board.ProjectId,
                board.Id,
                column.Id,
                input.Title,
                await NextPositionAsync(column.Id, ct),
                input.Priority);

            task.SetDescription(input.Description);
            task.SetDueDate(input.DueDate);

            if (input.AssigneeId is Guid newAssigneeId)
                task.AssignTo(newAssigneeId);

            db.Add(task);
            await db.SaveChangesAsync(ct);

            return new TaskDto(
                task.Id,
                TaskItem.ReadableId(board.ProjectKey, task.Number),
                task.Number,
                task.BoardId,
                task.Title,
                task.GetDescription(),
                column.Category,
                column.Id,
                column.Name,
                task.Priority,
                task.Assignees.Select(a => a.UserId).ToList(),
                input.DueDate,
                task.CreatedAt);
        }

        private async Task<BoardInfo> GetBoardAsync(Guid boardId, Guid? columnId, CancellationToken ct) =>
            await db.boards
                .Where(b => b.Id == boardId)
                .Select(b => new BoardInfo(
                    b.Id,
                    b.ProjectId,
                    b.Project.Key,
                    b.Columns
                        .Where(c => columnId == null || c.Id == columnId)
                        .OrderBy(c => c.Position)
                        .Select(c => new ColumnInfo(c.Id, c.Name, c.Category))
                        .FirstOrDefault()))
                .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException($"Board '{boardId}' was not found.");

        private async Task EnsureProjectMemberAsync(BoardInfo board, Guid userId, CancellationToken ct)
        {
            var isMember = await db.projectMembers
                .AnyAsync(m => m.ProjectId == board.ProjectId && m.UserId == userId, ct);

            if (!isMember)
                throw new BadUserInputException(
                    $"User '{userId}' is not a member of project {board.ProjectKey}, so they can't be assigned to this task.");
        }

        private async Task<string> NextPositionAsync(Guid columnId, CancellationToken ct)
        {
            var lastPosition = await db.Set<TaskItem>()
                .Where(t => t.ColumnId == columnId)
                .OrderByDescending(t => t.Position)
                .Select(t => t.Position)
                .FirstOrDefaultAsync(ct);

            return PositionKey.After(lastPosition);
        }
    }
}