using TaskTracker.API.Domain.Enums;
using TaskTracker.API.Shared.Exceptions;
using TaskTracker.API.Shared.Membership;

namespace TaskTracker.API.Tests.Shared;

public class ProjectRoleExtensionsTests
{
    [Theory]
    [InlineData(ProjectRole.Reader)]
    [InlineData(ProjectRole.Writer)]
    [InlineData(ProjectRole.Owner)]
    public void Every_member_can_read(ProjectRole role)
    {
        Assert.Equal(role, ((ProjectRole?)role).EnsureCanRead("Not found."));
    }

    [Fact]
    public void Someone_without_a_role_gets_not_found()
    {
        var error = Assert.Throws<NotFoundException>(() => ((ProjectRole?)null).EnsureCanRead("Board 'x' was not found."));

        Assert.Equal("Board 'x' was not found.", error.Message);
    }

    [Theory]
    [InlineData(ProjectRole.Writer)]
    [InlineData(ProjectRole.Owner)]
    public void Writers_and_the_owner_can_write(ProjectRole role)
    {
        Assert.Equal(role, ((ProjectRole?)role).EnsureCanWrite("Not found.", "Not allowed."));
    }

    [Fact]
    public void A_reader_cannot_write()
    {
        var error = Assert.Throws<ForbiddenException>(() => ((ProjectRole?)ProjectRole.Reader).EnsureCanWrite("Not found.", "Not allowed."));

        Assert.Equal("Not allowed.", error.Message);
    }

    [Fact]
    public void Someone_without_a_role_gets_not_found_before_any_write_check()
    {
        Assert.Throws<NotFoundException>(() => ((ProjectRole?)null).EnsureCanWrite("Not found.", "Not allowed."));
    }
}
