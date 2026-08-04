import './render';
import Player from './player/index';
import Pipe from './npc/pipe';
import Prop from './npc/prop';
import BackGround from './runtime/background';
import GameInfo from './runtime/gameinfo';
import Sound from './sound';
import DataBus from './databus';

const ctx = canvas.getContext('2d');

GameGlobal.databus = new DataBus();
GameGlobal.sound = new Sound();

const SCREEN_STATE = {
  HOME: 'home',
  PLAYING: 'playing',
};

/* 全局屏幕状态，供 gameinfo 等模块读取 */
GameGlobal.screenState = SCREEN_STATE.HOME;

/* 难度参数 */
const PIPE_INTERVAL_BASE = 100;   /* 基础水管间隔（帧） */
const PIPE_INTERVAL_MIN = 60;     /* 最小水管间隔 */
const PIPE_SPEED_BASE = 3;        /* 基础水管速度 */
const PIPE_SPEED_MAX = 6.5;       /* 最大水管速度 */
const PIPE_GAP_BASE = 130;        /* 基础水管间隙 */
const PIPE_GAP_MIN = 85;          /* 最小水管间隙 */
const DIFFICULTY_STEP = 5;        /* 每N分提升一次难度 */

/* 水管最小间距：防止两对水管堵死路径 */
const PIPE_MIN_SPACING = 220;     /* 两对水管之间最小像素距离 */

/* 道具生成参数 */
const PROP_INTERVAL_BASE = 180;   /* 基础道具间隔（帧），约3秒 */
const PROP_INTERVAL_MIN = 120;    /* 最小道具间隔 */

/**
 * 横版点击跳跃小游戏主循环
 */
export default class Main {
  aniId = 0;
  bg = new BackGround();
  player = new Player();
  gameInfo = new GameInfo();
  screenState = SCREEN_STATE.HOME;

  /* 水管生成计时器 */
  pipeTimer = 0;
  lastPipeX = 0;

  /* 道具生成计时器 */
  propTimer = 0;

  constructor() {
    this.gameInfo.on('start', this.startGame.bind(this));
    this.gameInfo.on('restart', this.restartGame.bind(this));
    this.gameInfo.on('backToHome', this.goToHome.bind(this));
    this.loop();
  }

  /* 根据当前分数计算难度参数 */
  getDifficulty() {
    const db = GameGlobal.databus;
    const level = Math.floor(db.score / DIFFICULTY_STEP);

    return {
      speed: Math.min(PIPE_SPEED_BASE + level * 0.35, PIPE_SPEED_MAX),
      gap: Math.max(PIPE_GAP_BASE - level * 5, PIPE_GAP_MIN),
      interval: Math.max(PIPE_INTERVAL_BASE - level * 4, PIPE_INTERVAL_MIN),
      propInterval: Math.max(PROP_INTERVAL_BASE - level * 6, PROP_INTERVAL_MIN),
    };
  }

  /* 返回主页 */
  goToHome() {
    this.screenState = SCREEN_STATE.HOME;
    GameGlobal.screenState = SCREEN_STATE.HOME;
    GameGlobal.databus.reset();
    GameGlobal.sound.stopAll();
    cancelAnimationFrame(this.aniId);
    this.aniId = requestAnimationFrame(this.loop.bind(this));
  }

  /* 开始游戏 */
  startGame() {
    GameGlobal.databus.reset();
    this.player.init();
    this.screenState = SCREEN_STATE.PLAYING;
    GameGlobal.screenState = SCREEN_STATE.PLAYING;
    this.pipeTimer = 0;
    this.lastPipeX = 0;
    this.propTimer = 0;
    GameGlobal.sound.playBgm();
    cancelAnimationFrame(this.aniId);
    this.aniId = requestAnimationFrame(this.loop.bind(this));
  }

  /* 重新开始 */
  restartGame() {
    this.startGame();
  }

  /* 生成水管：计时器 + 最小间距双重保障 */
  pipeGenerate() {
    const diff = this.getDifficulty();

    this.pipeTimer--;
    if (this.pipeTimer > 0) return;

    /* 检查上一对水管是否已走远，防止两对水管挤在一起 */
    if (this.lastPipeX > 0) {
      /* 上一对水管当前X位置（从SCREEN_WIDTH出发，每帧减speed） */
      const prevX = this.lastPipeX;
      if (prevX > SCREEN_WIDTH - PIPE_MIN_SPACING) {
        return; /* 上一对还没走远，等下一帧 */
      }
    }

    const pipe = GameGlobal.databus.pool.getItemByClass('pipe', Pipe);
    pipe.init(diff.gap, diff.speed);
    GameGlobal.databus.pipes.push(pipe);

    this.lastPipeX = pipe.x;
    this.pipeTimer = diff.interval;
  }

  /* 生成道具：计时器 + 最小间距 */
  propGenerate() {
    const diff = this.getDifficulty();

    this.propTimer--;
    if (this.propTimer > 0) return;

    const prop = GameGlobal.databus.pool.getItemByClass('prop', Prop);
    prop.init(null, GameGlobal.databus.pipes);
    GameGlobal.databus.props.push(prop);

    this.propTimer = diff.propInterval + Math.floor(Math.random() * 40);
  }

  /* 碰撞检测 */
  collisionDetection() {
    const db = GameGlobal.databus;
    const player = this.player;

    for (let i = 0; i < db.pipes.length; i++) {
      const pipe = db.pipes[i];

      if (pipe.isCollideWithBird(player)) {
        if (db.shieldActive) {
          db.pipes.splice(i, 1);
          i--;
          continue;
        }
        player.destroy();
        db.gameOver();
        GameGlobal.sound.playHit();
        GameGlobal.sound.playDie();
        break;
      }

      /* 通过水管，计分 */
      if (!pipe.scored && pipe.x + pipe.width < player.x) {
        pipe.scored = true;
        db.score += db.scoreMultiplier;
        GameGlobal.sound.playPoint();
      }
    }

    /* 道具碰撞 */
    for (let i = 0; i < db.props.length; i++) {
      const prop = db.props[i];
      if (prop.isCollideWith(player) && !prop.collected) {
        prop.collect();
        GameGlobal.sound.playPoint();
      }
    }
  }

  /* 更新所有实体 */
  update() {
    if (this.screenState !== SCREEN_STATE.PLAYING) return;
    if (GameGlobal.databus.isGameOver) return;

    GameGlobal.databus.frame++;
    this.bg.update();
    this.player.update();
    this.pipeGenerate();
    this.propGenerate();
    GameGlobal.databus.pipes.forEach((p) => p.update());
    GameGlobal.databus.props.forEach((p) => p.update());
    this.collisionDetection();
    this.updatePropTimers();
  }

  /* 更新道具剩余时间 */
  updatePropTimers() {
    const db = GameGlobal.databus;
    if (db.shieldActive) {
      db.shieldTimer--;
      if (db.shieldTimer <= 0) db.shieldActive = false;
    }
    if (db.scoreMultiplier > 1) {
      db.multiplierTimer--;
      if (db.multiplierTimer <= 0) db.scoreMultiplier = 1;
    }
  }

  /* 渲染 */
  render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (this.screenState === SCREEN_STATE.HOME) {
      this.bg.render(ctx);
      this.gameInfo.renderHome(ctx);
    } else {
      this.bg.render(ctx);
      GameGlobal.databus.pipes.forEach((p) => p.render(ctx));
      GameGlobal.databus.props.forEach((p) => p.render(ctx));
      this.player.render(ctx);
      this.gameInfo.render(ctx);
    }

    GameGlobal.databus.animations.forEach((ani) => {
      if (ani.isPlaying) ani.aniRender(ctx);
    });
  }

  /* 主循环 */
  loop() {
    this.update();
    this.render();
    this.aniId = requestAnimationFrame(this.loop.bind(this));
  }
}