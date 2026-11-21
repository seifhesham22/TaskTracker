using TaskTracker.API.Shared.Positions;

namespace TaskTracker.API.Tests.Shared;

public class PositionKeyTests
{
    [Theory]
    [InlineData(null, null)]
    [InlineData(null, "V")]
    [InlineData(null, "0000000001")]
    [InlineData("V", null)]
    [InlineData("z", null)]
    [InlineData("V", "W")]
    [InlineData("V", "V1")]
    [InlineData("Vz", "W")]
    [InlineData("0000000001", "0000000002")]
    [InlineData("0000000009", "0000000010")]
    public void Between_gives_a_key_strictly_between_its_neighbours(string? low, string? high)
    {
        var key = PositionKey.Between(low, high);

        if (low is not null)
            Assert.True(string.CompareOrdinal(low, key) < 0, $"'{key}' is not after '{low}'");
        if (high is not null)
            Assert.True(string.CompareOrdinal(key, high) < 0, $"'{key}' is not before '{high}'");
        Assert.False(key.EndsWith('0'));
    }

    [Theory]
    [InlineData("W", "V")]
    [InlineData("V", "V")]
    public void Between_refuses_neighbours_in_the_wrong_order(string low, string high)
    {
        Assert.Throws<ArgumentException>(() => PositionKey.Between(low, high));
    }

    [Fact]
    public void Hundreds_of_moves_to_the_top_stay_in_order()
    {
        var keys = new List<string> { PositionKey.After(null) };

        for (var i = 0; i < 500; i++)
            keys.Insert(0, PositionKey.Between(null, keys[0]));

        Assert.Equal(keys.OrderBy(k => k, StringComparer.Ordinal), keys);
        Assert.Equal(keys.Count, keys.Distinct().Count());
    }

    [Fact]
    public void Keys_grow_when_many_are_put_into_the_same_gap()
    {
        var key = PositionKey.After(null);

        for (var i = 0; i < 500; i++)
            key = PositionKey.Between(null, key);

        Assert.True(key.Length > 64, $"Expected a long key after 500 inserts, got {key.Length} characters.");
    }

    [Fact]
    public void Hundreds_of_moves_into_the_same_gap_stay_in_order()
    {
        const string low = "V";
        var high = "W";
        var keys = new List<string> { low, high };

        for (var i = 0; i < 500; i++)
        {
            high = PositionKey.Between(low, high);
            keys.Insert(1, high);
        }

        Assert.Equal(keys.OrderBy(k => k, StringComparer.Ordinal), keys);
        Assert.Equal(keys.Count, keys.Distinct().Count());
    }

    [Theory]
    [InlineData(null, "V")]
    [InlineData("", "V")]
    [InlineData("V", "W")]
    [InlineData("tV", "tW")]
    [InlineData("z", "zV")]
    [InlineData("0000000042", "0000000043")]
    public void After_gives_a_key_that_sorts_after_the_last_one(string? last, string expected)
    {
        var next = PositionKey.After(last);

        Assert.Equal(expected, next);
        if (!string.IsNullOrEmpty(last))
            Assert.True(string.CompareOrdinal(last, next) < 0, $"'{next}' should sort after '{last}'");
    }
}
