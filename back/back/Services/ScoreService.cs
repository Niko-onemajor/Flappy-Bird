using back.Data;
using back.Models;
using Microsoft.EntityFrameworkCore;

namespace back.Services;

public class ScoreService
{
    private readonly AppDbContext _db;

    public ScoreService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<HighScoreDto> SubmitScoreAsync(SubmitScoreRequest request)
    {
        var entry = new HighScore
        {
            PlayerName = request.PlayerName,
            Score = request.Score,
            CreatedAt = DateTime.UtcNow,
        };
        _db.HighScores.Add(entry);
        await _db.SaveChangesAsync();

        return new HighScoreDto
        {
            Id = entry.Id,
            PlayerName = entry.PlayerName,
            Score = entry.Score,
            CreatedAt = entry.CreatedAt,
        };
    }

    public async Task<List<HighScoreDto>> GetTopScoresAsync(int limit = 10)
    {
        return await _db.HighScores
            .OrderByDescending(s => s.Score)
            .Take(limit)
            .Select(s => new HighScoreDto
            {
                Id = s.Id,
                PlayerName = s.PlayerName,
                Score = s.Score,
                CreatedAt = s.CreatedAt,
            })
            .ToListAsync();
    }
}