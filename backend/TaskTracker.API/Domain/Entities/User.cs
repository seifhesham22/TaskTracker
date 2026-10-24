using Microsoft.AspNetCore.Identity;

namespace TaskTracker.API.Domain.Entities
{
    public class User : IdentityUser<Guid>
    {
    }
}