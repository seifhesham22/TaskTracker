using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace TaskTracker.API.Shared.Auth
{
    public sealed class JwtAccessTokenService(IOptions<JwtOptions> options, TimeProvider time) : IAccessTokenService
    {
        private readonly JsonWebTokenHandler _handler = new();

        public AccessToken Create(Guid userId, string email)
        {
            var jwt = options.Value;
            var now = time.GetUtcNow();
            var expiresAt = now.AddMinutes(jwt.AccessTokenMinutes);

            var token = _handler.CreateToken(new SecurityTokenDescriptor
            {
                Issuer = jwt.Issuer,
                Audience = jwt.Audience,
                IssuedAt = now.UtcDateTime,
                NotBefore = now.UtcDateTime,
                Expires = expiresAt.UtcDateTime,
                Claims = new Dictionary<string, object>
                {
                    [JwtRegisteredClaimNames.Sub] = userId.ToString(),
                    [JwtRegisteredClaimNames.Email] = email,
                    [JwtRegisteredClaimNames.Jti] = Guid.NewGuid().ToString()
                },
                SigningCredentials = new SigningCredentials(jwt.SigningKey(), SecurityAlgorithms.HmacSha256)
            });

            return new AccessToken(token, expiresAt);
        }
    }
}