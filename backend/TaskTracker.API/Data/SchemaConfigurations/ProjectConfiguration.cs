using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskTracker.API.Domain.Entities;

namespace TaskTracker.API.Data.SchemaConfigurations
{
    public class ProjectConfiguration : IEntityTypeConfiguration<Project>
    {
        public void Configure(EntityTypeBuilder<Project> builder)
        {
            builder.ToTable("projects");

            builder.Property(x => x.Name).HasMaxLength(100);
            builder.Property(x => x.Key).HasMaxLength(10);
            builder.Property(x => x.Description).HasMaxLength(2000);

            builder.HasIndex(x => x.Key).IsUnique();
            builder.HasQueryFilter(x => !x.IsDeleted);
        }
    }
}
