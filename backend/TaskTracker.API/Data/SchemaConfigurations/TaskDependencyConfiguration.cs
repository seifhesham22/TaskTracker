using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskTracker.API.Domain.Entities;

namespace TaskTracker.API.Data.SchemaConfigurations
{
    public class TaskDependencyConfiguration : IEntityTypeConfiguration<TaskDependency>
    {
        public void Configure(EntityTypeBuilder<TaskDependency> builder)
        {
            builder.ToTable("task_dependencies", t =>
                t.HasCheckConstraint("CK_task_dependencies_NotSelf", "\"BlockingTaskId\" <> \"BlockedTaskId\""));

            builder.HasKey(x => new { x.BlockingTaskId, x.BlockedTaskId });
            builder.HasIndex(x => x.BlockedTaskId);

            builder.HasOne(x => x.BlockingTask).WithMany()
                .HasForeignKey(x => x.BlockingTaskId).OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(x => x.BlockedTask).WithMany()
                .HasForeignKey(x => x.BlockedTaskId).OnDelete(DeleteBehavior.Cascade);

            builder.HasQueryFilter(x => !x.BlockingTask.IsDeleted && !x.BlockedTask.IsDeleted);
        }
    }
}
