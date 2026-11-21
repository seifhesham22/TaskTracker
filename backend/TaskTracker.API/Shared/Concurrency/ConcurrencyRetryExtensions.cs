using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;

namespace TaskTracker.API.Shared.Concurrency
{
    public static class ConcurrencyRetryExtensions
    {
        public const int MaxAttempts = 3;

        public static async Task<T> RetryOnConflictAsync<T>(this ApplicationDbContext db, Func<Task<T>> operation)
        {
            for (var attempt = 1; ; attempt++)
            {
                try
                {
                    return await operation();
                }
                catch (DbUpdateException) when (attempt < MaxAttempts)
                {
                    db.ChangeTracker.Clear();
                }
            }
        }
    }
}