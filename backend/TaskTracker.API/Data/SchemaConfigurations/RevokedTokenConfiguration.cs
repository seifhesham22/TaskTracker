using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TaskTracker.API.Domain.Entities;

namespace TaskTracker.API.Data.SchemaConfigurations
{
    public class RevokedTokenConfiguration : IEntityTypeConfiguration<RevokedToken>
    {
        public void Configure(EntityTypeBuilder<RevokedToken> builder)
        {
            builder.ToTable("revoked_tokens");
            builder.HasKey(x => x.TokenId);
            builder.Property(x => x.TokenId).HasMaxLength(64);
            builder.HasIndex(x => x.ExpiresAt);

            builder.HasOne<User>()
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}