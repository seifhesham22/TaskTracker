using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskTracker.API.Domain.Entities;

namespace TaskTracker.API.Data.SchemaConfigurations
{
    public class BoardColumnConfiguration : IEntityTypeConfiguration<BoardColumn>
    {
        public void Configure(EntityTypeBuilder<BoardColumn> builder)
        {
            builder.ToTable("board_columns");

            builder.Property(x => x.Name).HasMaxLength(100);
            builder.Property(x => x.Category).HasConversion<string>().HasMaxLength(20);
            builder.Property(x => x.Color).HasMaxLength(7);
            builder.Property(x => x.Position).HasMaxLength(64).UseCollation("C");
            builder.HasAlternateKey(x => new { x.BoardId, x.Id });

            builder.HasOne(x => x.Board).WithMany(x => x.Columns)
                .HasForeignKey(x => x.BoardId).OnDelete(DeleteBehavior.Cascade);
        }
    }
}
