using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TaskTracker.API.Data.Migrations
{
    public partial class AddTaskNumberTrigger : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE FUNCTION set_task_number() RETURNS trigger AS $$
                BEGIN
                    UPDATE projects
                    SET "LastTaskNumber" = "LastTaskNumber" + 1
                    WHERE "Id" = NEW."ProjectId"
                    RETURNING "LastTaskNumber" INTO NEW."Number";

                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;

                CREATE TRIGGER tasks_set_number
                BEFORE INSERT ON tasks
                FOR EACH ROW EXECUTE FUNCTION set_task_number();
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TRIGGER IF EXISTS tasks_set_number ON tasks;
                DROP FUNCTION IF EXISTS set_task_number();
                """);
        }
    }
}