namespace TaskTracker.API.Features.Auth.Login
{
    [MutationType]
    public class LoginMutation
    {
        public Task<LoginPayload> LoginAsync(
            LoginInput input,
            [Service] LoginHandler handler)
            => handler.HandleAsync(input);
    }
}