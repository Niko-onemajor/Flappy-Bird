using Microsoft.EntityFrameworkCore;

namespace back.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<HighScore> HighScores => Set<HighScore>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<HighScore>(entity =>
        {
            entity.ToTable("high_scores");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.PlayerName).HasColumnName("player_name").HasMaxLength(50).IsRequired();
            entity.Property(e => e.Score).HasColumnName("score").IsRequired();
            entity.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.HasIndex(e => e.Score);
        });
    }
}

public class HighScore
{
    public int Id { get; set; }
    public string PlayerName { get; set; } = "Anonymous";
    public int Score { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}