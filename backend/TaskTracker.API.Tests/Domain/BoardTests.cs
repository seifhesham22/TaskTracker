using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Domain.Exceptions;

namespace TaskTracker.API.Tests.Domain;

public class BoardTests
{
    [Fact]
    public void A_new_board_gets_the_trimmed_name_the_position_and_the_four_default_columns_in_order()
    {
        var project = new Project("Website");

        var board = project.AddBoard("  Sprint 2  ", "W");

        Assert.Same(board, Assert.Single(project.Boards));
        Assert.Equal("Sprint 2", board.Name);
        Assert.Equal("W", board.Position);
        Assert.Equal(project.Id, board.ProjectId);
        Assert.Equal(
            new[] { ColumnCategory.Backlog, ColumnCategory.ToDo, ColumnCategory.InProgress, ColumnCategory.Done },
            board.Columns.OrderBy(c => c.Position, StringComparer.Ordinal).Select(c => c.Category));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void An_empty_name_is_refused(string name)
    {
        var project = new Project("Website");

        var error = Assert.Throws<DomainException>(() => project.AddBoard(name, "W"));

        Assert.Equal("Board name cannot be empty or only spaces.", error.Message);
        Assert.Empty(project.Boards);
    }

    [Fact]
    public void A_name_longer_than_100_characters_is_refused()
    {
        var project = new Project("Website");
        Assert.Equal(100, project.AddBoard(new string('a', 100), "W").Name.Length);

        var error = Assert.Throws<DomainException>(() => project.AddBoard(new string('a', 101), "X"));

        Assert.Equal("Board name cannot be longer than 100 characters.", error.Message);
    }

    [Fact]
    public void The_default_board_of_a_new_project_is_called_Board()
    {
        var project = new Project("Website");

        var board = project.AddDefaultBoard();

        Assert.Equal("Board", board.Name);
        Assert.Equal(4, board.Columns.Count);
    }
}
