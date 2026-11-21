using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Shared.Exceptions;

namespace TaskTracker.API.Shared.Filtering
{
    public static class TaskTitleSearch
    {
        public const int MaxLength = TaskItem.TitleMaxLength;

        public static string Normalize(string? search)
        {
            var term = search?.Trim() ?? string.Empty;

            if (term.Length > MaxLength)
                throw new BadUserInputException($"Search cannot be longer than {MaxLength} characters.");

            return term;
        }

        public static IQueryable<TaskItem> WithTitleContaining(this IQueryable<TaskItem> tasks, string term)
        {
            if (term.Length == 0)
                return tasks;

            var pattern = $"%{Escape(term)}%";
            return tasks.Where(t => EF.Functions.ILike(t.Title, pattern, @"\"));
        }

        private static string Escape(string text) =>
            text.Replace(@"\", @"\\").Replace("%", @"\%").Replace("_", @"\_");
    }
}
