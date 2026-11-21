using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskTracker.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTaskRank : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Rank",
                table: "tasks",
                type: "character varying(255)",
                maxLength: 255,
                nullable: false,
                defaultValue: "",
                collation: "C");

            migrationBuilder.Sql("""
                UPDATE tasks AS t
                SET "Rank" = lpad(ranked.n::text, 10, '0')
                FROM (
                    SELECT task."Id",
                           row_number() OVER (
                               PARTITION BY task."ProjectId"
                               ORDER BY board."Position", board."Id", col."Position", col."Id", task."Position", task."Id") AS n
                    FROM tasks AS task
                    JOIN boards AS board ON board."Id" = task."BoardId"
                    JOIN board_columns AS col ON col."Id" = task."ColumnId"
                ) AS ranked
                WHERE ranked."Id" = t."Id";
                """);

            migrationBuilder.CreateIndex(
                name: "IX_tasks_ProjectId_Rank",
                table: "tasks",
                columns: new[] { "ProjectId", "Rank" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_tasks_ProjectId_Rank",
                table: "tasks");

            migrationBuilder.DropColumn(
                name: "Rank",
                table: "tasks");
        }
    }
}
