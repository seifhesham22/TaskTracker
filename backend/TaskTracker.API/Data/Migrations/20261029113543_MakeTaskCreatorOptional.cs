using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskTracker.API.Data.Migrations
{
    /// <inheritdoc />
    public partial class MakeTaskCreatorOptional : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_tasks_AspNetUsers_CreatedById",
                table: "tasks");

            migrationBuilder.AlterColumn<Guid>(
                name: "CreatedById",
                table: "tasks",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddForeignKey(
                name: "FK_tasks_AspNetUsers_CreatedById",
                table: "tasks",
                column: "CreatedById",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_tasks_AspNetUsers_CreatedById",
                table: "tasks");

            migrationBuilder.Sql("""DELETE FROM tasks WHERE "CreatedById" IS NULL;""");

            migrationBuilder.AlterColumn<Guid>(
                name: "CreatedById",
                table: "tasks",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_tasks_AspNetUsers_CreatedById",
                table: "tasks",
                column: "CreatedById",
                principalTable: "AspNetUsers",
                principalColumn: "Id");
        }
    }
}
