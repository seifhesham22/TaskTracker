using TaskTracker.API.Features.Users.Nodes;

namespace TaskTracker.API.Features.Auth.Register
{
    [MutationType]
    public class RegisterMutation
    {
        public Task<UserNode> RegisterAsync(
            RegisterInput input,
            [Service] RegisterHandler handler)
            => handler.HandleAsync(input);
    }
}
