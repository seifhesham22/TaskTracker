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

            if (await db.projects.AnyAsync(x => x.Key == "TES"))
            {
                var boardsWithoutColumns = await db.boards
                    .Where(b => b.Project.Key == "TES" && !b.Columns.Any())
                    .ToListAsync();

                foreach (var existingBoard in boardsWithoutColumns)
                    AddDefaultColumns(existingBoard);

                await db.SaveChangesAsync();
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

            AddDefaultColumns(board);
            project.Boards.Add(board);

            db.Add(project);
            await db.SaveChangesAsync();
        }

        private static void AddDefaultColumns(Board board)
        {
            board.Columns.Add(new BoardColumn { Name = "Backlog", Category = Domain.Enums.ColumnCategory.Backlog, Color = "#8A90A0", Position = "V" });
            board.Columns.Add(new BoardColumn { Name = "To do", Category = Domain.Enums.ColumnCategory.ToDo, Color = "#5B8DE8", Position = "l" });
            board.Columns.Add(new BoardColumn { Name = "In progress", Category = Domain.Enums.ColumnCategory.InProgress, Color = "#E8945B", Position = "t" });
            board.Columns.Add(new BoardColumn { Name = "Done", Category = Domain.Enums.ColumnCategory.Done, Color = "#2A9D8F", Position = "x" });
        }
    }
}