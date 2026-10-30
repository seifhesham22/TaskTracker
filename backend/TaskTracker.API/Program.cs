using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Data.Seeders;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Features.Tasks.CreateTask;
using TaskTracker.API.Shared.GraphQL;

var builder = WebApplication.CreateBuilder(args);


builder.Services.AddDbContext<ApplicationDbContext>(x =>
{
    x.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"));
});
builder.Services
    .AddIdentity<User, IdentityRole<Guid>>(x =>
    {
        x.Password.RequiredLength = 10;
        x.Password.RequireUppercase = true;
    })
    .AddEntityFrameworkStores<ApplicationDbContext>();

builder.Services.AddScoped<CreateTaskHandler>();

builder.Services
    .AddGraphQLServer()
    .AddQueryType()
    .AddMutationType()
    .AddType<PingQuery>()
    .AddType<CreateTaskMutation>()
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