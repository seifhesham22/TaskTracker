using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.Membership;
using TaskTracker.API.Shared.Positions;

namespace TaskTracker.API.Features.Tasks.CreateTask
{
    public class CreateTaskHandler(
        ApplicationDbContext db,
        ITaskPositionService positions,
        IProjectMembershipService membership)
    {
        private record ColumnInfo(Guid Id, string Name, ColumnCategory Category);
        private record BoardInfo(Guid Id, Guid ProjectId, string ProjectKey, ColumnInfo? Column);

        public async Task<TaskDto> HandleAsync(CreateTaskInput input, Guid userId, CancellationToken ct)
        {
            (await membership.GetRoleOnBoardAsync(input.BoardId, userId, ct)).EnsureCanWrite(
                $"Board '{input.BoardId}' was not found.",
                "Only writers and owners of the project can create tasks.");

            var board = await GetBoardAsync(input.BoardId, input.ColumnId, ct);

            var column = board.Column ?? throw (input.ColumnId is null
                ? new BadUserInputException("This board has no columns, so the task can't get a status.")
                : new NotFoundException($"Column '{input.ColumnId}' was not found on board '{input.BoardId}'."));

            if (input.AssigneeId is Guid assigneeId)
                await membership.EnsureCanBeAssignedAsync(board.ProjectId, board.ProjectKey, assigneeId, ct);

            if (input.ParentTaskId is Guid parentTaskId)
                await EnsureParentInProjectAsync(board, parentTaskId, userId, ct);

            var task = new TaskItem(
                board.ProjectId,
                board.Id,
                column.Id,
                input.Title,
                await positions.GetNextPositionAsync(column.Id, ct),
                input.Priority);

            task.ChangeRank(await positions.GetNextRankAsync(board.ProjectId, ct));
            task.SetDescription(input.Description);
            task.Reschedule(input.StartDate, input.DueDate);
            task.ParentTaskId = input.ParentTaskId;

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
                task.CreatedAt,
                task.ParentTaskId,
                input.StartDate);
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

        private async Task EnsureParentInProjectAsync(BoardInfo board, Guid parentTaskId, Guid userId, CancellationToken ct)
        {
            var notFound = $"Parent task '{parentTaskId}' was not found.";

            var parentProjectId = await db.Set<TaskItem>()
                .Where(t => t.Id == parentTaskId)
                .Select(t => (Guid?)t.ProjectId)
                .FirstOrDefaultAsync(ct)
                ?? throw new NotFoundException(notFound);

            if (parentProjectId == board.ProjectId)
                return;

            (await membership.GetRoleAsync(parentProjectId, userId, ct)).EnsureCanRead(notFound);

            throw new BadUserInputException(
                $"Parent task '{parentTaskId}' is in another project. A subtask must be in the same project as its parent.");
        }
    }
}