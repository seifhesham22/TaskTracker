namespace TaskTracker.API.Domain.Entities
{
    public class RevokedToken
    {
        public string TokenId { get; private set; } = string.Empty;
        public Guid UserId { get; private set; }
        public DateTime ExpiresAt { get; private set; }
        public DateTime RevokedAt { get; private set; }

        private RevokedToken()
        {
        }

        public RevokedToken(string tokenId, Guid userId, DateTime expiresAt, DateTime revokedAt)
        {
            TokenId = tokenId;
            UserId = userId;
            ExpiresAt = expiresAt;
            RevokedAt = revokedAt;
        }
    }
}