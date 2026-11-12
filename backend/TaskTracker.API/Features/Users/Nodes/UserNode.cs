namespace TaskTracker.API.Features.Users.Nodes
{
    [GraphQLName("User")]
    public sealed record UserNode(Guid Id, string Email);
}