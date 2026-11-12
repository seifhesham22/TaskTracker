using Microsoft.AspNetCore.Identity;

namespace TaskTracker.API.Domain.Entities
{
    public class User : IdentityUser<Guid>
    {
        public ICollection<ProjectMember> MemberShips { get; set; } = [];

        public User(string email)
        {
            Id = Guid.CreateVersion7();
            UserName = email;
            Email = email;
        }
    }
}