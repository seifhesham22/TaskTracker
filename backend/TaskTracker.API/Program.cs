using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using TaskTracker.API.Data;
using TaskTracker.API.Data.DataLoaders;
using TaskTracker.API.Data.Seeders;
using TaskTracker.API.Domain.Entities;
using TaskTracker.API.Features.Auth.Login;
using TaskTracker.API.Features.Auth.Logout;
using TaskTracker.API.Features.Auth.Register;
using TaskTracker.API.Features.Boards.GetBoard;
using TaskTracker.API.Features.Projects.GetProjects;
using TaskTracker.API.Features.Tasks.CreateTask;
using TaskTracker.API.Features.Tasks.GetTasks;
using TaskTracker.API.Features.Tasks.MoveTask;
using TaskTracker.API.Features.Tasks.UpdateTask;
using TaskTracker.API.Features.Users.Me;
using TaskTracker.API.Shared.Auth;
using TaskTracker.API.Shared.Completion;
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
        x.User.RequireUniqueEmail = true;
    })
    .AddEntityFrameworkStores<ApplicationDbContext>();

builder.Services
    .AddOptions<JwtOptions>()
    .BindConfiguration(JwtOptions.Section)
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<IAccessTokenService, JwtAccessTokenService>();
builder.Services.AddScoped<ITokenRevocationService, TokenRevocationService>();

builder.Services
    .AddAuthentication(x =>
    {
        x.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
        x.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        x.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer();

builder.Services
    .AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<JwtOptions>>((bearer, jwt) =>
    {
        bearer.MapInboundClaims = false;
        bearer.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwt.Value.Issuer,
            ValidAudience = jwt.Value.Audience,
            IssuerSigningKey = jwt.Value.SigningKey(),
            ValidateIssuerSigningKey = true,
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = JwtRegisteredClaimNames.Sub
        };
        bearer.Events = new JwtBearerEvents
        {
            OnTokenValidated = RevokedTokenCheck.RejectRevokedTokenAsync
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddScoped<ITaskPositionService, TaskPositionService>();
builder.Services.AddScoped<ITaskCompletionGuard, TaskCompletionGuard>();
builder.Services.AddScoped<CreateTaskHandler>();
builder.Services.AddScoped<GetTasksHandler>();
builder.Services.AddScoped<GetProjectsHandler>();
builder.Services.AddScoped<GetBoardHandler>();
builder.Services.AddScoped<MoveTaskHandler>();
builder.Services.AddScoped<UpdateTaskHandler>();
builder.Services.AddScoped<RegisterHandler>();
builder.Services.AddScoped<LoginHandler>();
builder.Services.AddScoped<LogoutHandler>();
builder.Services.AddScoped<GetMeHandler>();
builder.Services.AddDataLoader<ColumnByIdDataLoader>();
builder.Services.AddDataLoader<AssigneesByTaskIdDataLoader>();
builder.Services.AddDataLoader<MembersByProjectIdDataLoader>();
builder.Services.AddDataLoader<BoardsByProjectIdDataLoader>();
builder.Services.AddDataLoader<ColumnsByBoardIdDataLoader>();

builder.Services
    .AddGraphQLServer()
    .AddQueryType()
    .AddMutationType()
    .AddAuthorization()
    .AddType<GetTasksQuery>()
    .AddType<GetProjectsQuery>()
    .AddType<GetBoardQuery>()
    .AddType<CreateTaskMutation>()
    .AddType<MoveTaskMutation>()
    .AddType<UpdateTaskMutation>()
    .AddType<RegisterMutation>()
    .AddType<LoginMutation>()
    .AddType<LogoutMutation>()
    .AddType<MeQuery>()
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

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapGraphQL();

app.Run();