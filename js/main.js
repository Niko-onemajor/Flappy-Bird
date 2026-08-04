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

/* 固定游戏参数 */
const PIPE_INTERVAL = 100;
const PIPE_SPEED = 3;
const PIPE_GAP = 140;
const PROP_SPAWN_RATE = 0.006;

/**
 * 横版点击跳跃小游戏主循环
 */
export default class Main {
  aniId = 0;
  bg = new BackGround();
  player = new Player();
  gameInfo = new GameInfo();
  screenState = SCREEN_STATE.HOME;

  constructor() {
    this.gameInfo.on('start', this.startGame.bind(this));
    this.gameInfo.on('restart', this.restartGame.bind(this));
    this.gameInfo.on('backToHome', this.goToHome.bind(this));
    this.loop();
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
    cancelAnimationFrame(this.aniId);
    this.aniId = requestAnimationFrame(this.loop.bind(this));
  }

  /* 重新开始 */
  restartGame() {
    this.startGame();
  }

  /* 生成水管 */
  pipeGenerate() {
    if (GameGlobal.databus.frame % PIPE_INTERVAL === 0) {
      const pipe = GameGlobal.databus.pool.getItemByClass('pipe', Pipe);
      pipe.init(PIPE_GAP, PIPE_SPEED);
      GameGlobal.databus.pipes.push(pipe);
    }
  }

  /* 生成道具 */
  propGenerate() {
    if (Math.random() < PROP_SPAWN_RATE) {
      const prop = GameGlobal.databus.pool.getItemByClass('prop', Prop);
      prop.init();
      GameGlobal.databus.props.push(prop);
    }
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