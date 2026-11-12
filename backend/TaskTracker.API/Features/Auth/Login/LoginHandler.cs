using Microsoft.AspNetCore.Identity;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Features.Users.Nodes;
using TaskTracker.API.Shared.Auth;
using TaskTracker.API.Shared.Exceptions;

namespace TaskTracker.API.Features.Auth.Login
{
    public class LoginHandler(UserManager<User> users, SignInManager<User> signIn, IAccessTokenService tokens)
    {
        private const string InvalidCredentials = "Invalid email or password.";

        public async Task<LoginPayload> HandleAsync(LoginInput input)
        {
            var email = input.Email.Trim();

            if (email.Length == 0 || input.Password.Length == 0)
                throw new BadUserInputException("Email and password are required.");

            var user = await users.FindByEmailAsync(email)
                ?? throw new InvalidCredentialsException(InvalidCredentials);

            var result = await signIn.CheckPasswordSignInAsync(user, input.Password, lockoutOnFailure: true);

            if (!result.Succeeded)
                throw new InvalidCredentialsException(InvalidCredentials);

            var token = tokens.Create(user.Id, user.Email!);
            return new LoginPayload(token.Token, "Bearer", token.ExpiresAt, new UserNode(user.Id, user.Email!));
        }
    }
}