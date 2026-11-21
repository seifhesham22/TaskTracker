namespace TaskTracker.API.Features.Boards.CreateBoard
{
    public record CreateBoardInput(Guid ProjectId, string Name);
}