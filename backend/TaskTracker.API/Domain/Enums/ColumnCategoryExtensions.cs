namespace TaskTracker.API.Domain.Enums
{
    public static class ColumnCategoryExtensions
    {
        public static bool IsActive(this ColumnCategory category) =>
            category is ColumnCategory.InProgress or ColumnCategory.Done;
    }
}
