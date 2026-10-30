using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskTracker.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class ChangeTaskNumberToInt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE tasks ALTER COLUMN "Number" TYPE integer
                USING regexp_replace("Number", '\D', '', 'g')::integer;
                """);

            migrationBuilder.AlterColumn<int>(
                name: "LastTaskNumber",
                table: "projects",
                type: "integer",
                nullable: false,
                oldClrType: typeof(long),
                oldType: "bigint");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Number",
                table: "tasks",
                type: "text",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<long>(
                name: "LastTaskNumber",
                table: "projects",
                type: "bigint",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");
        }
    }
}
