namespace TaskTracker.API.Features.Projects.CreateProject
{
    public record CreateProjectInput(string Name, string? Key = null, string? Description = null);
}