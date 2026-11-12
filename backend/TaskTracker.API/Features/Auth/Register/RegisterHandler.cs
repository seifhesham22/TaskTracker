using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Features.Users.Nodes;
using TaskTracker.API.Shared.Exceptions;

namespace TaskTracker.API.Features.Auth.Register
{
    public class RegisterHandler(UserManager<User> users)
    {
        private static readonly EmailAddressAttribute EmailFormat = new();

        public async Task<UserNode> HandleAsync(RegisterInput input)
        {
            var email = input.Email.Trim();

            if (email.Length == 0)
                throw new BadUserInputException("Email is required.");

            if (!EmailFormat.IsValid(email))
                throw new BadUserInputException($"'{email}' is not a valid email address.");

            var user = new User(email);
            var result = await users.CreateAsync(user, input.Password);

            if (!result.Succeeded)
                throw ToError(email, result.Errors.ToList());

            return new UserNode(user.Id, email);
        }

        private static BadUserInputException ToError(string email, List<IdentityError> errors)
        {
            if (errors.Any(e => e.Code is nameof(IdentityErrorDescriber.DuplicateEmail) or nameof(IdentityErrorDescriber.DuplicateUserName)))
                return new BadUserInputException($"An account with the email '{email}' already exists.");

            if (errors.Any(e => e.Code is nameof(IdentityErrorDescriber.InvalidEmail) or nameof(IdentityErrorDescriber.InvalidUserName)))
                return new BadUserInputException($"'{email}' is not a valid email address.");

            return new BadUserInputException(string.Join(" ", errors.Select(e => e.Description)));
        }
    }
}