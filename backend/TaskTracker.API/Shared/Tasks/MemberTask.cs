using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Domain.Enums;

namespace TaskTracker.API.Shared.Tasks
{
    public sealed record MemberTask(TaskItem Task, ProjectRole Role);
}
