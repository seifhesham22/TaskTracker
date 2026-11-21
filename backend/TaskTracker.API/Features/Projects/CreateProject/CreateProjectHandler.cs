using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Features.Projects.Nodes;
using TaskTracker.API.Shared.Exceptions;

namespace TaskTracker.API.Features.Projects.CreateProject
{
    public class CreateProjectHandler(ApplicationDbContext db)
    {
        public async Task<ProjectNode> HandleAsync(CreateProjectInput input, Guid userId, CancellationToken ct)
        {
            var project = new Project(input.Name, input.Key, input.Description);
            var keyWasGiven = !string.IsNullOrWhiteSpace(input.Key);

            if (await KeyIsTakenAsync(project.Key, ct))
            {
                if (keyWasGiven)
                    throw KeyTaken(project.Key);

                project.ChangeKey(await NextFreeKeyAsync(project.Key, ct));
            }

            project.AddOwner(userId);
            project.AddDefaultBoard();
            db.projects.Add(project);

            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException)
            {
                if (await KeyIsTakenAsync(project.Key, ct))
                    throw KeyTaken(project.Key);

                throw;
            }

            return new ProjectNode(project, ProjectRole.Owner);
        }

        private Task<bool> KeyIsTakenAsync(string key, CancellationToken ct) =>
            db.projects.IgnoreQueryFilters().AnyAsync(p => p.Key == key, ct);

        private async Task<string> NextFreeKeyAsync(string baseKey, CancellationToken ct)
        {
            var taken = await db.projects
                .IgnoreQueryFilters()
                .Where(p => p.Key.StartsWith(baseKey))
                .Select(p => p.Key)
                .ToListAsync(ct);

            var number = 2;
            while (taken.Contains($"{baseKey}{number}"))
                number++;

            return $"{baseKey}{number}";
        }

        private static BadUserInputException KeyTaken(string key) =>
            new($"The key '{key}' is already used by another project.");
    }
}