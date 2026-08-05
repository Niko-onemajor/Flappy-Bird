namespace back.Models;

/* ========== 请求 ========== */
public class GameInitRequest
{
    public int ScreenWidth { get; set; } = 375;
    public int ScreenHeight { get; set; } = 667;
}

public class SubmitScoreRequest
{
    public string PlayerName { get; set; } = "Anonymous";
    public int Score { get; set; }
}

/* ========== 响应 ========== */
public class GameStateResponse
{
    public string SessionId { get; set; } = "";
    public PlayerDto Player { get; set; } = null!;
    public List<PipeDto> Pipes { get; set; } = [];
    public List<PropDto> Props { get; set; } = [];
    public int Score { get; set; }
    public bool IsGameOver { get; set; }
    public int Frame { get; set; }
    public bool ShieldActive { get; set; }
    public int ShieldTimer { get; set; }
    public int ScoreMultiplier { get; set; }
    public int MultiplierTimer { get; set; }
}

public class PlayerDto
{
    public double X { get; set; }
    public double Y { get; set; }
    public double Vy { get; set; }
    public double Rotation { get; set; }
    public bool IsActive { get; set; }
    public bool Visible { get; set; }
    public int FlapIndex { get; set; }
}

public class PipeDto
{
    public double X { get; set; }
    public double GapY { get; set; }
    public double Gap { get; set; }
    public int Type { get; set; }
    public double Speed { get; set; }
    public bool Scored { get; set; }
    public bool IsMoving { get; set; }
}

public class PropDto
{
    public double X { get; set; }
    public double Y { get; set; }
    public string Type { get; set; } = "";
    public bool Collected { get; set; }
    public double AnimPhase { get; set; }
}

public class HighScoreDto
{
    public int Id { get; set; }
    public string PlayerName { get; set; } = "";
    public int Score { get; set; }
    public DateTime CreatedAt { get; set; }
}