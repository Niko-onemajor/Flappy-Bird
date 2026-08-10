using back.Models;
using back.Services;
using Microsoft.AspNetCore.Mvc;

namespace back.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ScoreController : ControllerBase
{
    private readonly ScoreService _scoreService;

    public ScoreController(ScoreService scoreService)
    {
        _scoreService = scoreService;
    }

    /// <summary>获取排行榜</summary>
    [HttpGet]
    public async Task<ActionResult<List<HighScoreDto>>> GetTopScores([FromQuery] int limit = 10)
    {
        var scores = await _scoreService.GetTopScoresAsync(limit);
        return Ok(scores);
    }

    /// <summary>提交分数</summary>
    [HttpPost]
    public async Task<ActionResult<HighScoreDto>> SubmitScore([FromBody] SubmitScoreRequest request)
    {
        var result = await _scoreService.SubmitScoreAsync(request);
        return Ok(result);
    }

    /// <summary>删除指定玩家名称的分数记录（用于测试数据清理）</summary>
    [HttpDelete("cleanup")]
    public async Task<ActionResult<object>> CleanupTestData([FromBody] CleanupScoresRequest request)
    {
        var deleted = await _scoreService.DeleteByPlayerNamesAsync(request.PlayerNames);
        return Ok(new { deletedCount = deleted });
    }
}