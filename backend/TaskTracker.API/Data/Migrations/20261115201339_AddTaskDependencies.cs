using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskTracker.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTaskDependencies : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "task_dependencies",
                columns: table => new
                {
                    BlockingTaskId = table.Column<Guid>(type: "uuid", nullable: false),
                    BlockedTaskId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_task_dependencies", x => new { x.BlockingTaskId, x.BlockedTaskId });
                    table.CheckConstraint("CK_task_dependencies_NotSelf", "\"BlockingTaskId\" <> \"BlockedTaskId\"");
                    table.ForeignKey(
                        name: "FK_task_dependencies_tasks_BlockedTaskId",
                        column: x => x.BlockedTaskId,
                        principalTable: "tasks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_task_dependencies_tasks_BlockingTaskId",
                        column: x => x.BlockingTaskId,
                        principalTable: "tasks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_task_dependencies_BlockedTaskId",
                table: "task_dependencies",
                column: "BlockedTaskId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "task_dependencies");
        }
    }
}
