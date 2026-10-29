using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Domain.Entities;

namespace TaskTracker.API.Data
{
    public class ApplicationDbContext : IdentityDbContext<User, IdentityRole<Guid>, Guid>
    {
        public DbSet<Project> projects => Set<Project>();
        public DbSet<ProjectMember> projectMembers => Set<ProjectMember>();
        public DbSet<Board> boards => Set<Board>();
        public DbSet<BoardColumn> boardColumns => Set<BoardColumn>();
        public DbSet<TaskAssignee> assignees => Set<TaskAssignee>();
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
        {
        }

        protected ApplicationDbContext()
        {
        }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);
            builder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);

            foreach (var entityType in builder.Model.GetEntityTypes()
                         .Where(t => typeof(Entity).IsAssignableFrom(t.ClrType)))
            {
                builder.Entity(entityType.ClrType).Property(nameof(Entity.Id)).ValueGeneratedNever();
            }
        }

        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            foreach (var entry in ChangeTracker.Entries<Entity>().Where(e => e.State == EntityState.Modified))
            {
                entry.Property(e => e.UpdatedAt).CurrentValue = DateTime.UtcNow;
            }

            return base.SaveChangesAsync(cancellationToken);
        }
    }
}