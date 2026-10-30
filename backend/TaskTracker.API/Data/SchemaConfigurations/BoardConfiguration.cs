using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskTracker.API.Domain.Entities;

namespace TaskTracker.API.Data.SchemaConfigurations
{
    public class BoardConfiguration : IEntityTypeConfiguration<Board>
    {
        public void Configure(EntityTypeBuilder<Board> builder)
        {
            builder.ToTable("boards");

            builder.Property(x => x.Name).HasMaxLength(100);
            builder.Property(x => x.Description).HasMaxLength(2000);
            builder.Property(x => x.Color).HasMaxLength(7);
            builder.Property(x => x.Icon).HasMaxLength(50);
            builder.Property(x => x.Emoji).HasMaxLength(16);
            builder.Property(x => x.Position).HasMaxLength(64).UseCollation("C");

            builder.HasOne(x => x.Project).WithMany(x => x.Boards)
                .HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade);
        }
    }
}
