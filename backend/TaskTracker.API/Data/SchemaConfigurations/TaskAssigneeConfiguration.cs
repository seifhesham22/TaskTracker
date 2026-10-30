using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskTracker.API.Domain.Entities;

namespace TaskTracker.API.Data.SchemaConfigurations
{
    public class TaskAssigneeConfiguration : IEntityTypeConfiguration<TaskAssignee>
    {
        public void Configure(EntityTypeBuilder<TaskAssignee> builder)
        {
            builder.ToTable("task_assignee");
            builder.HasKey(x => new { x.UserId, x.TaskId });

            builder.HasOne(x => x.Task)
                .WithMany(x => x.Assignees)
                .HasForeignKey(x => x.TaskId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}