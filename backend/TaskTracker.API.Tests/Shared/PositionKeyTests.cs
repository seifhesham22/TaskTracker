using TaskTracker.API.Shared.Positions;

namespace TaskTracker.API.Tests.Shared;

public class PositionKeyTests
{
    [Theory]
    [InlineData(null, "V")]
    [InlineData("", "V")]
    [InlineData("V", "W")]
    [InlineData("tV", "tW")]
    [InlineData("z", "zV")]
    public void After_gives_a_key_that_sorts_after_the_last_one(string? last, string expected)
    {
        var next = PositionKey.After(last);

        Assert.Equal(expected, next);
        if (!string.IsNullOrEmpty(last))
            Assert.True(string.CompareOrdinal(last, next) < 0, $"'{next}' should sort after '{last}'");
    }
}