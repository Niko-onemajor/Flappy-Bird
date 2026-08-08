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
import { PLAYER, PIPE, SAW as SAW_CFG, ROCKET as ROCKET_CFG, PROP } from './config';

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
const GRAVITY = PLAYER.GRAVITY;
const MAX_FALL_SPEED = PLAYER.MAX_FALL_SPEED;
const SAW_MIN_SCORE = SAW_CFG.MIN_SCORE;
const SAW_SPAWN_CHANCE = SAW_CFG.SPAWN_CHANCE;
const ROCKET_MIN_SCORE = ROCKET_CFG.MIN_SCORE;
/* 火箭动态难度：maxRockets 和 cooldown 由 _getRocketLevel 根据分数计算 */

/* 碰撞箱可视化调试开关 */
GameGlobal.DEBUG_COLLISION = false;

/* 调试日志开关 */
GameGlobal.DEBUG_LOG = false;

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
  _scoreSubmitting = false;   /* 分数提交中标志，防止重复提交 */
  _scoreRetryTimer = 0;      /* 分数提交重试计时器 */
  _scoreRetryCount = 0;      /* 分数提交重试次数 */
  _deathTimer = -1;          /* 死亡动画计时器（-1=未激活） */
  _deathFadeAlpha = 0;       /* 死亡画面渐暗透明度 */
  _deathFlashTimer = 0;      /* 死亡闪白计时器 */
  _countdownTimer = 0;
  _countdownStart = 0;
  _prevScreenState = null;
  _shakeTimer = 0;          /* 屏幕抖动剩余帧数 */
  _shakeIntensity = 0;      /* 屏幕抖动强度 */
  _staticFrameCount = 0;    /* 静态状态帧计数器，用于降帧 */
  _lastMilestone = 0;        /* 上次触发的分数里程碑 */
  _cachedDifficulty = null;  /* 难度参数缓存，分数变化时刷新 */

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

  /* ========== 难度计算（缓存结果，分数不变时避免重复计算） ========== */
  _getDifficulty() {
    const score = this.databus.score;
    if (this._cachedDifficulty && this._cachedDifficulty.score === score) {
      return this._cachedDifficulty.data;
    }
    const level = score / DIFFICULTY_STEP;
    this._cachedDifficulty = {
      score,
      data: {
        speed: Math.min(SPEED_BASE + level * SPEED_INCREMENT, SPEED_MAX),
        gap: Math.max(GAP_BASE - level * GAP_DECREMENT, GAP_MIN),
        interval: Math.max(INTERVAL_BASE - level * INTERVAL_DECREMENT, INTERVAL_MIN),
        propChance: Math.min(PROP_CHANCE_BASE + level * PROP_CHANCE_INCREMENT, 0.65),
      },
    };
    return this._cachedDifficulty.data;
  }

  /* ========== 屏幕状态切换 ========== */
  goToHome() {
    this.screenState = SCREEN_STATE.HOME;
    GameGlobal.screenState = SCREEN_STATE.HOME;
    GameGlobal.isGameOverServer = false;
    this._scoreSubmitted = false;
    this._scoreSubmitting = false;
    this._scoreRetryTimer = 0;
    this._deathTimer = -1;
    this._deathFadeAlpha = 0;
    this._deathFlashTimer = 0;
    GameGlobal.sound.stopAll();
    cancelAnimationFrame(this.aniId);
    this.aniId = requestAnimationFrame(this._boundLoop);
  }

  startGame() {
    this.databus.reset();
    this._staticFrameCount = 0;  /* 重置静态帧计数器 */
    this.player.init();
    this.pipeTimer = 0;
    this.propTimer = 0;
    this.rocketTimer = 0;
    this._lastPropScore = 0;
    this._pipesSinceLastProp = 0;
    this._scoreSubmitted = false;
    this._scoreSubmitting = false;
    this._scoreRetryTimer = 0;
    this._deathTimer = -1;
    this._deathFadeAlpha = 0;
    this._deathFlashTimer = 0;
    this._lastMilestone = 0;
    this.gameInfo._milestoneEffectTimer = 0;
    this.gameInfo._scoreGlowCache = null;  /* 清理辉光缓存，避免分数变化后残留旧缓存 */
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
    this.gameInfo._leaderboardLoading = true;
    this.gameInfo._leaderboardData = null;
    try {
      const data = await getTopScores(30);
      this.gameInfo._leaderboardData = data;
      this.gameInfo._cacheLeaderboardFormattedDates(data);
    } catch (err) {
      console.error('[Main] 获取排行榜失败:', err);
    }
    this.gameInfo._leaderboardLoading = false;
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
    if (this.databus.score <= 0) { this._scoreSubmitted = true; return; }
    this._scoreRetryCount = 0;
    try {
      await submitScore('Player', this.databus.score);
      this._scoreSubmitted = true;
      console.log('[Main] 分数提交成功');
    } catch (err) {
      console.error('[Main] 提交分数失败，3秒后重试:', err);
      this._scoreRetryTimer = 180;  /* 3秒后重试 */
      this._scoreRetryCount = 1;
    }
    this._scoreSubmitting = false;
  }

  /** 分数提交重试（每帧调用，由 game over 块触发） */
  _retryScoreSubmission() {
    if (this._scoreSubmitted) return;
    if (this._scoreRetryTimer <= 0) return;
    this._scoreRetryTimer--;
    if (this._scoreRetryTimer > 0) return;
    if (this._scoreRetryCount >= 3) {
      console.error('[Main] 分数提交重试耗尽，放弃');
      this._scoreSubmitted = true;  /* 停止重试 */
      return;
    }
    this._scoreRetryCount++;
    submitScore('Player', this.databus.score)
      .then(() => {
        this._scoreSubmitted = true;
        console.log('[Main] 分数提交重试成功');
      })
      .catch((err) => {
        console.error(`[Main] 分数提交重试第${this._scoreRetryCount}次失败:`, err);
        this._scoreRetryTimer = 180;  /* 再等3秒 */
      });
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

    /* ===== 死亡动画阶段：小鸟坠落 + 画面渐暗 ===== */
    if (this._deathTimer >= 0) {
      this._deathTimer--;
      this._deathFadeAlpha = 1 - this._deathTimer / 60;  /* 0→1 */
      this.player.vy += GRAVITY;
      this.player.vy = Math.min(this.player.vy, MAX_FALL_SPEED);
      this.player.y += this.player.vy;
      this.player.currentRotation += (90 - this.player.currentRotation) * 0.05;

      /* 坠落到地面时停住 */
      const groundY = SCREEN_HEIGHT - 90 - this.player.height;
      if (this.player.y >= groundY) {
        this.player.y = groundY;
        this.player.vy = 0;
      }

      if (this._deathTimer <= 0) {
        this.player.destroy();
        this.databus.gameOver();
        GameGlobal.isGameOverServer = true;
        GameGlobal.sound.stopRocketFly();
        if (!this._scoreSubmitted) {
          this._scoreSubmitted = true;
          this.submitScoreToServer();
        }
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

        /* 分数里程碑提示：每10分播放提升音效 + 分数视觉特效 */
        const s = this.databus.score;
        const milestone = Math.floor(s / 10) * 10;
        if (milestone >= 10 && milestone > this._lastMilestone) {
          this._lastMilestone = milestone;
          GameGlobal.sound.playSwoosh();
          /* 触发分数视觉特效（金色放大+弹跳），替代屏幕抖动避免影响手感 */
          this.gameInfo._milestoneEffectTimer = 25;
        }
      }
    }

    /* 游戏结束处理（仅提交分数和清理，音效已在碰撞时播放） */
    if (this.databus.isGameOver) {
      GameGlobal.isGameOverServer = true;
      GameGlobal.sound.stopRocketFly();
      if (!this._scoreSubmitted && !this._scoreSubmitting) {
        this._scoreSubmitting = true;
        this.submitScoreToServer();
      }
      this._retryScoreSubmission();  /* 每帧检查重试计时器 */
    }
  }

  _generatePipes() {
    const { speed, gap, interval, propChance } = this._getDifficulty();

    this.pipeTimer--;
    if (this.pipeTimer > 0) return;

    /* 间距检查：若上一根水管离屏幕右边缘太近，计算需要等待的精确帧数，避免忙碌等待 */
    if (this.databus.pipes.length > 0) {
      const last = this.databus.pipes[this.databus.pipes.length - 1];
      if (last.x > SCREEN_WIDTH - MIN_SPACING) {
        const dist = last.x - (SCREEN_WIDTH - MIN_SPACING);
        this.pipeTimer = Math.max(1, Math.ceil(dist / speed));
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
    const prop = this.databus.pool.getItemByClass('prop', Prop);
    prop.init(pipe);  /* 内部基于水管精确计算X和Y */
    this.databus.props.push(prop);
  }

  _createSawForPipe(pipe, pipeSpeed) {
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
      prop.animPhase += PROP.FLOAT_SPEED;  /* 保持漂浮动画活跃 */

      /* 跟随移动水管同步更新Y坐标 */
      prop.syncYWithMovingPipe();

      if (prop.x + prop.width < -10) {
        this.databus.props.splice(i, 1);
        this.databus.pool.recover('prop', prop);
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
      if (rocket.x + rocket.width < -30 || rocket.x > SCREEN_WIDTH + 300
          || rocket.y + rocket.height < -30 || rocket.y > SCREEN_HEIGHT + 30) {
        rocket.cleanup();
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

  /** 护盾抵挡碰撞：消耗护盾并移除障碍物，返回 true 表示护盾生效
   *  使用 instanceof 替代 includes 判断，避免实体已被回收导致的二次调用风险 */
  _tryConsumeShield(entity) {
    if (!this.databus.shieldActive) return false;

    if (entity instanceof Pipe) {
      this.databus.removePipe(entity);
    } else if (entity instanceof Saw) {
      this.databus.removeSaw(entity);
    } else if (entity instanceof Rocket) {
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
      /* 启动死亡动画（小鸟坠落+画面渐暗），而非立即结束 */
      this._deathTimer = 60;  /* 1秒动画 */
      this._deathFadeAlpha = 0;
      this._deathFlashTimer = 8;  /* 碰撞闪白8帧 */
      GameGlobal.sound.playDie();
      if (GameGlobal.settings && GameGlobal.settings.vibrate && typeof wx.vibrateShort === 'function') {
        wx.vibrateShort({ type: 'heavy' });
      }
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

    /* 3. 死亡动画效果 */
    if (this._deathTimer >= 0) {
      /* 闪白效果（碰撞瞬间） */
      if (this._deathFlashTimer > 0) {
        this._deathFlashTimer--;
        const flashAlpha = this._deathFlashTimer / 8;  /* 1→0 衰减 */
        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha * 0.5})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      /* 渐暗遮罩 */
      const alpha = 0.2 + this._deathFadeAlpha * 0.25;  /* 0.2 → 0.45 */
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
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
      this.render();
    } else {
      /* 静态状态（HOME/SETTINGS/LEADERBOARD/PAUSED）：降帧到约 20fps，减少 CPU/GPU 开销 */
      this._staticFrameCount++;
      if (this._staticFrameCount % 3 === 0) {
        this.render();
      }
    }

    this.aniId = requestAnimationFrame(this._boundLoop);
  }
}