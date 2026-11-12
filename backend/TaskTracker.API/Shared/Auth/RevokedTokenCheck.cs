using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.JsonWebTokens;

namespace TaskTracker.API.Shared.Auth
{
    public static class RevokedTokenCheck
    {
        public static async Task RejectRevokedTokenAsync(TokenValidatedContext context)
        {
            var tokenId = context.Principal?.FindFirstValue(JwtRegisteredClaimNames.Jti);
            var revocations = context.HttpContext.RequestServices.GetRequiredService<ITokenRevocationService>();

            if (tokenId is null || await revocations.IsRevokedAsync(tokenId, context.HttpContext.RequestAborted))
                context.Fail("This token is no longer valid.");
        }
    }
}
