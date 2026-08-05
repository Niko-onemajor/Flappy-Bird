import './render';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from './render';
import { submitScore, getTopScores } from './api';
import BackGround from './runtime/background';
import GameInfo from './runtime/gameinfo';
import Sound from './sound';
import Player from './player/index';
import Pipe from './npc/pipe';
import Prop from './npc/prop';
import DataBus from './databus';
import { PLAYER, GROUND, PIPE, PROP as PROP_CFG } from './config';

const ctx = canvas.getContext('2d');

GameGlobal.sound = new Sound();
GameGlobal.databus = new DataBus();

const SCREEN_STATE = {
  HOME: 'home',
  READY: 'ready',
  PLAYING: 'playing',
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

const PIPE_WIDTH = PIPE.WIDTH;
const PROP_SIZE = PROP_CFG.SIZE;
const PROP_SAFE_MARGIN = PROP_CFG.SAFE_MARGIN;
const PROP_TYPES = ['shield', 'multiplier'];
const MIN_SPACING = PIPE.MIN_SPACING;
const MOVE_RANGE = PIPE.MOVE_RANGE;
const JUMP_VELOCITY = PLAYER.JUMP_VELOCITY;

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
  propTimer = 0;
  _scoreSubmitted = false;
  _playedDieSound = false;
  _prevScore = 0;

  constructor() {
    this.player = new Player();
    this.gameInfo.on('start', this.startGame.bind(this));
    this.gameInfo.on('restart', this.restartGame.bind(this));
    this.gameInfo.on('backToHome', this.goToHome.bind(this));
    this.gameInfo.on('flap', this.flap.bind(this));
    this.gameInfo.on('showLeaderboard', this.showLeaderboard.bind(this));

    /* 初始化全局屏幕状态（必须在注册触摸事件后、loop 前设置） */
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
    this.aniId = requestAnimationFrame(this.loop.bind(this));
  }

  startGame() {
    this.databus.reset();
    this.player.init();
    this.pipeTimer = 0;
    this.propTimer = 0;
    this._scoreSubmitted = false;
    this._playedDieSound = false;
    this._prevScore = 0;
    GameGlobal.isGameOverServer = false;
    this.screenState = SCREEN_STATE.READY;
    GameGlobal.screenState = SCREEN_STATE.READY;
    GameGlobal.sound.playBgm();
    cancelAnimationFrame(this.aniId);
    this.aniId = requestAnimationFrame(this.loop.bind(this));
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
    this.aniId = requestAnimationFrame(this.loop.bind(this));
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
    this.player.update();
    this._updatePipes();
    this._updateProps();
    this._checkCollisions();
    this._updateTimers();
    this._generatePipes();

    /* 检测得分（通过水管） */
    if (!this.databus.isGameOver) {
      for (const pipe of this.databus.pipes) {
        if (!pipe.scored && pipe.x + PIPE_WIDTH < this.player.x) {
          pipe.scored = true;
          this.databus.score += this.databus.scoreMultiplier;
          GameGlobal.sound.playPoint();
        }
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

    if (this.databus.pipes.length > 0) {
      const last = this.databus.pipes[this.databus.pipes.length - 1];
      if (last.x > SCREEN_WIDTH - MIN_SPACING) return;
    }

    const pipe = this.databus.pool.getItemByClass('pipe', Pipe);
    pipe.init(gap, speed);
    this.databus.pipes.push(pipe);
    this.pipeTimer = interval;

    /* 概率生成道具 */
    if (Math.random() < propChance) {
      this._createPropForPipe(pipe, speed);
    }
  }

  _createPropForPipe(pipe, pipeSpeed) {
    const prop = this.databus.pool.getItemByClass('prop', Prop);
    prop.type = PROP_TYPES[Math.floor(Math.random() * PROP_TYPES.length)];
    prop.visible = true;
    prop.isActive = true;
    prop.collected = false;
    prop.animPhase = Math.random() * Math.PI * 2;
    prop.speed = pipeSpeed;
    prop.x = pipe.x + PIPE_WIDTH / 2 - PROP_SIZE / 2;
    prop._parentPipe = pipe;  /* 关联水管，用于移动水管跟随 */

    const availableH = SCREEN_HEIGHT - GROUND.HEIGHT;
    const hasTop = pipe.pipeType === 0 || pipe.pipeType === 1 || pipe.pipeType === 3;
    const hasBottom = pipe.pipeType === 0 || pipe.pipeType === 2 || pipe.pipeType === 3;

    if (hasTop && hasBottom) {
      const gapCenter = pipe.gapY + pipe.gap / 2;
      prop.y = gapCenter - PROP_SIZE / 2;
    } else if (hasBottom) {
      const minY = 50;
      const maxY = pipe.gapY - PROP_SAFE_MARGIN - PROP_SIZE;
      if (maxY < minY) {
        prop.y = Math.max(50, pipe.gapY - PROP_SIZE - 4);
      } else {
        prop.y = minY + (maxY - minY) * 0.4;
      }
    } else {
      const minY = pipe.gapY + PROP_SAFE_MARGIN;
      const maxY = availableH - PROP_SIZE - 30;
      if (maxY < minY) {
        prop.y = minY;
      } else {
        prop.y = minY + (maxY - minY) * 0.5;
      }
    }

    this.databus.props.push(prop);
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

      /* 跟随移动水管 */
      if (prop._parentPipe && prop._parentPipe.pipeType === 3) {
        const p = prop._parentPipe;
        const gapCenter = p.gapY + p.gap / 2;
        prop.y = gapCenter - PROP_SIZE / 2;
      }

      if (prop.x + prop.width < -10) {
        this.databus.removeProp(prop);
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
        prop.collect();
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
      if (this.databus.shieldTimer <= 0) this.databus.shieldActive = false;
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
      this.player.render(ctx);
      this.gameInfo.renderReady(ctx);
    } else {
      this.bg.render(ctx);
      this.databus.pipes.forEach((p) => p.render(ctx));
      this.databus.props.forEach((p) => p.render(ctx));
      this.player.render(ctx);
      this.gameInfo.renderLocal(ctx, this.databus);
    }
  }

  /* 主循环 */
  loop() {
    this.bg.update();

    if (this.screenState === SCREEN_STATE.PLAYING) {
      this.tick();
    }

    this.render();
    this.aniId = requestAnimationFrame(this.loop.bind(this));
  }
}