using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Domain.Entities;

namespace TaskTracker.API.Data.Seeders
{
    public static class DbSeeder
    {
        public static async Task SeedAsync(IServiceProvider services)
        {
            using var scope = services.CreateScope();

            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.Database.MigrateAsync();

            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
            var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();

            var roles = new[] { "Admin", "Member" };

            var users = new[]
            {
                new { Email = "admin@local.test",  Password = "Dev@123456", Role = "Admin"  },
                new { Email = "user1@local.test",  Password = "Dev@123456", Role = "Member" },
                new { Email = "user2@local.test",  Password = "Dev@123456", Role = "Member" }
            };

            foreach (var roleName in roles)
            {
                if (await roleManager.RoleExistsAsync(roleName))
                    continue;

                var roleResult = await roleManager.CreateAsync(new IdentityRole<Guid>(roleName));
                if (!roleResult.Succeeded)
                    throw new Exception($"Failed to seed role {roleName}: " +
                        string.Join(", ", roleResult.Errors.Select(e => e.Description)));
            }

            foreach (var u in users)
            {
                if (await userManager.FindByEmailAsync(u.Email) is not null)
                    continue;

                var newUser = new User
                {
                    Email = u.Email,
                    UserName = u.Email,
                    EmailConfirmed = true
                };

                var createResult = await userManager.CreateAsync(newUser, u.Password);
                if (!createResult.Succeeded)
                    throw new Exception($"Failed to seed user {u.Email}: " +
                        string.Join(", ", createResult.Errors.Select(e => e.Description)));

                var roleResult = await userManager.AddToRoleAsync(newUser, u.Role);
                if (!roleResult.Succeeded)
                    throw new Exception($"Failed to add {u.Email} to role {u.Role}: " +
                        string.Join(", ", roleResult.Errors.Select(e => e.Description)));
            }
        }
    }
}