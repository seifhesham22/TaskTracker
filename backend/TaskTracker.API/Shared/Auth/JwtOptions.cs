using System.ComponentModel.DataAnnotations;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace TaskTracker.API.Shared.Auth
{
    public sealed class JwtOptions
    {
        public const string Section = "Jwt";

        [Required, MinLength(32)]
        public string Key { get; init; } = string.Empty;

        [Required]
        public string Issuer { get; init; } = string.Empty;

        [Required]
        public string Audience { get; init; } = string.Empty;

        [Range(1, 1440)]
        public int AccessTokenMinutes { get; init; } = 60;

        public SymmetricSecurityKey SigningKey() => new(Encoding.UTF8.GetBytes(Key));
    }
}