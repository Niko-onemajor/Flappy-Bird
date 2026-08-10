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
        var playerName = string.IsNullOrEmpty(request.PlayerName) ? "Anonymous" : request.PlayerName;
        var entry = new HighScore
        {
            PlayerName = playerName,
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

    /// <summary>删除指定玩家名称的分数记录（用于测试数据清理）</summary>
    public async Task<int> DeleteByPlayerNamesAsync(List<string> playerNames)
    {
        if (playerNames == null || playerNames.Count == 0)
            return 0;

        /* 同时也清理玩家名称为空或 null 的记录 */
        var toDelete = await _db.HighScores
            .Where(s => playerNames.Contains(s.PlayerName)
                     || (playerNames.Contains("Anonymous") && (s.PlayerName == null || s.PlayerName == "")))
            .ToListAsync();

        if (toDelete.Count == 0)
            return 0;

        _db.HighScores.RemoveRange(toDelete);
        await _db.SaveChangesAsync();
        return toDelete.Count;
    }
}