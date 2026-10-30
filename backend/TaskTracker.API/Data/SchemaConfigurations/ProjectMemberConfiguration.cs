using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskTracker.API.Domain.Entities;

namespace TaskTracker.API.Data.SchemaConfigurations
{
    public class ProjectMemberConfiguration : IEntityTypeConfiguration<ProjectMember>
    {
        public void Configure(EntityTypeBuilder<ProjectMember> builder)
        {
            builder.ToTable("project_members");

            builder.HasIndex(x => new { x.ProjectId, x.UserId }).IsUnique();
            builder.Property(x => x.ProjectRole).HasConversion<string>().HasMaxLength(20);

            builder.HasOne(x => x.Project).WithMany(x => x.ProjectMembers)
                .HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(x => x.User).WithMany(x => x.MemberShips)
                .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        }
    }
}
