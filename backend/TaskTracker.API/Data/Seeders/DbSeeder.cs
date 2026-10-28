using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography.X509Certificates;
using TaskTracker.API.Domain.Entities;

namespace TaskTracker.API.Data.Seeders
{
    public static class DbSeeder
    {
        private record SeedUser(string Email, string Password, string Role);
        private static readonly SeedUser[] users =
        {
            new("admin@local.test", "Dev@123456", "Admin"),
            new("user1@local.test", "Dev@123456", "Member"),
            new("user2@local.test", "Dev@123456", "Member"),
            new("user3@local.test", "Dev@123456", "Member"),
            new("user4@local.test", "Dev@123456", "Member"),
        };

        public static async Task SeedAsync(IServiceProvider services)
        {
            using var scope = services.CreateScope();

            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.Database.MigrateAsync();

            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
            var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();

            var roles = new[] { "Admin", "Member" };

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

        public static async Task SeedProjectAsync(IServiceProvider services)
        {
            using var scope = services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var emails = users.Select(u => u.Email).ToArray();

            var seededUsers = await db.Users
                .Where(u => emails.Contains(u.Email!))
                .ToDictionaryAsync(u => u.Email!);

            if (seededUsers.Count != users.Length)
                throw new InvalidOperationException("Seed users are missing. Run SeedAsync first.");

            var admin = seededUsers["admin@local.test"];
            var user1 = seededUsers["user1@local.test"];
            var user2 = seededUsers["user2@local.test"];
            var user3 = seededUsers["user3@local.test"];
            var user4 = seededUsers["user4@local.test"];

            if (await db.projects.FirstOrDefaultAsync(x => x.Key == "TES") is not null)
            {
                return;
            }

            var project = new Project
            {
                Name = "Test Project",
                Key = "TES",
                Description = "This is the test project description field",
            };

            var projectMembers = new List<ProjectMember>()
            {
                new ProjectMember
                {
                    ProjectId = project.Id,
                    UserId = admin.Id,
                    JoinedAt = DateTime.UtcNow,
                    ProjectRole = Domain.Enums.ProjectRole.Owner
                },
                new ProjectMember
                {
                    ProjectId = project.Id,
                    UserId = user1.Id,
                    JoinedAt = DateTime.UtcNow,
                    ProjectRole = Domain.Enums.ProjectRole.Owner
                },
                new ProjectMember
                {
                    ProjectId = project.Id,
                    UserId = user2.Id,
                    JoinedAt = DateTime.UtcNow,
                    ProjectRole = Domain.Enums.ProjectRole.Owner
                },
                new ProjectMember
                {
                    ProjectId = project.Id,
                    UserId = user3.Id,
                    JoinedAt = DateTime.UtcNow,
                    ProjectRole = Domain.Enums.ProjectRole.Owner
                },
                new ProjectMember
                {
                    ProjectId = project.Id,
                    UserId = user4.Id,
                    JoinedAt = DateTime.UtcNow,
                    ProjectRole = Domain.Enums.ProjectRole.Owner
                },
            };

            project.ProjectMembers = projectMembers;

            var board = new Board
            {
                Project = project,
                ProjectId = project.Id,
                Name = "Test Board",
                IsArchived = false,
            };

            project.Boards.Add(board);

            db.Add(project);
            await db.SaveChangesAsync();
        }
    }
}