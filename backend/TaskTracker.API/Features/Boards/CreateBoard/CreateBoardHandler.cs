using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Features.Boards.Nodes;
using TaskTracker.API.Shared.Concurrency;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.Membership;
using TaskTracker.API.Shared.Positions;

namespace TaskTracker.API.Features.Boards.CreateBoard
{
    public class CreateBoardHandler(ApplicationDbContext db, IProjectMembershipService membership)
    {
        public Task<BoardNode> HandleAsync(CreateBoardInput input, Guid userId, CancellationToken ct) =>
            db.RetryOnConflictAsync(() => CreateAsync(input, userId, ct));

        private async Task<BoardNode> CreateAsync(CreateBoardInput input, Guid userId, CancellationToken ct)
        {
            var project = await db.projects.FirstOrDefaultAsync(p => p.Id == input.ProjectId, ct);
            var role = project is null ? null : await membership.GetRoleAsync(input.ProjectId, userId, ct);

            role.EnsureCanRead($"Project '{input.ProjectId}' was not found.") // we make this check here becasue it throws NotFound, so that a user who is not authorized doesnt get a leaked message "Only owner can edit".
                .EnsureIsOwner("Only the owner of the project can create boards.");

            var name = Board.ValidName(input.Name);
            var lowerName = name.ToLower();

            if (await db.boards.AnyAsync(b => b.ProjectId == input.ProjectId && !b.IsDeleted && b.Name.ToLower() == lowerName, ct))
                throw new BadUserInputException($"A board named '{name}' already exists in this project.");

            var lastPosition = await db.boards
                .Where(b => b.ProjectId == input.ProjectId)
                .OrderByDescending(b => b.Position)
                .Select(b => b.Position)
                .FirstOrDefaultAsync(ct);

            var board = project!.AddBoard(name, PositionKey.After(lastPosition));
            project.Touch();
            await db.SaveChangesAsync(ct);

            return new BoardNode(board.Id, board.ProjectId, board.Name);
        }
    }
}