"""
道具/障碍物位置验证脚本 —— 模拟多轮游戏运行，验证所有实体位置是否合理。
复刻 front/js/main.js + npc/*.js 的核心逻辑：水管生成、道具生成、圆锯生成、火箭生成、难度递增。
"""
import math
import random
import sys
from dataclasses import dataclass, field
from typing import List, Tuple, Optional


# ==================== 常量（与 front/js/main.js + render.js 完全一致）====================
SCREEN_WIDTH = 932      # 设计分辨率（横屏）
SCREEN_HEIGHT = 430
GROUND_HEIGHT = 90
AVAILABLE_H = SCREEN_HEIGHT - GROUND_HEIGHT  # 340

# 水管配置
PIPE_WIDTH = 52
PIPE_MIN_LENGTH = 40
BIRD_CLEARANCE = 80
MOVE_RANGE = 30
MIN_SPACING = 220
HITBOX_SHRINK = 6

# 难度参数（与 main.js 保持一致）
DIFFICULTY_STEP = 6
SPEED_BASE = 4.2
SPEED_MAX = 18
SPEED_INCREMENT = 0.45
GAP_BASE = 112
GAP_MIN = 58
GAP_DECREMENT = 2
INTERVAL_BASE = 85
INTERVAL_MIN = 30
INTERVAL_DECREMENT = 2
PROP_CHANCE_BASE = 0.35
PROP_CHANCE_INCREMENT = 0.03
PROP_COOLDOWN_MIN = 120  # 道具最小间隔帧数（2秒）

# 道具配置
PROP_SIZE = 32
PROP_SAFE_MARGIN = 24
PROP_TYPES = ["shield", "multiplier"]
PROP_SAFE_TOP = 50
PROP_SAFE_BOTTOM = SCREEN_HEIGHT - GROUND_HEIGHT - 30  # 310

# 圆锯配置
SAW_RADIUS = 22
SAW_SIZE = SAW_RADIUS * 2
SAW_MIN_SCORE = 5
SAW_SPAWN_CHANCE = 0.45
SAW_MAX_COUNT = 8

# 火箭配置
ROCKET_W = 50
ROCKET_H = 24
ROCKET_MIN_SCORE = 10
ROCKET_MAX_COUNT = 6
ROCKET_TRACK_DURATION = 120

# 管道类型
PIPE_TYPE = {
    "NORMAL": 0,
    "TOP_ONLY": 1,
    "BOTTOM_ONLY": 2,
    "MOVING": 3,
}

MAX_FRAMES = 3000  # 每轮最多模拟帧数


# ==================== 数据模型 ====================
@dataclass
class PipeState:
    x: float
    gap_y: float
    gap: float
    speed: float
    pipe_type: int  # 0:Normal 1:TopOnly 2:BottomOnly 3:Moving
    scored: bool = False
    base_gap_y: float = 0.0
    move_phase: float = 0.0

    @property
    def is_moving(self) -> bool:
        return self.pipe_type == PIPE_TYPE["MOVING"]

    @property
    def has_top(self) -> bool:
        return self.pipe_type in (PIPE_TYPE["NORMAL"], PIPE_TYPE["TOP_ONLY"], PIPE_TYPE["MOVING"])

    @property
    def has_bottom(self) -> bool:
        return self.pipe_type in (PIPE_TYPE["NORMAL"], PIPE_TYPE["BOTTOM_ONLY"], PIPE_TYPE["MOVING"])


@dataclass
class PropState:
    x: float
    y: float
    prop_type: str
    speed: float
    anim_phase: float
    parent_pipe: Optional[PipeState] = None
    collected: bool = False


@dataclass
class SawState:
    x: float
    y: float
    speed: float
    rotation: float
    host_pipe: PipeState


@dataclass
class RocketState:
    x: float
    y: float
    speed: float
    angle: float
    state: str  # "tracking" | "flying"
    track_timer: int
    tracked_x: float = 0
    tracked_y: float = 0


# ==================== 游戏逻辑模拟器 ====================
class GameSimulator:
    def __init__(self, seed: int):
        self.rng = random.Random(seed)
        self.pipes: List[PipeState] = []
        self.props: List[PropState] = []
        self.saws: List[SawState] = []
        self.rockets: List[RocketState] = []
        self.score = 0
        self.frame = 0
        self.pipe_timer = 0
        self.prop_timer = 0
        self.rocket_timer = 0
        self.pipes_since_last_prop = 0
        self.is_game_over = False

        # 玩家位置（小鸟位于屏幕约 1/4 处）
        self.player_x = SCREEN_WIDTH / 4
        self.player_y = SCREEN_HEIGHT / 2

        # 统计
        self.total_props = 0
        self.total_saws = 0
        self.total_rockets = 0
        self.errors: List[str] = []

    # ========== 难度计算 ==========
    def get_difficulty(self) -> Tuple[float, float, float, float]:
        level = self.score / DIFFICULTY_STEP
        speed = min(SPEED_BASE + level * SPEED_INCREMENT, SPEED_MAX)
        gap = max(GAP_BASE - level * GAP_DECREMENT, GAP_MIN)
        interval = max(INTERVAL_BASE - level * INTERVAL_DECREMENT, INTERVAL_MIN)
        prop_chance = min(PROP_CHANCE_BASE + level * PROP_CHANCE_INCREMENT, 0.65)
        return speed, gap, interval, prop_chance

    # ========== 水管逻辑 ==========
    def calc_gap_position(self, pipe: PipeState):
        """复刻 Pipe._calcGapPosition()"""
        if pipe.pipe_type == PIPE_TYPE["TOP_ONLY"]:
            max_top = AVAILABLE_H - BIRD_CLEARANCE
            pipe.gap_y = PIPE_MIN_LENGTH + self.rng.random() * max(0, max_top - PIPE_MIN_LENGTH)
        elif pipe.pipe_type == PIPE_TYPE["BOTTOM_ONLY"]:
            min_bottom = BIRD_CLEARANCE
            max_bottom = AVAILABLE_H - PIPE_MIN_LENGTH
            pipe.gap_y = min_bottom + self.rng.random() * max(0, max_bottom - min_bottom)
        else:
            # NORMAL / MOVING
            min_gap_y = PIPE_MIN_LENGTH
            max_gap_y = AVAILABLE_H - pipe.gap - PIPE_MIN_LENGTH
            if max_gap_y <= min_gap_y:
                actual_gap = max(BIRD_CLEARANCE, AVAILABLE_H - PIPE_MIN_LENGTH * 2)
                pipe.gap = actual_gap
                pipe.gap_y = PIPE_MIN_LENGTH
            else:
                pipe.gap_y = min_gap_y + self.rng.random() * (max_gap_y - min_gap_y)
            if pipe.pipe_type == PIPE_TYPE["MOVING"]:
                pipe.base_gap_y = pipe.gap_y

    def create_pipe(self, gap: float, speed: float) -> PipeState:
        """复刻 Pipe.init()"""
        pipe = PipeState(
            x=SCREEN_WIDTH,
            gap_y=0,
            gap=gap,
            speed=speed,
            pipe_type=0,
            move_phase=self.rng.random() * math.pi * 2,
        )
        rand = self.rng.random()
        if rand < 0.45:
            pipe.pipe_type = PIPE_TYPE["NORMAL"]
        elif rand < 0.65:
            pipe.pipe_type = PIPE_TYPE["TOP_ONLY"]
        elif rand < 0.85:
            pipe.pipe_type = PIPE_TYPE["BOTTOM_ONLY"]
        else:
            pipe.pipe_type = PIPE_TYPE["MOVING"]
        self.calc_gap_position(pipe)
        return pipe

    # ========== 道具逻辑 ==========
    def create_prop_for_pipe(self, pipe: PipeState) -> PropState:
        """复刻 Prop.init() + Prop._findSafeY()"""
        prop = PropState(
            x=pipe.x + PIPE_WIDTH / 2 - PROP_SIZE / 2 + (self.rng.random() - 0.5) * 20,
            y=0,
            prop_type=self.rng.choice(PROP_TYPES),
            speed=pipe.speed,
            anim_phase=self.rng.random() * math.pi * 2,
            parent_pipe=pipe,
        )
        prop.y = self._find_safe_y(pipe)
        return prop

    def _find_safe_y(self, pipe: PipeState) -> float:
        """复刻 Prop._findSafeY()"""
        safe_top = PROP_SAFE_TOP
        safe_bottom = PROP_SAFE_BOTTOM

        if pipe.has_top and pipe.has_bottom:
            gap_center = pipe.gap_y + pipe.gap / 2
            return max(safe_top, min(gap_center - PROP_SIZE / 2, safe_bottom - PROP_SIZE))
        elif pipe.has_bottom:
            passage_mid = (0 + pipe.gap_y) / 2
            return max(safe_top, min(passage_mid - PROP_SIZE / 2, safe_bottom - PROP_SIZE))
        elif pipe.has_top:
            passage_mid = (pipe.gap_y + safe_bottom + PROP_SIZE) / 2
            return max(safe_top, min(passage_mid - PROP_SIZE / 2, safe_bottom - PROP_SIZE))
        # 兜底
        return (safe_top + safe_bottom - PROP_SIZE) / 2

    # ========== 圆锯逻辑 ==========
    def create_saw_for_pipe(self, pipe: PipeState, speed: float) -> SawState:
        """复刻 Saw.init() + Saw._calcSawY()"""
        saw = SawState(
            x=SCREEN_WIDTH + 180 + self.rng.random() * 120,
            y=0,
            speed=speed,
            rotation=self.rng.random() * math.pi * 2,
            host_pipe=pipe,
        )
        saw.y = self._calc_saw_y(pipe)
        return saw

    def _calc_saw_y(self, pipe: PipeState) -> float:
        """复刻 Saw._calcSawY()"""
        safe_top = 50
        safe_bottom = AVAILABLE_H - SAW_SIZE - 10
        margin = 8

        if pipe.has_top and pipe.has_bottom:
            if self.rng.random() < 0.5:
                y = pipe.gap_y - SAW_SIZE - margin
                return max(safe_top, y)
            else:
                y = pipe.gap_y + pipe.gap + margin
                return min(safe_bottom, y)

        if pipe.has_bottom:
            y = pipe.gap_y - SAW_SIZE - margin
            return max(safe_top, y)

        if pipe.has_top:
            y = pipe.gap_y + margin
            return min(safe_bottom, y)

        return (safe_top + safe_bottom) / 2

    # ========== 火箭逻辑 ==========
    def get_rocket_level(self, score: int) -> Tuple[int, int]:
        """复刻 Main._getRocketLevel()"""
        level = max(0, (score - ROCKET_MIN_SCORE) // 8) + 1
        max_rockets = min(level, 3)
        cooldown = max(150 - (level - 1) * 20, 60) + self.rng.randint(0, 19)
        return max_rockets, cooldown

    def create_rocket(self, speed: float) -> RocketState:
        """复刻 Rocket.init()"""
        rocket = RocketState(
            x=SCREEN_WIDTH + 30 + self.rng.random() * 50,
            y=40 + self.rng.random() * (AVAILABLE_H - ROCKET_H - 40),
            speed=speed * 1.2,
            angle=0,
            state="tracking",
            track_timer=ROCKET_TRACK_DURATION,
            tracked_x=self.player_x,
            tracked_y=self.player_y,
        )
        return rocket

    # ========== 生成逻辑 ==========
    def generate_pipes(self):
        """复刻 Main._generatePipes()"""
        speed, gap, interval, prop_chance = self.get_difficulty()

        self.pipe_timer -= 1
        if self.pipe_timer > 0:
            return

        if self.pipes:
            last_pipe = self.pipes[-1]
            if last_pipe.x > SCREEN_WIDTH - MIN_SPACING:
                return

        pipe = self.create_pipe(gap, speed)
        self.pipes.append(pipe)
        self.pipe_timer = max(int(interval), 30)

        # 道具生成
        self.pipes_since_last_prop += 1
        props_available = len([p for p in self.props if not p.collected])

        # 保底机制：每5根水管必出
        if self.pipes_since_last_prop >= 5 and props_available < 3:
            prop = self.create_prop_for_pipe(pipe)
            self.props.append(prop)
            self.total_props += 1
            self.prop_timer = PROP_COOLDOWN_MIN + self.rng.randint(0, 59)
            self.pipes_since_last_prop = 0
            self.verify_prop(prop)
        # 随机生成
        elif self.prop_timer <= 0 and self.rng.random() < prop_chance and props_available < 3:
            prop = self.create_prop_for_pipe(pipe)
            self.props.append(prop)
            self.total_props += 1
            self.prop_timer = PROP_COOLDOWN_MIN + self.rng.randint(0, 59)
            self.pipes_since_last_prop = 0
            self.verify_prop(prop)
        elif self.prop_timer <= 0:
            self.prop_timer = 30

        # 圆锯生成
        if self.score >= SAW_MIN_SCORE and self.rng.random() < SAW_SPAWN_CHANCE and len(self.saws) < SAW_MAX_COUNT:
            saw = self.create_saw_for_pipe(pipe, speed)
            self.saws.append(saw)
            self.total_saws += 1
            self.verify_saw(saw)

    def try_generate_rocket(self):
        """复刻 Main._tryGenerateRocket()"""
        if self.score < ROCKET_MIN_SCORE:
            return

        max_rockets, cooldown = self.get_rocket_level(self.score)
        if len(self.rockets) >= max_rockets:
            return

        self.rocket_timer -= 1
        if self.rocket_timer > 0:
            return

        speed, _, _, _ = self.get_difficulty()
        rocket = self.create_rocket(speed)
        self.rockets.append(rocket)
        self.total_rockets += 1
        self.rocket_timer = cooldown
        self.verify_rocket(rocket)

    # ========== 更新逻辑 ==========
    def update_pipes(self):
        for i in range(len(self.pipes) - 1, -1, -1):
            pipe = self.pipes[i]
            pipe.x -= pipe.speed

            if pipe.is_moving:
                pipe.move_phase += 0.03
                offset = math.sin(pipe.move_phase) * MOVE_RANGE
                pipe.gap_y = pipe.base_gap_y + offset
                pipe.gap_y = max(PIPE_MIN_LENGTH, min(pipe.gap_y, AVAILABLE_H - pipe.gap - PIPE_MIN_LENGTH))

            if pipe.x + PIPE_WIDTH < -20:
                self.pipes.pop(i)

    def update_props(self):
        for i in range(len(self.props) - 1, -1, -1):
            prop = self.props[i]
            if prop.collected:
                continue
            prop.x -= prop.speed
            # 跟随移动水管
            if prop.parent_pipe is not None and prop.parent_pipe.is_moving:
                p = prop.parent_pipe
                gap_center = p.gap_y + p.gap / 2
                new_y = gap_center - PROP_SIZE / 2
                min_y = p.gap_y + PROP_SAFE_MARGIN
                max_y = p.gap_y + p.gap - PROP_SAFE_MARGIN - PROP_SIZE
                prop.y = max(min_y, min(max_y, new_y))
            if prop.x + PROP_SIZE < -10:
                self.props.pop(i)

    def update_saws(self):
        for i in range(len(self.saws) - 1, -1, -1):
            saw = self.saws[i]
            saw.x -= saw.speed
            if saw.x + SAW_SIZE < -20:
                self.saws.pop(i)

    def update_rockets(self):
        for i in range(len(self.rockets) - 1, -1, -1):
            rocket = self.rockets[i]
            if rocket.state == "tracking":
                rocket.x -= rocket.speed * 0.3
                rocket.track_timer -= 1
                if rocket.track_timer <= 0:
                    # 锁定发射
                    rocket.state = "flying"
                    rocket.angle = math.atan2(rocket.tracked_y - rocket.y, rocket.tracked_x - rocket.x)
            else:
                # 飞行阶段
                rocket.x += math.cos(rocket.angle) * rocket.speed
                rocket.y += math.sin(rocket.angle) * rocket.speed

            # 超出屏幕移除
            if (rocket.x + ROCKET_W < -30 or rocket.x > SCREEN_WIDTH + 300
                    or rocket.y + ROCKET_H < -30 or rocket.y > SCREEN_HEIGHT + 30):
                self.rockets.pop(i)

    def simulate_scoring(self):
        for pipe in self.pipes:
            if not pipe.scored and pipe.x + PIPE_WIDTH < self.player_x:
                pipe.scored = True
                self.score += 1

    # ========== 验证逻辑 ==========
    def verify_prop(self, prop: PropState):
        """验证道具位置是否合理"""
        pipe = prop.parent_pipe
        if pipe is None:
            return

        # 1. 道具必须在屏幕范围内
        if prop.y < 0:
            self.errors.append(
                f"[Score={self.score}] 道具Y<0: prop.y={prop.y:.1f}, pipe_type={pipe.pipe_type}, "
                f"gap_y={pipe.gap_y:.1f}, gap={pipe.gap:.1f}"
            )
        if prop.y + PROP_SIZE > AVAILABLE_H:
            self.errors.append(
                f"[Score={self.score}] 道具超出地面: prop.bottom={prop.y + PROP_SIZE:.1f}, "
                f"availableH={AVAILABLE_H}, pipe_type={pipe.pipe_type}"
            )

        # 2. 对于双管，道具必须在间隙内（或非常接近）
        if pipe.has_top and pipe.has_bottom:
            gap_top = pipe.gap_y
            gap_bottom = pipe.gap_y + pipe.gap
            if prop.y < gap_top or prop.y + PROP_SIZE > gap_bottom:
                if prop.y < gap_top - 5 or prop.y + PROP_SIZE > gap_bottom + 5:
                    self.errors.append(
                        f"[Score={self.score}] 道具不在间隙内: prop[y={prop.y:.1f},{prop.y + PROP_SIZE:.1f}], "
                        f"gap=[{gap_top:.1f},{gap_bottom:.1f}], pipe_type={pipe.pipe_type}"
                    )

    def verify_saw(self, saw: SawState):
        """验证圆锯位置是否合理"""
        pipe = saw.host_pipe

        # 1. 圆锯必须在屏幕垂直范围内
        if saw.y < 0:
            self.errors.append(
                f"[Score={self.score}] 圆锯Y<0: saw.y={saw.y:.1f}, pipe_type={pipe.pipe_type}"
            )
        if saw.y + SAW_SIZE > AVAILABLE_H:
            self.errors.append(
                f"[Score={self.score}] 圆锯超出地面: saw.bottom={saw.y + SAW_SIZE:.1f}, "
                f"availableH={AVAILABLE_H}, pipe_type={pipe.pipe_type}"
            )

        # 2. 圆锯不能堵死玩家通路
        if pipe.has_top and pipe.has_bottom:
            # 双管：圆锯必须在间隙上方或下方，不能堵在间隙中间
            gap_top = pipe.gap_y
            gap_bottom = pipe.gap_y + pipe.gap
            saw_center = saw.y + SAW_SIZE / 2
            if gap_top < saw_center < gap_bottom:
                self.errors.append(
                    f"[Score={self.score}] 圆锯堵在间隙中: saw[y={saw.y:.1f},{saw.y + SAW_SIZE:.1f}], "
                    f"gap=[{gap_top:.1f},{gap_bottom:.1f}], pipe_type={pipe.pipe_type}"
                )

    def verify_rocket(self, rocket: RocketState):
        """验证火箭初始位置是否合理"""
        # 1. 火箭必须在屏幕范围内生成
        if rocket.y < 0:
            self.errors.append(
                f"[Score={self.score}] 火箭Y<0: rocket.y={rocket.y:.1f}"
            )
        if rocket.y + ROCKET_H > AVAILABLE_H:
            self.errors.append(
                f"[Score={self.score}] 火箭超出地面: rocket.bottom={rocket.y + ROCKET_H:.1f}, "
                f"availableH={AVAILABLE_H}"
            )
        if rocket.x < SCREEN_WIDTH:
            self.errors.append(
                f"[Score={self.score}] 火箭不在屏幕右侧: rocket.x={rocket.x:.1f}, screenW={SCREEN_WIDTH}"
            )

    # ========== 主循环 ==========
    def tick(self):
        if self.is_game_over:
            return

        self.frame += 1
        self.generate_pipes()
        self.try_generate_rocket()
        self.update_pipes()
        self.update_props()
        self.update_saws()
        self.update_rockets()
        self.simulate_scoring()

        # 道具冷却计时器
        if self.prop_timer > 0:
            self.prop_timer -= 1

        # 模拟玩家死亡：随得分增加死亡概率上升
        death_chance = min(0.0005 + self.score * 0.0001, 0.015)
        if self.rng.random() < death_chance:
            self.is_game_over = True
        elif self.frame >= MAX_FRAMES:
            self.is_game_over = True

    def run(self):
        while not self.is_game_over:
            self.tick()


# ==================== 测试主程序 ====================
def main():
    rounds = int(sys.argv[1]) if len(sys.argv) > 1 else 200
    print(f"道具/障碍物位置验证 - 运行 {rounds} 轮模拟游戏")
    print(f"设计分辨率: {SCREEN_WIDTH}×{SCREEN_HEIGHT} (可用高度: {AVAILABLE_H})")
    print(f"常量: SPEED_BASE={SPEED_BASE}, GAP_BASE={GAP_BASE}, INTERVAL_BASE={INTERVAL_BASE}")
    print(f"      SPEED_MAX={SPEED_MAX}, GAP_MIN={GAP_MIN}, INTERVAL_MIN={INTERVAL_MIN}")
    print(f"      DIFFICULTY_STEP={DIFFICULTY_STEP}")
    print(f"障碍物: 圆锯≥{SAW_MIN_SCORE}分(概率{SAW_SPAWN_CHANCE*100:.0f}%), 火箭≥{ROCKET_MIN_SCORE}分")
    print()

    all_errors: List[str] = []
    total_props = 0
    total_saws = 0
    total_rockets = 0
    scores: List[int] = []
    error_rounds = 0

    for r in range(rounds):
        sim = GameSimulator(seed=r * 100 + 42)
        sim.run()
        total_props += sim.total_props
        total_saws += sim.total_saws
        total_rockets += sim.total_rockets
        scores.append(sim.score)

        if sim.errors:
            error_rounds += 1
            all_errors.extend(sim.errors)

        if (r + 1) % 50 == 0:
            print(f"  已运行 {r + 1}/{rounds} 轮... "
                  f"(道具:{total_props}, 圆锯:{total_saws}, 火箭:{total_rockets}, 问题轮次:{error_rounds})")

    print()
    print("=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    print(f"总轮次:       {rounds}")
    print(f"总道具数:     {total_props}")
    print(f"总圆锯数:     {total_saws}")
    print(f"总火箭数:     {total_rockets}")
    print(f"问题轮次:     {error_rounds}")
    print(f"问题实体数:   {len(all_errors)}")
    print(f"平均得分:     {sum(scores) / len(scores):.1f}")
    print(f"最高得分:     {max(scores)}")
    print(f"最低得分:     {min(scores)}")

    if all_errors:
        print()
        print("-" * 60)
        print(f"发现 {len(all_errors)} 个位置问题 (最多显示前50个):")
        print("-" * 60)
        for err in all_errors[:50]:
            print(f"  [ERROR] {err}")
        if len(all_errors) > 50:
            print(f"  ... 还有 {len(all_errors) - 50} 个问题未显示")
        print()
        print("结论: 存在问题，需要修复！")
        return 1
    else:
        print()
        print("结论: 所有实体位置验证通过！")
        return 0


if __name__ == "__main__":
    sys.exit(main())