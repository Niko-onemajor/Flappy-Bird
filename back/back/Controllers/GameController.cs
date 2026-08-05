using back.Models;
using back.Services;
using Microsoft.AspNetCore.Mvc;

namespace back.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GameController : ControllerBase
{
    private readonly GameService _gameService;

    public GameController(GameService gameService)
    {
        _gameService = gameService;
    }

    /// <summary>开始新游戏</summary>
    [HttpPost("start")]
    public ActionResult<GameStateResponse> Start([FromBody] GameInitRequest request)
    {
        var session = _gameService.StartGame(request.ScreenWidth, request.ScreenHeight);
        return Ok(_gameService.ToResponse(session));
    }

    /// <summary>推进一帧游戏逻辑</summary>
    [HttpPost("{sessionId}/tick")]
    public ActionResult<GameStateResponse> Tick(string sessionId)
    {
        var session = _gameService.Tick(sessionId);
        if (session == null)
            return NotFound(new { error = "会话不存在" });

        return Ok(_gameService.ToResponse(session));
    }

    /// <summary>小鸟跳跃</summary>
    [HttpPost("{sessionId}/flap")]
    public ActionResult<GameStateResponse> Flap(string sessionId)
    {
        var session = _gameService.Flap(sessionId);
        if (session == null)
            return NotFound(new { error = "会话不存在" });

        return Ok(_gameService.ToResponse(session));
    }

    /// <summary>获取当前游戏状态（不推进帧）</summary>
    [HttpGet("{sessionId}/state")]
    public ActionResult<GameStateResponse> GetState(string sessionId)
    {
        var session = _gameService.GetSession(sessionId);
        if (session == null)
            return NotFound(new { error = "会话不存在" });

        return Ok(_gameService.ToResponse(session));
    }
}