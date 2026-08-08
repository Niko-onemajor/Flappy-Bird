import './render';
import { SCREEN_WIDTH, SCREEN_HEIGHT, GAME_SCALE, GAME_OFFSET_X, GAME_OFFSET_Y } from './render';
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
import { PLAYER, PIPE, SAW as SAW_CFG, ROCKET as ROCKET_CFG } from './config';

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
  SETTINGS: 'settings',
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
const MIN_SPACING = PIPE.MIN_SPACING;
const JUMP_VELOCITY = PLAYER.JUMP_VELOCITY;
const SAW_MIN_SCORE = SAW_CFG.MIN_SCORE;
const SAW_SPAWN_CHANCE = SAW_CFG.SPAWN_CHANCE;
const ROCKET_MIN_SCORE = ROCKET_CFG.MIN_SCORE;
/* 火箭动态难度：maxRockets 和 cooldown 由 _getRocketLevel 根据分数计算 */

/* 碰撞箱可视化调试开关 */
GameGlobal.DEBUG_COLLISION = false;

/* 调试日志开关：关闭后过滤实体生成、触摸坐标等详细日志 */
GameGlobal.DEBUG_LOG = false;

/* 调试模式：启动后分数直接跳到25，方便测试火箭 */
GameGlobal.DEBUG_SKIP_SCORE = false;

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
  _pipesSinceLastProp = 0;  /* 距离上次道具生成经过的水管数（每5根保底） */
  _scoreSubmitted = false;
  _playedDieSound = false;
  _prevScore = 0;
  _countdownTimer = 0;
  _countdownStart = 0;
  _prevScreenState = null;
  _shakeTimer = 0;          /* 屏幕抖动剩余帧数 */
  _shakeIntensity = 0;      /* 屏幕抖动强度 */

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
    this.gameInfo.on('showSettings', this.showSettings.bind(this));
    this.gameInfo.on('hideSettings', this.hideSettings.bind(this));

    this._boundLoop = this.loop.bind(this);

    GameGlobal.screenState = SCREEN_STATE.HOME;
    console.log('[Main] 初始化完成，屏幕状态:', GameGlobal.screenState);

    /* 应用隐藏时自动暂停 */
    wx.onHide(() => {
      if (this.screenState === SCREEN_STATE.PLAYING) {
        this.pauseGame();
      }
    });

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
    this._pipesSinceLastProp = 0;
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
      /* 调试：跳过前20分，立即测试火箭 */
      if (GameGlobal.DEBUG_SKIP_SCORE) {
        this.databus.score = 25;
        if (GameGlobal.DEBUG_LOG) console.log('[Debug] 分数跳过至25，开始测试火箭');
      }
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

  /* ========== 设置面板 ========== */
  showSettings() {
    this._prevScreenState = this.screenState;
    this.screenState = SCREEN_STATE.SETTINGS;
    GameGlobal.screenState = SCREEN_STATE.SETTINGS;
    cancelAnimationFrame(this.aniId);
    this.aniId = requestAnimationFrame(this._boundLoop);
  }

  hideSettings() {
    if (this._prevScreenState === SCREEN_STATE.PAUSED) {
      this.screenState = SCREEN_STATE.PAUSED;
      GameGlobal.screenState = SCREEN_STATE.PAUSED;
    } else {
      this.screenState = SCREEN_STATE.HOME;
      GameGlobal.screenState = SCREEN_STATE.HOME;
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
      GameGlobal.sound.stopRocketFly();
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
    if (GameGlobal.DEBUG_LOG) console.log(`[Pipe] 生成 x=${pipe.x.toFixed(1)} gapY=${pipe.gapY.toFixed(1)} gap=${pipe.gap} type=${pipe.pipeType} interval=${interval}`);

    /* 道具生成：基于刚生成的水管 */
    this._pipesSinceLastProp++;

    /* 保底机制：每5根水管必出（不受冷却限制） */
    if (this._pipesSinceLastProp >= 5 && this.databus.props.length < 3) {
      this._createPropForPipe(pipe);
      this.propTimer = PROP_COOLDOWN_MIN + Math.floor(Math.random() * 60);
      this._pipesSinceLastProp = 0;
    }
    /* 随机生成：冷却结束后概率触发 */
    else if (this.propTimer <= 0 && Math.random() < propChance && this.databus.props.length < 3) {
      this._createPropForPipe(pipe);
      this.propTimer = PROP_COOLDOWN_MIN + Math.floor(Math.random() * 60);
      this._pipesSinceLastProp = 0;
    } else if (this.propTimer <= 0) {
      this.propTimer = 30;  /* 概率未命中，0.5秒后重试 */
    }

    /* 锯片（8分后）：基于刚生成的水管，pipe已通过init校验 */
    if (this.databus.score >= SAW_MIN_SCORE && Math.random() < SAW_SPAWN_CHANCE
        && this.databus.saws.length < 8) {
      this._createSawForPipe(pipe, speed);
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

  /* 火箭难度等级：每8分提升一级，最大3个，冷却从150帧缓慢缩短 */
  _getRocketLevel(score) {
    const level = Math.floor((score - ROCKET_MIN_SCORE) / 8) + 1;
    const maxRockets = Math.min(level, 3);
    const cooldown = Math.max(150 - (level - 1) * 20, 60)
      + Math.floor(Math.random() * 20);
    return { level, maxRockets, cooldown };
  }

  /* 火箭独立生成：每帧调用，12分后开始，从右侧进入，2秒追踪后锁定发射 */
  _tryGenerateRocket() {
    const score = this.databus.score;

    if (score < ROCKET_MIN_SCORE) {
      return;
    }

    const { maxRockets, cooldown } = this._getRocketLevel(score);

    if (this.databus.rockets.length >= maxRockets) {
      return;
    }

    this.rocketTimer--;
    if (this.rocketTimer > 0) {
      return;
    }

    const { speed } = this._getDifficulty();
    const rocket = this.databus.pool.getItemByClass('rocket', Rocket);
    if (!rocket) {
      this.rocketTimer = 10;
      return;
    }
    try {
      rocket.init(speed);
      this.databus.rockets.push(rocket);
    } catch (e) {
      console.error('[Rocket] init崩溃:', e);
      this.rocketTimer = 10;
      return;
    }

    this.rocketTimer = cooldown;
  }

  _updatePipes() {
    for (let i = this.databus.pipes.length - 1; i >= 0; i--) {
      this.databus.pipes[i].update();
    }
  }

  _updateProps() {
    for (let i = this.databus.props.length - 1; i >= 0; i--) {
      const prop = this.databus.props[i];
      if (prop.collected) continue;
      prop.x -= prop.speed;

      /* 跟随移动水管同步更新Y坐标 */
      prop.syncYWithMovingPipe();

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
        this.databus.removeSaw(saw);
      }
    }
  }

  _updateRockets() {
    for (let i = this.databus.rockets.length - 1; i >= 0; i--) {
      const rocket = this.databus.rockets[i];
      rocket.update();
      if (rocket.x + rocket.width < -30 || rocket.x > SCREEN_WIDTH + 300
          || rocket.y + rocket.height < -30 || rocket.y > SCREEN_HEIGHT + 30) {
        this.databus.removeRocket(rocket);
      }
    }
  }

  _checkCollisions() {
    if (!this.player.isActive || !this.player.visible) return;

    /* 水管碰撞 */
    for (let i = this.databus.pipes.length - 1; i >= 0; i--) {
      const pipe = this.databus.pipes[i];
      if (pipe.isCollideWithBird(this.player)) {
        if (this.databus.invincibleTimer > 0) continue;
        if (this._tryConsumeShield(pipe)) continue;
        this._onPlayerHit();
        return;
      }
    }

    /* 锯片碰撞 */
    for (let i = this.databus.saws.length - 1; i >= 0; i--) {
      const saw = this.databus.saws[i];
      if (saw.isCollideWithBird(this.player)) {
        if (this.databus.invincibleTimer > 0) continue;
        if (this._tryConsumeShield(saw)) continue;
        this._onPlayerHit();
        return;
      }
    }

    /* 火箭碰撞 */
    for (let i = this.databus.rockets.length - 1; i >= 0; i--) {
      const rocket = this.databus.rockets[i];
      if (rocket.isCollideWithBird(this.player)) {
        if (this.databus.invincibleTimer > 0) continue;
        if (this._tryConsumeShield(rocket)) continue;
        this._onPlayerHit();
        return;
      }
    }

    /* 道具碰撞 */
    for (let i = this.databus.props.length - 1; i >= 0; i--) {
      const prop = this.databus.props[i];
      if (prop.collected) continue;
      if (this._isPropCollideWithPlayer(prop)) {
        prop.collect();
        /* 从数组中移除，释放位置给新道具 */
        this.databus.props.splice(i, 1);
        this.databus.pool.recover('prop', prop);
        /* 道具拾取音效 */
        if (prop.type === 'shield') {
          GameGlobal.sound.playShieldPickup();
        } else {
          GameGlobal.sound.playScoreX2();
        }
      }
    }
  }

  /** 护盾抵挡碰撞：消耗护盾并移除障碍物，返回 true 表示护盾生效 */
  _tryConsumeShield(entity) {
    if (!this.databus.shieldActive) return false;

    if (this.databus.pipes.includes(entity)) {
      this.databus.removePipe(entity);
    } else if (this.databus.saws.includes(entity)) {
      this.databus.removeSaw(entity);
    } else if (this.databus.rockets.includes(entity)) {
      this.databus.removeRocket(entity);
    }
    this.databus.shieldActive = false;
    this.databus.shieldTimer = 0;
    GameGlobal.sound.playShieldBreak();
    return true;
  }

  _isPropCollideWithPlayer(prop) {
    const pcx = this.player.x + this.player.width / 2;
    const pcy = this.player.y + this.player.height / 2;
    const propCx = prop.x + prop.width / 2;
    const propCy = prop.y + prop.height / 2;
    const dx = pcx - propCx;
    const dy = pcy - propCy;
    const threshold = this.player.width / 2 + prop.width / 2;
    return dx * dx + dy * dy < threshold * threshold;
  }

  _updateTimers() {
    if (this.databus.invincibleTimer > 0) {
      this.databus.invincibleTimer--;
    }
    if (this.databus.shieldActive) {
      this.databus.shieldTimer--;
      if (this.databus.shieldTimer <= 0) {
        this.databus.shieldActive = false;
      }
    }
    if (this.databus.scoreMultiplier > 1) {
      this.databus.multiplierTimer--;
      if (this.databus.multiplierTimer <= 0) this.databus.scoreMultiplier = 1;
    }
    /* 道具冷却计时器（每帧递减，真正的帧计数） */
    if (this.propTimer > 0) this.propTimer--;
  }

  /** 应用震动和屏幕抖动反馈（根据玩家设置） */
  _applyHitFeedback() {
    if (GameGlobal.settings && GameGlobal.settings.vibrate && typeof wx.vibrateShort === 'function') {
      wx.vibrateShort({ type: 'light' });
    }
    if (GameGlobal.settings && GameGlobal.settings.screenShake) {
      this._shakeTimer = Math.max(this._shakeTimer, 8);
      this._shakeIntensity = Math.max(this._shakeIntensity, 6);
    }
  }

  /* 玩家受伤：扣一条命，短暂无敌 */
  _onPlayerHit() {
    this.databus.lives--;
    if (GameGlobal.DEBUG_LOG) console.log(`[Player] 受伤! 剩余生命=${this.databus.lives}`);
    GameGlobal.sound.playHit();
    this._applyHitFeedback();

    if (this.databus.lives <= 0) {
      this.player.destroy();
      this.databus.gameOver();
      GameGlobal.sound.playDie();
    } else {
      this.databus.invincibleTimer = PLAYER.INVINCIBLE_DURATION;
    }
  }

  /* ========== 渲染 ========== */
  render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    /* 屏幕抖动偏移 */
    /* 检查来自 player/index.js 地面碰撞的抖动/振动请求 */
    if (GameGlobal._requestPlayerHitFeedback) {
      this._applyHitFeedback();
      GameGlobal._requestPlayerHitFeedback = false;
    }
    const shakeX = this._shakeTimer > 0 ? (Math.random() - 0.5) * this._shakeIntensity : 0;
    const shakeY = this._shakeTimer > 0 ? (Math.random() - 0.5) * this._shakeIntensity : 0;
    if (this._shakeTimer > 0) this._shakeTimer--;

    /* 1. 背景全屏渲染（无缩放变换，填满 Canvas） */
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, shakeX, shakeY);
    this.bg.renderFullScreen(ctx);
    ctx.restore();

    /* 2. 游戏元素在设计分辨率空间内渲染（应用缩放变换 + 抖动偏移） */
    ctx.save();
    ctx.setTransform(GAME_SCALE, 0, 0, GAME_SCALE, GAME_OFFSET_X + shakeX, GAME_OFFSET_Y + shakeY);

    if (this.screenState === SCREEN_STATE.HOME) {
      this.gameInfo.renderHome(ctx);
    } else if (this.screenState === SCREEN_STATE.LEADERBOARD) {
      this.gameInfo.renderLeaderboard(ctx);
    } else if (this.screenState === SCREEN_STATE.READY) {
      this._renderGameEntities(ctx);
      this.gameInfo.renderReady(ctx);
    } else if (this.screenState === SCREEN_STATE.PAUSED) {
      this._renderGameEntities(ctx);
      this.gameInfo.renderLocal(ctx, this.databus);
      this.gameInfo.renderPauseOverlay(ctx);
    } else if (this.screenState === SCREEN_STATE.COUNTDOWN) {
      this._renderGameEntities(ctx);
      this.gameInfo.renderLocal(ctx, this.databus);
      this.gameInfo.renderCountdown(ctx);
    } else if (this.screenState === SCREEN_STATE.SETTINGS) {
      this.gameInfo.renderSettings(ctx);
    } else {
      this._renderGameEntities(ctx);
      this.gameInfo.renderLocal(ctx, this.databus);
    }

    ctx.restore();
  }

  /** 渲染所有游戏实体：水管、道具、锯片、火箭、玩家 */
  _renderGameEntities(ctx) {
    this.databus.pipes.forEach((p) => p.render(ctx));
    this.databus.props.forEach((p) => p.render(ctx));
    this.databus.saws.forEach((s) => s.render(ctx));
    this.databus.rockets.forEach((r) => r.render(ctx));
    this.player.render(ctx);
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