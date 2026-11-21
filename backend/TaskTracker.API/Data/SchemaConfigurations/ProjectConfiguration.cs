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

            builder.Property(x => x.Name).HasMaxLength(Project.NameMaxLength);
            builder.Property(x => x.Key).HasMaxLength(Project.KeyMaxLength);
            builder.Property(x => x.Description).HasMaxLength(Project.DescriptionMaxLength);

            builder.Property<uint>("Version").IsRowVersion();

            builder.HasIndex(x => x.Key).IsUnique();
            builder.HasQueryFilter(x => !x.IsDeleted);
        }
    }
}