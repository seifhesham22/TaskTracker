using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Domain.Exceptions;

namespace TaskTracker.API.Tests.Domain;

public class ProjectTests
{
    [Theory]
    [InlineData("Task Tracker", "TASK")]
    [InlineData("my app", "MYAP")]
    [InlineData("Web", "WEB")]
    [InlineData("AI", "AI")]
    [InlineData("  web-site 2026 ", "WEBS")]
    [InlineData("C# & .NET", "CNET")]
    [InlineData("2026 plan", "2026")]
    public void Without_a_key_the_key_is_the_first_four_letters_or_digits_of_the_name_in_capitals(string name, string key)
    {
        var project = new Project(name);

        Assert.Equal(key, project.Key);
    }

    [Theory]
    [InlineData("A")]
    [InlineData("مشروع")]
    [InlineData("!! ??")]
    public void A_name_with_fewer_than_two_letters_or_digits_gets_the_fallback_key(string name)
    {
        var project = new Project(name);

        Assert.Equal(Project.FallbackKey, project.Key);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void A_missing_key_is_generated(string? key)
    {
        var project = new Project("Website", key);

        Assert.Equal("WEBS", project.Key);
    }

    [Fact]
    public void A_given_key_is_kept_in_capitals()
    {
        var project = new Project("Website", " web2 ");

        Assert.Equal("WEB2", project.Key);
    }

    [Theory]
    [InlineData("A")]
    [InlineData("ABCDEFGHIJK")]
    [InlineData("WE B")]
    [InlineData("WEB-1")]
    [InlineData("مش")]
    public void A_wrong_key_is_refused(string key)
    {
        var error = Assert.Throws<DomainException>(() => new Project("Website", key));

        Assert.Equal("Project key must be 2 to 10 letters or digits (A-Z, 0-9).", error.Message);
    }

    [Fact]
    public void The_name_is_trimmed()
    {
        var project = new Project("  Website  ");

        Assert.Equal("Website", project.Name);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void An_empty_name_is_refused(string name)
    {
        var error = Assert.Throws<DomainException>(() => new Project(name));

        Assert.Equal("Project name cannot be empty or only spaces.", error.Message);
    }

    [Fact]
    public void A_name_longer_than_100_characters_is_refused()
    {
        Assert.Equal(100, new Project(new string('a', 100)).Name.Length);

        var error = Assert.Throws<DomainException>(() => new Project(new string('a', 101)));

        Assert.Equal("Project name cannot be longer than 100 characters.", error.Message);
    }

    [Theory]
    [InlineData(null, null)]
    [InlineData("   ", null)]
    [InlineData("  Our website  ", "Our website")]
    public void The_description_is_trimmed_and_a_blank_one_is_left_empty(string? description, string? saved)
    {
        var project = new Project("Website", description: description);

        Assert.Equal(saved, project.Description);
    }

    [Fact]
    public void A_description_longer_than_2000_characters_is_refused()
    {
        var error = Assert.Throws<DomainException>(() => new Project("Website", description: new string('a', 2001)));

        Assert.Equal("Project description cannot be longer than 2000 characters.", error.Message);
    }

    [Fact]
    public void The_owner_is_added_as_a_member_with_the_owner_role()
    {
        var project = new Project("Website");
        var userId = Guid.NewGuid();

        project.AddOwner(userId);

        var member = Assert.Single(project.ProjectMembers);
        Assert.Equal(userId, member.UserId);
        Assert.Equal(project.Id, member.ProjectId);
        Assert.Equal(ProjectRole.Owner, member.ProjectRole);
    }

    [Theory]
    [InlineData(ProjectRole.Reader)]
    [InlineData(ProjectRole.Writer)]
    public void Readers_and_writers_can_be_added_as_members(ProjectRole role)
    {
        var project = new Project("Website");
        var userId = Guid.NewGuid();

        var member = project.AddMember(userId, role);

        Assert.Same(member, Assert.Single(project.ProjectMembers));
        Assert.Equal(role, member.ProjectRole);
        Assert.Equal(userId, member.UserId);
    }

    [Fact]
    public void A_second_owner_cannot_be_added()
    {
        var project = new Project("Website");
        project.AddOwner(Guid.NewGuid());

        var error = Assert.Throws<DomainException>(() => project.AddMember(Guid.NewGuid(), ProjectRole.Owner));

        Assert.Equal("A project has only one owner. New members can be readers or writers.", error.Message);
        Assert.Single(project.ProjectMembers);
    }

    [Fact]
    public void The_default_board_has_the_four_default_columns_in_order()
    {
        var project = new Project("Website");

        var board = project.AddDefaultBoard();

        Assert.Same(board, Assert.Single(project.Boards));
        Assert.Equal(project.Id, board.ProjectId);
        Assert.Equal(
            new[] { ColumnCategory.Backlog, ColumnCategory.ToDo, ColumnCategory.InProgress, ColumnCategory.Done },
            board.Columns.OrderBy(c => c.Position, StringComparer.Ordinal).Select(c => c.Category));
    }
}
