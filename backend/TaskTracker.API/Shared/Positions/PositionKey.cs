using System.Text;

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

        public static string Between(string? low, string? high)
        {
            var lower = low ?? string.Empty;

            if (high is not null && string.CompareOrdinal(lower, high) >= 0)
                throw new ArgumentException($"'{low}' must come before '{high}'.");

            return Midpoint(lower, high);
        }

        private static string Midpoint(string low, string? high)
        {
            var key = new StringBuilder();

            for (var i = 0; ; i++)
            {
                if (high is not null && i >= low.Length && i >= high.Length)
                    throw new ArgumentException($"No key fits between '{low}' and '{high}'.");

                var lowDigit = i < low.Length ? Digits.IndexOf(low[i]) : 0;
                var highDigit = high is null ? Digits.Length : i < high.Length ? Digits.IndexOf(high[i]) : 0;

                if (lowDigit == highDigit)
                {
                    key.Append(Digits[lowDigit]);
                    continue;
                }

                if (highDigit - lowDigit > 1)
                    return key.Append(Digits[(lowDigit + highDigit) / 2]).ToString();

                key.Append(Digits[lowDigit]);
                return key.Append(Midpoint(i + 1 < low.Length ? low[(i + 1)..] : string.Empty, null)).ToString();
            }
        }
    }
}
