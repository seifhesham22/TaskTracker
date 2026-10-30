namespace TaskTracker.API.Shared.Positions
{
    public static class PositionKey
    {
        private const string Digits = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        public static string After(string? last)
        {
            if (string.IsNullOrEmpty(last))
                return "V";

            var index = Digits.IndexOf(last[^1]);
            return index < Digits.Length - 1
                ? last[..^1] + Digits[index + 1]
                : last + "V";
        }
    }
}