using back.Data;
using back.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

/* 数据库 */
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

/* 服务注册 */
builder.Services.AddSingleton<GameService>();
builder.Services.AddScoped<ScoreService>();

/* Swagger */
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

/* 控制器 */
builder.Services.AddControllers();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.UseHttpsRedirection();
}
app.MapControllers();

app.Run();