using TaskTracker.API.Features.Boards.Nodes;

namespace TaskTracker.API.Features.Boards.GetBoard
{
    [QueryType]
    public class GetBoardQuery
    {
        public Task<BoardNode> GetBoardAsync(
            Guid id,
            [Service] GetBoardHandler handler,
            CancellationToken cancellationToken)
            => handler.HandleAsync(id, cancellationToken);
    }
}