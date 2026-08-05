namespace back.Models;

/* ========== 游戏会话（内存中维护） ========== */
public class GameSession
{
    public string SessionId { get; set; } = Guid.NewGuid().ToString("N")[..8];
    public PlayerState Player { get; set; } = new();
    public List<PipeState> Pipes { get; set; } = [];
    public List<PropState> Props { get; set; } = [];
    public int Score { get; set; }
    public bool IsGameOver { get; set; }
    public int Frame { get; set; }
    public int ScreenWidth { get; set; } = 375;
    public int ScreenHeight { get; set; } = 667;

    /* 难度参数 */
    public double Speed { get; set; } = 3;
    public double Gap { get; set; } = 130;

    /* 计时器 */
    public int PipeTimer { get; set; }
    public int PropTimer { get; set; }

    /* 道具状态 */
    public bool ShieldActive { get; set; }
    public int ShieldTimer { get; set; }
    public int ScoreMultiplier { get; set; } = 1;
    public int MultiplierTimer { get; set; }

    /* 待处理的跳跃 */
    public bool FlapPending { get; set; }
}

/* ========== 玩家 ========== */
public class PlayerState
{
    public double X { get; set; }
    public double Y { get; set; }
    public double Vy { get; set; }
    public double Rotation { get; set; }
    public bool IsActive { get; set; } = true;
    public bool Visible { get; set; } = true;
    public int FlapIndex { get; set; }
}

/* ========== 水管 ========== */
public class PipeState
{
    public double X { get; set; }
    public double GapY { get; set; }
    public double Gap { get; set; } = 130;
    public int Type { get; set; }       /* 0:Normal 1:TopOnly 2:BottomOnly 3:Moving */
    public double Speed { get; set; } = 3;
    public bool Scored { get; set; }
    public double BaseGapY { get; set; }
    public double MovePhase { get; set; }
    public bool IsMoving => Type == 3;
}

/* ========== 道具 ========== */
public class PropState
{
    public double X { get; set; }
    public double Y { get; set; }
    public string Type { get; set; } = "shield";   /* "shield" | "multiplier" */
    public bool Collected { get; set; }
    public double Speed { get; set; } = 3;
    public double AnimPhase { get; set; }

    /// <summary>关联的水管（用于移动水管时道具跟随gap移动），不序列化到API响应</summary>
    [System.Text.Json.Serialization.JsonIgnore]
    public PipeState? ParentPipe { get; set; }
}