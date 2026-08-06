import './render';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from './render';
import { submitScore, getTopScores } from './api';
import BackGround from './runtime/background';
import GameInfo from './runtime/gameinfo';
import Sound from './sound';
import Player from './player/index';
import Pipe from './npc/pipe';
import Prop from './npc/prop';
import Saw from './npc/saw';
import Rocket from './npc/rocket';
import DataBus from './databus';
import { PLAYER, GROUND, PIPE, PROP as PROP_CFG, SAW as SAW_CFG, ROCKET as ROCKET_CFG } from './config';

const ctx = canvas.getContext('2d');

GameGlobal.sound = new Sound();
GameGlobal.databus = new DataBus();

const SCREEN_STATE = {
  HOME: 'home',
  READY: 'ready',
  PLAYING: 'playing',
  PAUSED: 'paused',
  COUNTDOWN: 'countdown',
  LEADERBOARD: 'leaderboard',
};

/* 难度参数（与后端 GameService.cs 保持一致） */
const DIFFICULTY_STEP = 6;
const SPEED_BASE = 4.2;
const SPEED_MAX = 18;
const SPEED_INCREMENT = 0.45;
const GAP_BASE = 112;
const GAP_MIN = 58;
const GAP_DECREMENT = 2;
const INTERVAL_BASE = 85;
const INTERVAL_MIN = 30;
const INTERVAL_DECREMENT = 2;
const PROP_CHANCE_BASE = 0.35;
const PROP_CHANCE_INCREMENT = 0.03;
const PROP_COOLDOWN_MIN = 120;  /* 道具最小间隔帧数（2秒），防止扎堆 */

const PIPE_WIDTH = PIPE.WIDTH;
const PROP_SIZE = PROP_CFG.SIZE;
const PROP_SAFE_MARGIN = PROP_CFG.SAFE_MARGIN;
const MIN_SPACING = PIPE.MIN_SPACING;
const MOVE_RANGE = PIPE.MOVE_RANGE;
const JUMP_VELOCITY = PLAYER.JUMP_VELOCITY;
const SHIELD_COOLDOWN = PROP_CFG.SHIELD_COOLDOWN;
const SAW_MIN_SCORE = SAW_CFG.MIN_SCORE;
const SAW_SPAWN_CHANCE = SAW_CFG.SPAWN_CHANCE;
const ROCKET_MIN_SCORE = ROCKET_CFG.MIN_SCORE;
const ROCKET_SPAWN_CHANCE = ROCKET_CFG.SPAWN_CHANCE;
const ROCKET_COOLDOWN = 90;  /* 火箭生成冷却帧数（1.5秒），保证稳定出现 */

/* 碰撞箱可视化调试开关 */
GameGlobal.DEBUG_COLLISION = true;

/**
 * 本地游戏主循环 —— 游戏逻辑在本地运行，彻底消除网络延迟。
 * 后端仅用于分数提交和排行榜查询。
 */
export default class Main {
  aniId = 0;
  bg = new BackGround();
  gameInfo = new GameInfo();
  screenState = SCREEN_STATE.HOME;
  player = null;
  databus = GameGlobal.databus;

  pipeTimer = 0;
  propTimer = 0;            /* 道具生成冷却计时器 */
  rocketTimer = 0;          /* 火箭生成冷却计时器（独立于水管生成） */
  _lastPropScore = 0;       /* 上次生成道具时的分数 */
  _scoreSubmitted = false;
  _playedDieSound = false;
  _prevScore = 0;
  _countdownTimer = 0;
  _countdownStart = 0;

  constructor() {
    this.player = new Player();
    this.databus.player = this.player;  /* 绑定到全局，供Rocket等组件访问 */
    this.gameInfo.on('start', this.startGame.bind(this));
    this.gameInfo.on('restart', this.restartGame.bind(this));
    this.gameInfo.on('backToHome', this.goToHome.bind(this));
    this.gameInfo.on('flap', this.flap.bind(this));
    this.gameInfo.on('showLeaderboard', this.showLeaderboard.bind(this));
    this.gameInfo.on('pause', this.pauseGame.bind(this));
    this.gameInfo.on('resume', this.resumeGame.bind(this));
    this.gameInfo.on('quitToHome', this.goToHome.bind(this));

    this._boundLoop = this.loop.bind(this);

    GameGlobal.screenState = SCREEN_STATE.HOME;
    console.log('[Main] 初始化完成，屏幕状态:', GameGlobal.screenState);
    this.loop();
  }

  /* ========== 难度计算 ========== */
  _getDifficulty() {
    const level = this.databus.score / DIFFICULTY_STEP;
    return {
      speed: Math.min(SPEED_BASE + level * SPEED_INCREMENT, SPEED_MAX),
      gap: Math.max(GAP_BASE - level * GAP_DECREMENT, GAP_MIN),
      interval: Math.max(INTERVAL_BASE - level * INTERVAL_DECREMENT, INTERVAL_MIN),
      propChance: Math.min(PROP_CHANCE_BASE + level * PROP_CHANCE_INCREMENT, 0.65),
    };
  }

  /* ========== 屏幕状态切换 ========== */
  goToHome() {
    this.screenState = SCREEN_STATE.HOME;
    GameGlobal.screenState = SCREEN_STATE.HOME;
    GameGlobal.isGameOverServer = false;
    this._scoreSubmitted = false;
    GameGlobal.sound.stopAll();
    cancelAnimationFrame(this.aniId);
    this.aniId = requestAnimationFrame(this._boundLoop);
  }

  startGame() {
    this.databus.reset();
    this.player.init();
    this.pipeTimer = 0;
    this.propTimer = 0;
    this.rocketTimer = 0;
    this._lastPropScore = 0;
    this._scoreSubmitted = false;
    this._playedDieSound = false;
    this._prevScore = 0;
    GameGlobal.isGameOverServer = false;
    this.screenState = SCREEN_STATE.READY;
    GameGlobal.screenState = SCREEN_STATE.READY;
    GameGlobal.sound.playBgm();
    cancelAnimationFrame(this.aniId);
    this.aniId = requestAnimationFrame(this._boundLoop);
  }

  async restartGame() {
    this.startGame();
  }

  /* ========== 玩家操作 ========== */
  flap() {
    if (this.databus.isGameOver) return;

    if (this.screenState === SCREEN_STATE.READY) {
      this.screenState = SCREEN_STATE.PLAYING;
      GameGlobal.screenState = SCREEN_STATE.PLAYING;
      return;
    }

    if (this.screenState === SCREEN_STATE.PLAYING) {
      this.player.vy = JUMP_VELOCITY;
      GameGlobal.sound.playWing();
    }
  }

  /* ========== 暂停/恢复 ========== */
  pauseGame() {
    if (this.screenState !== SCREEN_STATE.PLAYING) return;
    this.screenState = SCREEN_STATE.PAUSED;
    GameGlobal.screenState = SCREEN_STATE.PAUSED;
    GameGlobal.sound.pauseBgm();
  }

  resumeGame() {
    if (this.screenState !== SCREEN_STATE.PAUSED) return;
    this.screenState = SCREEN_STATE.COUNTDOWN;
    GameGlobal.screenState = SCREEN_STATE.COUNTDOWN;
    this._countdownTimer = 180;
    this.gameInfo._countdownValue = 3;
  }

  /* ========== 排行榜 ========== */
  async showLeaderboard() {
    this.screenState = SCREEN_STATE.LEADERBOARD;
    GameGlobal.screenState = SCREEN_STATE.LEADERBOARD;
    this.gameInfo._leaderboardScrollY = 0;
    try {
      const data = await getTopScores(10);
      this.gameInfo._leaderboardData = data;
    } catch (err) {
      console.error('[Main] 获取排行榜失败:', err);
    }
    cancelAnimationFrame(this.aniId);
    this.aniId = requestAnimationFrame(this._boundLoop);
  }

  async submitScoreToServer() {
    if (this.databus.score <= 0) return;
    try {
      await submitScore('Player', this.databus.score);
    } catch (err) {
      console.error('[Main] 提交分数失败:', err);
    }
  }

  /* ========== 本地游戏逻辑 ========== */
  tick() {
    this.databus.frame++;

    if (this.screenState === SCREEN_STATE.COUNTDOWN) {
      this._countdownTimer--;
      this.gameInfo._countdownValue = Math.ceil(this._countdownTimer / 60);
      if (this._countdownTimer <= 0) {
        this.screenState = SCREEN_STATE.PLAYING;
        GameGlobal.screenState = SCREEN_STATE.PLAYING;
        GameGlobal.sound.resumeBgm();
      }
      return;
    }

    if (this.databus.isGameOver) return;

    this.player.update();
    this._updatePipes();
    this._updateProps();
    this._updateSaws();
    this._updateRockets();
    this._checkCollisions();
    this._updateTimers();
    this._generatePipes();
    this._tryGenerateRocket();  /* 每帧检查，独立于水管生成 */

    /* 检测得分（通过水管） */
    for (const pipe of this.databus.pipes) {
      if (!pipe.scored && pipe.x + PIPE_WIDTH < this.player.x) {
        pipe.scored = true;
        this.databus.score += this.databus.scoreMultiplier;
        GameGlobal.sound.playPoint();
      }
    }

    /* 游戏结束处理 */
    if (this.databus.isGameOver) {
      GameGlobal.isGameOverServer = true;
      if (!this._playedDieSound) {
        this._playedDieSound = true;
        GameGlobal.sound.playHit();
        GameGlobal.sound.playDie();
      }
      if (!this._scoreSubmitted) {
        this._scoreSubmitted = true;
        this.submitScoreToServer();
      }
    }
  }

  _generatePipes() {
    const { speed, gap, interval, propChance } = this._getDifficulty();

    this.pipeTimer--;
    if (this.pipeTimer > 0) return;

    /* 间距检查：若上一根水管离屏幕右边缘太近，延后生成 */
    if (this.databus.pipes.length > 0) {
      const last = this.databus.pipes[this.databus.pipes.length - 1];
      if (last.x > SCREEN_WIDTH - MIN_SPACING) {
        this.pipeTimer = 1;  /* 重置，防止连续递减到负数 */
        return;
      }
    }

    /* 先生成水管，再基于水管精确计算道具和障碍物坐标 */
    const pipe = this.databus.pool.getItemByClass('pipe', Pipe);
    if (!pipe) {
      console.warn('[Pipe] 对象池获取失败，延后生成');
      this.pipeTimer = 10;
      return;
    }
    pipe.init(gap, speed);
    this.databus.pipes.push(pipe);
    this.pipeTimer = Math.max(interval, 30);  /* 保底最小值，防止过于接近0 */
    console.log(`[Pipe] 生成 x=${pipe.x.toFixed(1)} gapY=${pipe.gapY.toFixed(1)} gap=${pipe.gap} type=${pipe.pipeType} interval=${interval}`);

    /* 道具生成：基于刚生成的水管 */
    this.propTimer--;
    if (this.propTimer <= 0 && Math.random() < propChance
        && this.databus.props.length < 3) {
      this._createPropForPipe(pipe);
      this.propTimer = PROP_COOLDOWN_MIN + Math.floor(Math.random() * 60);
      console.log(`[Prop] 生成道具 propTimer=${this.propTimer} 场上=${this.databus.props.length}`);
    } else if (this.propTimer <= 0) {
      this.propTimer = 1;  /* 跳过本次，重置计时器 */
      console.log(`[Prop] 跳过 propTimer复归=${this.propTimer} props=${this.databus.props.length} chance=${propChance.toFixed(2)}`);
    }

    /* 锯片（8分后）：基于刚生成的水管，pipe已通过init校验 */
    if (this.databus.score >= SAW_MIN_SCORE && Math.random() < SAW_SPAWN_CHANCE
        && this.databus.saws.length < 8) {
      this._createSawForPipe(pipe, speed);
      console.log(`[Saw] 触发 score=${this.databus.score} saws=${this.databus.saws.length}`);
    }
  }

  _createPropForPipe(pipe) {
    if (!pipe || pipe.gapY == null || pipe.gap == null) {
      console.warn('[Prop] 跳过生成：水管对象无效', pipe);
      return;
    }
    const prop = this.databus.pool.getItemByClass('prop', Prop);
    prop.init(pipe);  /* 内部基于水管精确计算X和Y */
    this.databus.props.push(prop);
  }

  _createSawForPipe(pipe, pipeSpeed) {
    if (!pipe || pipe.gapY == null || pipe.gap == null) {
      console.warn('[Saw] 跳过生成：水管对象无效', pipe);
      return;
    }
    /* 找到上一个水管（前一对），用于计算两根水管之间的空白区域 */
    const pipes = this.databus.pipes;
    const prevPipe = pipes.length >= 2 ? pipes[pipes.length - 2] : null;

    const saw = this.databus.pool.getItemByClass('saw', Saw);
    saw.init(pipeSpeed, pipe, prevPipe);
    this.databus.saws.push(saw);
  }

  _createRocketForPipe(pipe, pipeSpeed) {
    /* 保留兼容，新火箭不再需要 pipe 参数 */
    if (!pipe || pipe.gapY == null || pipe.gap == null) {
      console.warn('[Rocket] 跳过生成：水管对象无效', pipe);
      return;
    }
    const rocket = this.databus.pool.getItemByClass('rocket', Rocket);
    rocket.init(pipeSpeed);
    this.databus.rockets.push(rocket);
  }

  /* 火箭独立生成：每帧调用，20分后开始，从右侧进入，2秒追踪后锁定发射 */
  _tryGenerateRocket() {
    if (this.databus.score < ROCKET_MIN_SCORE) return;
    if (this.databus.rockets.length >= 6) return;

    this.rocketTimer--;
    if (this.rocketTimer > 0) return;

    if (Math.random() < ROCKET_SPAWN_CHANCE) {
      const { speed } = this._getDifficulty();
      const rocket = this.databus.pool.getItemByClass('rocket', Rocket);
      rocket.init(speed);
      this.databus.rockets.push(rocket);
      console.log(`[Rocket] 生成(每帧) score=${this.databus.score} speed=${speed.toFixed(1)} rockets=${this.databus.rockets.length}`);
    }

    this.rocketTimer = ROCKET_COOLDOWN + Math.floor(Math.random() * 60);
  }

  _updatePipes() {
    for (let i = this.databus.pipes.length - 1; i >= 0; i--) {
      const pipe = this.databus.pipes[i];
      pipe.x -= pipe.speed;

      if (pipe.pipeType === 3) {
        pipe.movePhase += 0.03;
        pipe.gapY = pipe.baseGapY + Math.sin(pipe.movePhase) * MOVE_RANGE;
        const availableH = SCREEN_HEIGHT - GROUND.HEIGHT;
        pipe.gapY = Math.max(PIPE.MIN_LENGTH, Math.min(pipe.gapY, availableH - pipe.gap - PIPE.MIN_LENGTH));
      }

      if (pipe.x + pipe.width < -20) {
        this.databus.removePipe(pipe);
      }
    }
  }

  _updateProps() {
    for (let i = this.databus.props.length - 1; i >= 0; i--) {
      const prop = this.databus.props[i];
      if (prop.collected) continue;
      prop.x -= prop.speed;

      /* 跟随移动水管同步更新Y坐标 */
      if (prop._parentPipe && prop._parentPipe.pipeType === 3) {
        const p = prop._parentPipe;
        const gapCenter = p.gapY + p.gap / 2;
        const newY = gapCenter - PROP_SIZE / 2;
        const minY = p.gapY + PROP_SAFE_MARGIN;
        const maxY = p.gapY + p.gap - PROP_SAFE_MARGIN - PROP_SIZE;
        prop.y = Math.max(minY, Math.min(maxY, newY));
      }

      if (prop.x + prop.width < -10) {
        this.databus.removeProp(prop);
      }
    }
  }

  _updateSaws() {
    for (let i = this.databus.saws.length - 1; i >= 0; i--) {
      const saw = this.databus.saws[i];
      saw.update();
      if (saw.x + saw.width < -20) {
        this.databus.saws.splice(i, 1);
        this.databus.pool.recover('saw', saw);
      }
    }
  }

  _updateRockets() {
    for (let i = this.databus.rockets.length - 1; i >= 0; i--) {
      const rocket = this.databus.rockets[i];
      rocket.update();
      if (rocket.x + rocket.width < -30 || rocket.x > SCREEN_WIDTH + 30
          || rocket.y + rocket.height < -30 || rocket.y > SCREEN_HEIGHT + 30) {
        this.databus.rockets.splice(i, 1);
        this.databus.pool.recover('rocket', rocket);
      }
    }
  }

  _checkCollisions() {
    if (!this.player.isActive || !this.player.visible) return;

    /* 水管碰撞 */
    for (let i = this.databus.pipes.length - 1; i >= 0; i--) {
      const pipe = this.databus.pipes[i];
      if (pipe.isCollideWithBird(this.player)) {
        if (this.databus.shieldActive) {
          this.databus.removePipe(pipe);
          this.databus.shieldActive = false;
          this.databus.shieldTimer = 0;
          GameGlobal.sound.playShieldBreak();
          continue;
        }
        this.player.destroy();
        this.databus.gameOver();
        return;
      }
    }

    /* 锯片碰撞 */
    for (let i = this.databus.saws.length - 1; i >= 0; i--) {
      const saw = this.databus.saws[i];
      if (saw.isCollideWithBird(this.player)) {
        if (this.databus.shieldActive) {
          this.databus.saws.splice(i, 1);
          this.databus.pool.recover('saw', saw);
          this.databus.shieldActive = false;
          this.databus.shieldTimer = 0;
          GameGlobal.sound.playShieldBreak();
          continue;
        }
        this.player.destroy();
        this.databus.gameOver();
        return;
      }
    }

    /* 火箭碰撞 */
    for (let i = this.databus.rockets.length - 1; i >= 0; i--) {
      const rocket = this.databus.rockets[i];
      if (rocket.isCollideWithBird(this.player)) {
        if (this.databus.shieldActive) {
          this.databus.rockets.splice(i, 1);
          this.databus.pool.recover('rocket', rocket);
          this.databus.shieldActive = false;
          this.databus.shieldTimer = 0;
          GameGlobal.sound.playShieldBreak();
          continue;
        }
        this.player.destroy();
        this.databus.gameOver();
        return;
      }
    }

    /* 道具碰撞 */
    for (let i = this.databus.props.length - 1; i >= 0; i--) {
      const prop = this.databus.props[i];
      if (prop.collected) continue;
      if (this._isPropCollideWithPlayer(prop)) {
        if (prop.type === 'shield' && this.databus.shieldCooldown > 0) continue;
        prop.collect();
        /* 道具拾取音效 */
        if (prop.type === 'shield') {
          GameGlobal.sound.playShieldPickup();
        } else {
          GameGlobal.sound.playScoreX2();
        }
      }
    }
  }

  _isPropCollideWithPlayer(prop) {
    const pcx = this.player.x + this.player.width / 2;
    const pcy = this.player.y + this.player.height / 2;
    const propCx = prop.x + prop.width / 2;
    const propCy = prop.y + prop.height / 2;
    const dx = pcx - propCx;
    const dy = pcy - propCy;
    return Math.sqrt(dx * dx + dy * dy) < (this.player.width / 2 + prop.width / 2);
  }

  _updateTimers() {
    if (this.databus.shieldActive) {
      this.databus.shieldTimer--;
      if (this.databus.shieldTimer <= 0) {
        this.databus.shieldActive = false;
        this.databus.shieldCooldown = SHIELD_COOLDOWN;
      }
    }
    if (this.databus.shieldCooldown > 0) {
      this.databus.shieldCooldown--;
    }
    if (this.databus.scoreMultiplier > 1) {
      this.databus.multiplierTimer--;
      if (this.databus.multiplierTimer <= 0) this.databus.scoreMultiplier = 1;
    }
  }

  /* ========== 渲染 ========== */
  render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (this.screenState === SCREEN_STATE.HOME) {
      this.bg.render(ctx);
      this.gameInfo.renderHome(ctx);
    } else if (this.screenState === SCREEN_STATE.LEADERBOARD) {
      this.bg.render(ctx);
      this.gameInfo.renderLeaderboard(ctx);
    } else if (this.screenState === SCREEN_STATE.READY) {
      this.bg.render(ctx);
      this.databus.pipes.forEach((p) => p.render(ctx));
      this.databus.props.forEach((p) => p.render(ctx));
      this.databus.saws.forEach((s) => s.render(ctx));
      this.databus.rockets.forEach((r) => r.render(ctx));
      this.player.render(ctx);
      this.gameInfo.renderReady(ctx);
    } else if (this.screenState === SCREEN_STATE.PAUSED) {
      this.bg.render(ctx);
      this.databus.pipes.forEach((p) => p.render(ctx));
      this.databus.props.forEach((p) => p.render(ctx));
      this.databus.saws.forEach((s) => s.render(ctx));
      this.databus.rockets.forEach((r) => r.render(ctx));
      this.player.render(ctx);
      this.gameInfo.renderLocal(ctx, this.databus);
      this.gameInfo.renderPauseOverlay(ctx);
    } else if (this.screenState === SCREEN_STATE.COUNTDOWN) {
      this.bg.render(ctx);
      this.databus.pipes.forEach((p) => p.render(ctx));
      this.databus.props.forEach((p) => p.render(ctx));
      this.databus.saws.forEach((s) => s.render(ctx));
      this.databus.rockets.forEach((r) => r.render(ctx));
      this.player.render(ctx);
      this.gameInfo.renderLocal(ctx, this.databus);
      this.gameInfo.renderCountdown(ctx);
    } else {
      this.bg.render(ctx);
      this.databus.pipes.forEach((p) => p.render(ctx));
      this.databus.props.forEach((p) => p.render(ctx));
      this.databus.saws.forEach((s) => s.render(ctx));
      this.databus.rockets.forEach((r) => r.render(ctx));
      this.player.render(ctx);
      this.gameInfo.renderLocal(ctx, this.databus);
    }
  }

  /* 主循环 */
  loop() {
    this.bg.update();

    if (this.screenState === SCREEN_STATE.PLAYING || this.screenState === SCREEN_STATE.COUNTDOWN) {
      this.tick();
    }

    this.render();
    this.aniId = requestAnimationFrame(this._boundLoop);
  }
}