using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Data.DataLoaders;
using TaskTracker.API.Data.Seeders;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Features.Boards.GetBoard;
using TaskTracker.API.Features.Projects.GetProjects;
using TaskTracker.API.Features.Tasks.CreateTask;
using TaskTracker.API.Features.Tasks.GetTasks;
using TaskTracker.API.Features.Tasks.MoveTask;
using TaskTracker.API.Shared.GraphQL;
using TaskTracker.API.Shared.Positions;

var builder = WebApplication.CreateBuilder(args);


builder.Services.AddDbContextFactory<ApplicationDbContext>(x =>
{
    x.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"));
}, ServiceLifetime.Scoped);

builder.Services
    .AddIdentity<User, IdentityRole<Guid>>(x =>
    {
        x.Password.RequiredLength = 10;
        x.Password.RequireUppercase = true;
    })
    .AddEntityFrameworkStores<ApplicationDbContext>();

builder.Services.AddScoped<ITaskPositionService, TaskPositionService>();
builder.Services.AddScoped<CreateTaskHandler>();
builder.Services.AddScoped<GetTasksHandler>();
builder.Services.AddScoped<GetProjectsHandler>();
builder.Services.AddScoped<GetBoardHandler>();
builder.Services.AddScoped<MoveTaskHandler>();
builder.Services.AddDataLoader<ColumnByIdDataLoader>();
builder.Services.AddDataLoader<AssigneesByTaskIdDataLoader>();
builder.Services.AddDataLoader<MembersByProjectIdDataLoader>();
builder.Services.AddDataLoader<BoardsByProjectIdDataLoader>();
builder.Services.AddDataLoader<ColumnsByBoardIdDataLoader>();

builder.Services
    .AddGraphQLServer()
    .AddQueryType()
    .AddMutationType()
    .AddType<GetTasksQuery>()
    .AddType<GetProjectsQuery>()
    .AddType<GetBoardQuery>()
    .AddType<CreateTaskMutation>()
    .AddType<MoveTaskMutation>()
    .AddErrorFilter<DomainErrorFilter>()
    .ModifyRequestOptions(o => o.IncludeExceptionDetails = builder.Environment.IsDevelopment());

builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddControllers();

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    await DbSeeder.SeedAsync(app.Services);
    await DbSeeder.SeedProjectAsync(app.Services);
}

if (app.Environment.IsDevelopment())
    app.UseCors();
else
    app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();
app.MapGraphQL();

app.Run();