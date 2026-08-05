"""
道具位置验证脚本 —— 模拟多轮游戏运行，验证道具位置是否始终合理。
复刻 GameService.cs 的核心逻辑：水管生成、道具生成、难度递增、移动水管摆动。
"""
import math
import random
import sys
from dataclasses import dataclass, field
from typing import List, Tuple, Optional

# ==================== 常量（与 GameService.cs 完全一致） ====================
PIPE_WIDTH = 52
PIPE_MIN_LENGTH = 40
BIRD_CLEARANCE = 80
MOVE_RANGE = 30
MIN_SPACING = 220
GROUND_HEIGHT = 90
PROP_SIZE = 32
PROP_SAFE_MARGIN = 24

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

PROP_TYPES = ["shield", "multiplier"]

SCREEN_WIDTH = 375
SCREEN_HEIGHT = 667
AVAILABLE_H = SCREEN_HEIGHT - GROUND_HEIGHT  # 577

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
        return self.pipe_type == 3

    @property
    def has_top(self) -> bool:
        return self.pipe_type in (0, 1, 3)

    @property
    def has_bottom(self) -> bool:
        return self.pipe_type in (0, 2, 3)


@dataclass
class PropState:
    x: float
    y: float
    prop_type: str
    speed: float
    anim_phase: float
    parent_pipe: Optional[PipeState] = None
    collected: bool = False


# ==================== 游戏逻辑 ====================
class GameSimulator:
    def __init__(self, seed: int):
        self.rng = random.Random(seed)
        self.pipes: List[PipeState] = []
        self.props: List[PropState] = []
        self.score = 0
        self.frame = 0
        self.pipe_timer = 0
        self.is_game_over = False

        # 统计
        self.total_props = 0
        self.errors: List[str] = []

    def get_difficulty(self) -> Tuple[float, float, float, float]:
        level = self.score / DIFFICULTY_STEP
        speed = min(SPEED_BASE + level * SPEED_INCREMENT, SPEED_MAX)
        gap = max(GAP_BASE - level * GAP_DECREMENT, GAP_MIN)
        interval = max(INTERVAL_BASE - level * INTERVAL_DECREMENT, INTERVAL_MIN)
        prop_chance = min(PROP_CHANCE_BASE + level * PROP_CHANCE_INCREMENT, 0.65)
        return speed, gap, interval, prop_chance

    def calc_gap_position(self, pipe: PipeState):
        """复刻 CalcGapPosition"""
        if pipe.pipe_type == 1:  # TopOnly
            max_top = AVAILABLE_H - BIRD_CLEARANCE
            pipe.gap_y = PIPE_MIN_LENGTH + self.rng.random() * max(0, max_top - PIPE_MIN_LENGTH)
        elif pipe.pipe_type == 2:  # BottomOnly
            min_bottom = BIRD_CLEARANCE
            max_bottom = AVAILABLE_H - PIPE_MIN_LENGTH
            pipe.gap_y = min_bottom + self.rng.random() * max(0, max_bottom - min_bottom)
        elif pipe.pipe_type == 3:  # Moving
            min_gap_y = PIPE_MIN_LENGTH
            max_gap_y = AVAILABLE_H - pipe.gap - PIPE_MIN_LENGTH
            if max_gap_y <= min_gap_y:
                pipe.gap = max(BIRD_CLEARANCE, AVAILABLE_H - PIPE_MIN_LENGTH * 2)
                pipe.gap_y = PIPE_MIN_LENGTH
            else:
                pipe.gap_y = min_gap_y + self.rng.random() * (max_gap_y - min_gap_y)
            pipe.base_gap_y = pipe.gap_y
        else:  # Normal
            min_gap_y = PIPE_MIN_LENGTH
            max_gap_y = AVAILABLE_H - pipe.gap - PIPE_MIN_LENGTH
            if max_gap_y <= min_gap_y:
                pipe.gap = max(BIRD_CLEARANCE, AVAILABLE_H - PIPE_MIN_LENGTH * 2)
                pipe.gap_y = PIPE_MIN_LENGTH
            else:
                pipe.gap_y = min_gap_y + self.rng.random() * (max_gap_y - min_gap_y)

    def create_pipe(self, gap: float, speed: float) -> PipeState:
        """复刻 CreatePipe"""
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
            pipe.pipe_type = 0
        elif rand < 0.65:
            pipe.pipe_type = 1
        elif rand < 0.85:
            pipe.pipe_type = 2
        else:
            pipe.pipe_type = 3
        self.calc_gap_position(pipe)
        return pipe

    def create_prop_for_pipe(self, pipe: PipeState) -> PropState:
        """复刻 CreatePropForPipe"""
        prop = PropState(
            x=pipe.x + PIPE_WIDTH / 2 - PROP_SIZE / 2,
            y=0,
            prop_type=self.rng.choice(PROP_TYPES),
            speed=pipe.speed,
            anim_phase=self.rng.random() * math.pi * 2,
            parent_pipe=pipe,
        )

        if pipe.has_top and pipe.has_bottom:
            gap_center = pipe.gap_y + pipe.gap / 2
            prop.y = gap_center - PROP_SIZE / 2
        elif pipe.has_bottom:
            min_y = 50.0
            max_y = pipe.gap_y - PROP_SAFE_MARGIN - PROP_SIZE
            if max_y < min_y:
                # 管道太靠上，道具紧贴管道上方（缩小安全边距）
                prop.y = max(50.0, pipe.gap_y - PROP_SIZE - 4)
            else:
                prop.y = min_y + (max_y - min_y) * 0.4
        else:
            min_y = pipe.gap_y + PROP_SAFE_MARGIN
            max_y = AVAILABLE_H - PROP_SIZE - 30.0
            if max_y < min_y:
                prop.y = min_y
            else:
                prop.y = min_y + (max_y - min_y) * 0.5

        return prop

    def generate_pipes(self):
        """复刻 GeneratePipes"""
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
        self.pipe_timer = int(interval)

        if self.rng.random() < prop_chance:
            prop = self.create_prop_for_pipe(pipe)
            self.props.append(prop)
            self.total_props += 1

            # 验证道具位置
            self.verify_prop(prop)

    def update_pipes(self):
        """复刻 UpdatePipes"""
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
        """复刻 UpdateProps"""
        for i in range(len(self.props) - 1, -1, -1):
            prop = self.props[i]
            if prop.collected:
                continue

            prop.x -= prop.speed

            # 跟随移动水管
            if prop.parent_pipe is not None and prop.parent_pipe.is_moving:
                p = prop.parent_pipe
                gap_center = p.gap_y + p.gap / 2
                prop.y = gap_center - PROP_SIZE / 2

            if prop.x + PROP_SIZE < -10:
                self.props.pop(i)

    def simulate_scoring(self):
        """模拟计分：玩家在水管间隙中心位置，通过水管时计分"""
        player_x = SCREEN_WIDTH / 4
        for pipe in self.pipes:
            if not pipe.scored and pipe.x + PIPE_WIDTH < player_x:
                pipe.scored = True
                self.score += 1

    def verify_prop(self, prop: PropState):
        """验证道具位置是否合理"""
        pipe = prop.parent_pipe
        if pipe is None:
            return

        prop_left = prop.x
        prop_right = prop.x + PROP_SIZE
        prop_top = prop.y
        prop_bottom = prop.y + PROP_SIZE
        pipe_left = pipe.x
        pipe_right = pipe.x + PIPE_WIDTH

        # 1. 道具必须在屏幕范围内
        if prop_top < 0:
            self.errors.append(
                f"[Score={self.score}] 道具Y<0: prop.y={prop.y:.1f}, pipe_type={pipe.pipe_type}, "
                f"gap_y={pipe.gap_y:.1f}, gap={pipe.gap:.1f}"
            )
        if prop_bottom > AVAILABLE_H:
            self.errors.append(
                f"[Score={self.score}] 道具超出地面: prop.bottom={prop_bottom:.1f}, "
                f"availableH={AVAILABLE_H}, pipe_type={pipe.pipe_type}"
            )

        # 2. 道具不得与水管重叠
        if prop_right > pipe_left and prop_left < pipe_right:
            # X轴重叠，检查Y轴
            if pipe.has_top and prop_top < pipe.gap_y:
                self.errors.append(
                    f"[Score={self.score}] 道具与上管重叠: prop[y={prop_top:.1f},{prop_bottom:.1f}], "
                    f"top_pipe_bottom={pipe.gap_y:.1f}, pipe_type={pipe.pipe_type}"
                )
            if pipe.has_bottom:
                bottom_y = pipe.gap_y + (pipe.gap if pipe.has_top else 0)
                if prop_bottom > bottom_y and bottom_y < AVAILABLE_H:
                    self.errors.append(
                        f"[Score={self.score}] 道具与下管重叠: prop[y={prop_top:.1f},{prop_bottom:.1f}], "
                        f"bottom_pipe_top={bottom_y:.1f}, pipe_type={pipe.pipe_type}"
                    )

        # 3. 对于双管，道具必须在间隙内
        if pipe.has_top and pipe.has_bottom:
            gap_top = pipe.gap_y
            gap_bottom = pipe.gap_y + pipe.gap
            if prop_top < gap_top or prop_bottom > gap_bottom:
                # 宽容：道具只要在间隙附近即可（因为道具可能在间隙边缘）
                if prop_top < gap_top - 5 or prop_bottom > gap_bottom + 5:
                    self.errors.append(
                        f"[Score={self.score}] 道具不在间隙内: prop[y={prop_top:.1f},{prop_bottom:.1f}], "
                        f"gap=[{gap_top:.1f},{gap_bottom:.1f}], pipe_type={pipe.pipe_type}"
                    )

        # 4. 对于下管，道具必须在上方
        if pipe.has_bottom and not pipe.has_top:
            if prop_bottom > pipe.gap_y:
                self.errors.append(
                    f"[Score={self.score}] 道具在下管内部/下方: prop.bottom={prop_bottom:.1f}, "
                    f"pipe_top={pipe.gap_y:.1f}, pipe_type={pipe.pipe_type}"
                )

        # 5. 对于上管，道具必须在下方
        if pipe.has_top and not pipe.has_bottom:
            if prop_top < pipe.gap_y:
                self.errors.append(
                    f"[Score={self.score}] 道具在上管内部/上方: prop.top={prop_top:.1f}, "
                    f"pipe_bottom={pipe.gap_y:.1f}, pipe_type={pipe.pipe_type}"
                )

    def tick(self):
        """执行一帧游戏逻辑"""
        if self.is_game_over:
            return

        self.frame += 1
        self.generate_pipes()
        self.update_pipes()
        self.update_props()
        self.simulate_scoring()

        # 模拟玩家死亡：随得分增加死亡概率上升
        death_chance = min(0.0005 + self.score * 0.0001, 0.015)
        if self.rng.random() < death_chance:
            self.is_game_over = True
        elif self.frame >= MAX_FRAMES:
            self.is_game_over = True

    def run(self):
        """运行一轮游戏"""
        while not self.is_game_over:
            self.tick()


# ==================== 测试主程序 ====================
def main():
    rounds = int(sys.argv[1]) if len(sys.argv) > 1 else 200
    print(f"道具位置验证 - 运行 {rounds} 轮模拟游戏")
    print(f"常量: SPEED_BASE={SPEED_BASE}, GAP_BASE={GAP_BASE}, INTERVAL_BASE={INTERVAL_BASE}")
    print(f"      SPEED_MAX={SPEED_MAX}, GAP_MIN={GAP_MIN}, INTERVAL_MIN={INTERVAL_MIN}")
    print(f"      DIFFICULTY_STEP={DIFFICULTY_STEP}")
    print()

    all_errors: List[str] = []
    total_props = 0
    scores: List[int] = []
    error_rounds = 0

    for r in range(rounds):
        sim = GameSimulator(seed=r * 100 + 42)
        sim.run()
        total_props += sim.total_props
        scores.append(sim.score)

        if sim.errors:
            error_rounds += 1
            all_errors.extend(sim.errors)

        if (r + 1) % 50 == 0:
            print(f"  已运行 {r + 1}/{rounds} 轮... (累计道具: {total_props}, 问题轮次: {error_rounds})")

    print()
    print("=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    print(f"总轮次:       {rounds}")
    print(f"总道具数:     {total_props}")
    print(f"问题轮次:     {error_rounds}")
    print(f"问题道具数:   {len(all_errors)}")
    print(f"平均得分:     {sum(scores) / len(scores):.1f}")
    print(f"最高得分:     {max(scores)}")
    print(f"最低得分:     {min(scores)}")

    if all_errors:
        print()
        print("-" * 60)
        print(f"发现 {len(all_errors)} 个道具位置问题 (最多显示前50个):")
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
        print("结论: 所有道具位置验证通过！")
        return 0


if __name__ == "__main__":
    sys.exit(main())