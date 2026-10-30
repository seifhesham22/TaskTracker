using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;
using TaskTracker.API.Domain.Entities;

namespace TaskTracker.API.Data.SchemaConfigurations
{
    public class TaskItemConfiguration : IEntityTypeConfiguration<TaskItem>
    {
        public void Configure(EntityTypeBuilder<TaskItem> builder)
        {
            builder.ToTable("tasks", t =>
                t.HasCheckConstraint("CK_tasks_Title_NotEmpty", "length(trim(\"Title\")) > 0"));

            builder.Property(x => x.Title).HasMaxLength(TaskItem.TitleMaxLength);
            builder.Property(x => x.DescriptionJson).HasColumnType("jsonb");
            builder.Property(x => x.Priority).HasConversion<string>().HasMaxLength(20);
            builder.Property(x => x.EstimateHours).HasPrecision(6, 2);
            builder.Property(x => x.Position).HasMaxLength(64).UseCollation("C");

            builder.Property(x => x.Number).ValueGeneratedOnAdd()
                .Metadata.SetValueGenerationStrategy(NpgsqlValueGenerationStrategy.None);
            builder.HasIndex(x => new { x.ProjectId, x.Number }).IsUnique();

            builder.HasQueryFilter(x => !x.IsDeleted);

            builder.HasOne(x => x.Project).WithMany(x => x.Tasks)
                .HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(x => x.Board).WithMany()
                .HasForeignKey(x => x.BoardId).OnDelete(DeleteBehavior.Cascade);

            
            builder.HasOne(x => x.Column).WithMany(x => x.Tasks)
                .HasForeignKey(x => new { x.BoardId, x.ColumnId })
                .HasPrincipalKey(x => new { x.BoardId, x.Id })
                .OnDelete(DeleteBehavior.NoAction);

            builder.HasOne(x => x.ParentTask).WithMany(x => x.Subtasks)
                .HasForeignKey(x => x.ParentTaskId).OnDelete(DeleteBehavior.NoAction);

            builder.HasOne(x => x.CreatedBy).WithMany()
                .HasForeignKey(x => x.CreatedById).OnDelete(DeleteBehavior.SetNull);

            builder.HasOne(x => x.DeletedBy).WithMany()
                .HasForeignKey(x => x.DeletedById).OnDelete(DeleteBehavior.SetNull);
        }
    }
}