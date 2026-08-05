using back.Models;

namespace back.Services;

/// <summary>
/// 游戏核心逻辑服务 - 将前端游戏逻辑迁移到后端
/// 所有物理、碰撞、计分、水管/道具生成逻辑均在此处理
/// </summary>
public class GameService
{
    /* ========== 游戏常量 - 与前端 config.js 保持一致 ========== */
    private const double PIPE_WIDTH = 52;
    private const double PIPE_MIN_LENGTH = 40;
    private const double BIRD_CLEARANCE = 55;
    private const double MOVE_RANGE = 30;
    private const double MIN_SPACING = 220;
    private const double HITBOX_SHRINK = 6;

    private const double PLAYER_WIDTH = 34;
    private const double PLAYER_HEIGHT = 24;
    private const double GRAVITY = 0.18;
    private const double JUMP_VELOCITY = -3.8;
    private const double MAX_FALL_SPEED = 5;
    private const double ROTATION_LERP = 0.08;
    private const int FLAP_INTERVAL = 8;

    private const double GROUND_HEIGHT = 90;

    private const double PROP_SIZE = 32;
    private const int PROP_DURATION = 300;
    private const double PROP_SAFE_MARGIN = 24;

    /* 难度参数 */
    private const int DIFFICULTY_STEP = 5;
    private const double SPEED_BASE = 3;
    private const double SPEED_MAX = 6.5;
    private const double SPEED_INCREMENT = 0.35;
    private const double GAP_BASE = 130;
    private const double GAP_MIN = 85;
    private const double GAP_DECREMENT = 5;
    private const double INTERVAL_BASE = 100;
    private const double INTERVAL_MIN = 60;
    private const double INTERVAL_DECREMENT = 4;
    private const double PROP_INTERVAL_BASE = 180;
    private const double PROP_INTERVAL_MIN = 120;
    private const double PROP_INTERVAL_DECREMENT = 6;
    private const double PROP_INTERVAL_RANDOM = 40;

    private static readonly string[] PROP_TYPES = ["shield", "multiplier"];
    private static readonly Random _rng = new();

    /* 内存中的游戏会话 */
    private readonly Dictionary<string, GameSession> _sessions = new();

    /* ========== 公开 API ========== */

    public GameSession StartGame(int screenWidth, int screenHeight)
    {
        var session = new GameSession
        {
            ScreenWidth = screenWidth,
            ScreenHeight = screenHeight,
        };
        InitPlayer(session);
        _sessions[session.SessionId] = session;
        return session;
    }

    public GameSession? GetSession(string sessionId)
    {
        return _sessions.GetValueOrDefault(sessionId);
    }

    public GameSession? Tick(string sessionId)
    {
        var s = GetSession(sessionId);
        if (s == null || s.IsGameOver) return s;

        s.Frame++;

        /* 应用待处理的跳跃 */
        if (s.FlapPending)
        {
            s.Player.Vy = JUMP_VELOCITY;
            s.FlapPending = false;
        }

        UpdatePlayer(s);
        GeneratePipes(s);
        GenerateProps(s);
        UpdatePipes(s);
        UpdateProps(s);
        CheckCollisions(s);
        UpdatePropTimers(s);

        return s;
    }

    public GameSession? Flap(string sessionId)
    {
        var s = GetSession(sessionId);
        if (s != null && !s.IsGameOver)
        {
            s.FlapPending = true;
        }
        return s;
    }

    /* ========== 玩家逻辑 ========== */

    private void InitPlayer(GameSession s)
    {
        s.Player = new PlayerState
        {
            X = s.ScreenWidth / 4.0,
            Y = s.ScreenHeight / 2.0,
            Vy = 0,
            Rotation = 0,
            IsActive = true,
            Visible = true,
            FlapIndex = 0,
        };
    }

    private void UpdatePlayer(GameSession s)
    {
        var p = s.Player;

        /* 重力 */
        p.Vy += GRAVITY;
        p.Vy = Math.Min(p.Vy, MAX_FALL_SPEED);
        p.Y += p.Vy;

        /* 旋转角度 */
        var targetRotation = Math.Max(-20, Math.Min(p.Vy * 3.5, 45));
        p.Rotation += (targetRotation - p.Rotation) * ROTATION_LERP;

        /* 翅膀动画 */
        if (s.Frame % FLAP_INTERVAL == 0)
        {
            p.FlapIndex = (p.FlapIndex + 1) % 3;
        }

        /* 撞天花板 */
        if (p.Y <= 0)
        {
            p.Y = 0;
            p.Vy = 0.5;
        }

        /* 撞地面 -> 游戏结束 */
        var groundY = s.ScreenHeight - GROUND_HEIGHT - PLAYER_HEIGHT;
        if (p.Y >= groundY)
        {
            p.Y = groundY;
            p.IsActive = false;
            p.Visible = false;
            s.IsGameOver = true;
        }
    }

    /* ========== 难度计算 ========== */

    private (double speed, double gap, double interval, double propInterval) GetDifficulty(GameSession s)
    {
        var level = s.Score / DIFFICULTY_STEP;

        var speed = Math.Min(SPEED_BASE + level * SPEED_INCREMENT, SPEED_MAX);
        var gap = Math.Max(GAP_BASE - level * GAP_DECREMENT, GAP_MIN);
        var interval = Math.Max(INTERVAL_BASE - level * INTERVAL_DECREMENT, INTERVAL_MIN);
        var propInterval = Math.Max(PROP_INTERVAL_BASE - level * PROP_INTERVAL_DECREMENT, PROP_INTERVAL_MIN);

        return (speed, gap, interval, propInterval);
    }

    /* ========== 水管生成 ========== */

    private void GeneratePipes(GameSession s)
    {
        var (speed, gap, interval, _) = GetDifficulty(s);

        s.PipeTimer--;
        if (s.PipeTimer > 0) return;

        /* 检查上一对水管是否已走远 */
        if (s.Pipes.Count > 0)
        {
            var lastPipe = s.Pipes[^1];
            if (lastPipe.X > s.ScreenWidth - MIN_SPACING)
                return;
        }

        var pipe = CreatePipe(s, gap, speed);
        s.Pipes.Add(pipe);
        s.PipeTimer = (int)interval;
    }

    private PipeState CreatePipe(GameSession s, double gap, double speed)
    {
        var pipe = new PipeState
        {
            X = s.ScreenWidth,
            Gap = gap,
            Speed = speed,
            MovePhase = _rng.NextDouble() * Math.PI * 2,
        };

        /* 随机水管类型 */
        var rand = _rng.NextDouble();
        if (rand < 0.45)
            pipe.Type = 0;  /* Normal */
        else if (rand < 0.65)
            pipe.Type = 1;  /* TopOnly */
        else if (rand < 0.85)
            pipe.Type = 2;  /* BottomOnly */
        else
            pipe.Type = 3;  /* Moving */

        CalcGapPosition(s, pipe);
        return pipe;
    }

    private void CalcGapPosition(GameSession s, PipeState pipe)
    {
        var availableH = s.ScreenHeight - GROUND_HEIGHT;

        switch (pipe.Type)
        {
            case 1: /* TopOnly */
            {
                var maxTop = availableH - BIRD_CLEARANCE;
                pipe.GapY = PIPE_MIN_LENGTH + _rng.NextDouble() * Math.Max(0, maxTop - PIPE_MIN_LENGTH);
                break;
            }
            case 2: /* BottomOnly */
            {
                var minBottom = BIRD_CLEARANCE;
                var maxBottom = availableH - PIPE_MIN_LENGTH;
                pipe.GapY = minBottom + _rng.NextDouble() * Math.Max(0, maxBottom - minBottom);
                break;
            }
            case 3: /* Moving */
            {
                var minGapY = PIPE_MIN_LENGTH;
                var maxGapY = availableH - pipe.Gap - PIPE_MIN_LENGTH;
                if (maxGapY <= minGapY)
                {
                    pipe.Gap = Math.Max(BIRD_CLEARANCE, availableH - PIPE_MIN_LENGTH * 2);
                    pipe.GapY = PIPE_MIN_LENGTH;
                }
                else
                {
                    pipe.GapY = minGapY + _rng.NextDouble() * (maxGapY - minGapY);
                }
                pipe.BaseGapY = pipe.GapY;
                break;
            }
            default: /* Normal */
            {
                var minGapY = PIPE_MIN_LENGTH;
                var maxGapY = availableH - pipe.Gap - PIPE_MIN_LENGTH;
                if (maxGapY <= minGapY)
                {
                    pipe.Gap = Math.Max(BIRD_CLEARANCE, availableH - PIPE_MIN_LENGTH * 2);
                    pipe.GapY = PIPE_MIN_LENGTH;
                }
                else
                {
                    pipe.GapY = minGapY + _rng.NextDouble() * (maxGapY - minGapY);
                }
                break;
            }
        }
    }

    private void UpdatePipes(GameSession s)
    {
        for (int i = s.Pipes.Count - 1; i >= 0; i--)
        {
            var pipe = s.Pipes[i];
            pipe.X -= pipe.Speed;

            /* 移动管上下摆动 */
            if (pipe.Type == 3)
            {
                pipe.MovePhase += 0.03;
                var offset = Math.Sin(pipe.MovePhase) * MOVE_RANGE;
                pipe.GapY = pipe.BaseGapY + offset;
                var availableH = s.ScreenHeight - GROUND_HEIGHT;
                pipe.GapY = Math.Max(PIPE_MIN_LENGTH,
                    Math.Min(pipe.GapY, availableH - pipe.Gap - PIPE_MIN_LENGTH));
            }

            /* 移除屏幕外的水管 */
            if (pipe.X + PIPE_WIDTH < -20)
            {
                s.Pipes.RemoveAt(i);
            }
        }
    }

    /* ========== 道具生成 ========== */

    private void GenerateProps(GameSession s)
    {
        var (speed, _, _, propInterval) = GetDifficulty(s);

        s.PropTimer--;
        if (s.PropTimer > 0) return;

        var prop = CreateProp(s, speed);
        s.Props.Add(prop);

        s.PropTimer = (int)(propInterval + _rng.NextDouble() * PROP_INTERVAL_RANDOM);
    }

    private PropState CreateProp(GameSession s, double pipeSpeed)
    {
        var prop = new PropState
        {
            Type = PROP_TYPES[_rng.Next(PROP_TYPES.Length)],
            X = s.ScreenWidth + 30,
            Speed = pipeSpeed,
            AnimPhase = _rng.NextDouble() * Math.PI * 2,
        };

        prop.Y = FindSafePropY(s, prop);
        return prop;
    }

    private double FindSafePropY(GameSession s, PropState prop)
    {
        var safeTop = 50.0;
        var safeBottom = s.ScreenHeight - GROUND_HEIGHT - 30.0;

        /* 找到距离道具最近的水管 */
        PipeState? bestPipe = null;
        var bestDist = double.MaxValue;

        foreach (var pipe in s.Pipes)
        {
            var dist = Math.Abs(pipe.X - prop.X);
            if (dist < bestDist)
            {
                bestDist = dist;
                bestPipe = pipe;
            }
        }

        if (bestPipe != null)
        {
            var hasTop = bestPipe.Type == 0 || bestPipe.Type == 1 || bestPipe.Type == 3;
            var hasBottom = bestPipe.Type == 0 || bestPipe.Type == 2 || bestPipe.Type == 3;

            if (hasTop && hasBottom)
            {
                var gapCenter = bestPipe.GapY + bestPipe.Gap / 2;
                return Math.Max(safeTop + PROP_SIZE, Math.Min(gapCenter, safeBottom - PROP_SIZE));
            }
            else if (hasBottom)
            {
                return Math.Max(safeTop + PROP_SIZE, bestPipe.GapY - PROP_SAFE_MARGIN - PROP_SIZE);
            }
            else if (hasTop)
            {
                return Math.Min(safeBottom - PROP_SIZE, bestPipe.GapY + PROP_SAFE_MARGIN + PROP_SIZE);
            }
        }

        return (safeTop + safeBottom) / 2;
    }

    private void UpdateProps(GameSession s)
    {
        for (int i = s.Props.Count - 1; i >= 0; i--)
        {
            var prop = s.Props[i];
            prop.X -= prop.Speed;

            if (prop.X + PROP_SIZE < -10)
            {
                s.Props.RemoveAt(i);
            }
        }
    }

    /* ========== 碰撞检测 ========== */

    private void CheckCollisions(GameSession s)
    {
        var p = s.Player;
        if (!p.IsActive || !p.Visible) return;

        /* 水管碰撞 */
        for (int i = s.Pipes.Count - 1; i >= 0; i--)
        {
            var pipe = s.Pipes[i];

            if (IsPipeCollideWithBird(s, pipe, p))
            {
                if (s.ShieldActive)
                {
                    s.Pipes.RemoveAt(i);
                    continue;
                }
                p.IsActive = false;
                p.Visible = false;
                s.IsGameOver = true;
                return;
            }

            /* 通过水管，计分 */
            if (!pipe.Scored && pipe.X + PIPE_WIDTH < p.X)
            {
                pipe.Scored = true;
                s.Score += s.ScoreMultiplier;
            }
        }

        /* 道具碰撞 */
        for (int i = s.Props.Count - 1; i >= 0; i--)
        {
            var prop = s.Props[i];
            if (prop.Collected) continue;

            if (IsPropCollideWithPlayer(prop, p))
            {
                CollectProp(s, prop);
            }
        }
    }

    private bool IsPipeCollideWithBird(GameSession s, PipeState pipe, PlayerState p)
    {
        var bx = p.X + HITBOX_SHRINK;
        var by = p.Y + HITBOX_SHRINK;
        var bw = PLAYER_WIDTH - HITBOX_SHRINK * 2;
        var bh = PLAYER_HEIGHT - HITBOX_SHRINK * 2;

        var px = pipe.X + 2;
        var pw = PIPE_WIDTH - 4;

        var availableH = s.ScreenHeight - GROUND_HEIGHT;
        var hasTop = pipe.Type == 0 || pipe.Type == 1 || pipe.Type == 3;
        var hasBottom = pipe.Type == 0 || pipe.Type == 2 || pipe.Type == 3;

        /* AABB X轴检测 */
        if (bx + bw <= px || bx >= px + pw) return false;

        /* 上管碰撞 */
        if (hasTop && by < pipe.GapY) return true;

        /* 下管碰撞 */
        if (hasBottom)
        {
            var bottomY = pipe.GapY + (hasTop ? pipe.Gap : 0);
            if (by + bh > bottomY && bottomY < availableH) return true;
        }

        return false;
    }

    private bool IsPropCollideWithPlayer(PropState prop, PlayerState p)
    {
        var pcx = p.X + PLAYER_WIDTH / 2;
        var pcy = p.Y + PLAYER_HEIGHT / 2;
        var propCx = prop.X + PROP_SIZE / 2;
        var propCy = prop.Y + PROP_SIZE / 2;

        var dx = pcx - propCx;
        var dy = pcy - propCy;
        var dist = Math.Sqrt(dx * dx + dy * dy);

        return dist < (PLAYER_WIDTH / 2 + PROP_SIZE / 2);
    }

    private void CollectProp(GameSession s, PropState prop)
    {
        prop.Collected = true;

        switch (prop.Type)
        {
            case "shield":
                s.ShieldActive = true;
                s.ShieldTimer = PROP_DURATION;
                break;
            case "multiplier":
                s.ScoreMultiplier = 2;
                s.MultiplierTimer = PROP_DURATION;
                break;
        }
    }

    /* ========== 道具计时更新 ========== */

    private void UpdatePropTimers(GameSession s)
    {
        if (s.ShieldActive)
        {
            s.ShieldTimer--;
            if (s.ShieldTimer <= 0) s.ShieldActive = false;
        }
        if (s.ScoreMultiplier > 1)
        {
            s.MultiplierTimer--;
            if (s.MultiplierTimer <= 0) s.ScoreMultiplier = 1;
        }
    }

    /* ========== 状态映射 ========== */

    public GameStateResponse ToResponse(GameSession s)
    {
        return new GameStateResponse
        {
            SessionId = s.SessionId,
            Player = new PlayerDto
            {
                X = s.Player.X,
                Y = s.Player.Y,
                Vy = s.Player.Vy,
                Rotation = s.Player.Rotation,
                IsActive = s.Player.IsActive,
                Visible = s.Player.Visible,
                FlapIndex = s.Player.FlapIndex,
            },
            Pipes = s.Pipes.Select(p => new PipeDto
            {
                X = p.X,
                GapY = p.GapY,
                Gap = p.Gap,
                Type = p.Type,
                Speed = p.Speed,
                Scored = p.Scored,
                IsMoving = p.IsMoving,
            }).ToList(),
            Props = s.Props.Where(p => !p.Collected).Select(p => new PropDto
            {
                X = p.X,
                Y = p.Y,
                Type = p.Type,
                Collected = p.Collected,
                AnimPhase = p.AnimPhase,
            }).ToList(),
            Score = s.Score,
            IsGameOver = s.IsGameOver,
            Frame = s.Frame,
            ShieldActive = s.ShieldActive,
            ShieldTimer = s.ShieldTimer,
            ScoreMultiplier = s.ScoreMultiplier,
            MultiplierTimer = s.MultiplierTimer,
        };
    }
}