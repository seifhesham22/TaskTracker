using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Features.Projects.Nodes;
using TaskTracker.API.Features.Tasks.GetTasks;
using TaskTracker.API.Shared.Membership;

namespace TaskTracker.API.Features.Projects.GetWorkload
{
    public class GetWorkloadHandler(IDbContextFactory<ApplicationDbContext> _db, IProjectMembershipService membership)
    {
        public async Task<ProjectWorkloadNode> HandleAsync(Guid projectId, Guid userId, CancellationToken ct)
        {
            (await membership.GetRoleAsync(projectId, userId, ct))
                .EnsureCanRead($"Project '{projectId}' was not found.")
                .EnsureIsOwner("Only the owner of the project can see the workload.");

            await using var db = await _db.CreateDbContextAsync(ct);

            var projectKey = await db.projects
                .Where(p => p.Id == projectId)
                .Select(p => p.Key)
                .SingleAsync(ct);

            var members = await db.projectMembers
                .AsNoTracking()
                .Where(m => m.ProjectId == projectId)
                .Select(m => new { m.UserId, UserName = m.User.UserName!, m.ProjectRole })
                .ToListAsync(ct);

            var openTasks = await db.Set<TaskItem>()
                .AsNoTracking()
                .Where(t => t.ProjectId == projectId
                    && !t.Board.IsDeleted
                    && t.Column.Category != ColumnCategory.Done
                    && t.Column.Category != ColumnCategory.Cancelled)
                .OrderBy(t => t.Rank)
                .ThenBy(t => t.Id)
                .Select(t => new { Task = t, AssigneeIds = t.Assignees.Select(a => a.UserId).ToList() })
                .ToListAsync(ct);

            var memberIds = members.Select(m => m.UserId).ToHashSet();

            var workloads = members
                .Select(m =>
                {
                    var tasks = openTasks
                        .Where(t => t.AssigneeIds.Contains(m.UserId))
                        .Select(t => new TaskNode(t.Task, projectKey))
                        .ToList();
                    return new MemberWorkloadNode(m.UserId, m.UserName, m.ProjectRole, tasks.Count, tasks);
                })
                .OrderByDescending(w => w.OpenTaskCount)
                .ThenBy(w => w.UserName, StringComparer.Ordinal)
                .ToList();

            var unassigned = openTasks
                .Where(t => !t.AssigneeIds.Any(memberIds.Contains))
                .Select(t => new TaskNode(t.Task, projectKey))
                .ToList();

            var average = workloads.Count == 0 ? 0 : Math.Round(workloads.Average(w => w.OpenTaskCount), 2);

            return new ProjectWorkloadNode(workloads, unassigned, average);
        }
    }
}