using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TaskTracker.API.Data;
using TaskTracker.API.Data.Seeders;
using TaskTracker.API.Domain.Entities;

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

builder.Services.AddControllers();

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    await DbSeeder.SeedAsync(app.Services);
    await DbSeeder.SeedProjectAsync(app.Services);
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();