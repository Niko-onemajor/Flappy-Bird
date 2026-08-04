import './render';
import Player from './player/index';
import Pipe from './npc/pipe';
import BackGround from './runtime/background';
import GameInfo from './runtime/gameinfo';
import DataBus from './databus';

const PIPE_INTERVAL = 100; // 每100帧生成一根水管
const ctx = canvas.getContext('2d');

GameGlobal.databus = new DataBus();

/**
 * 横版点击跳跃小游戏主循环
 */
export default class Main {
  aniId = 0;
  bg = new BackGround();
  player = new Player();
  gameInfo = new GameInfo();

  constructor() {
    this.gameInfo.on('restart', this.start.bind(this));
    this.start();
  }

  start() {
    GameGlobal.databus.reset();
    this.player.init();
    cancelAnimationFrame(this.aniId);
    this.aniId = requestAnimationFrame(this.loop.bind(this));
  }

  pipeGenerate() {
    if (GameGlobal.databus.frame % PIPE_INTERVAL === 0) {
      const pipe = GameGlobal.databus.pool.getItemByClass('pipe', Pipe);
      pipe.init();
      GameGlobal.databus.pipes.push(pipe);
    }
  }

  collisionDetection() {
    for (let i = 0; i < GameGlobal.databus.pipes.length; i++) {
      const pipe = GameGlobal.databus.pipes[i];

      if (pipe.isCollideWithBird(this.player)) {
        this.player.destroy();
        GameGlobal.databus.gameOver();
        break;
      }

      // 小鸟通过水管，计分
      if (!pipe.scored && pipe.x + pipe.width < this.player.x) {
        pipe.scored = true;
        GameGlobal.databus.score += 1;
      }
    }
  }

  render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.bg.render(ctx);
    GameGlobal.databus.pipes.forEach((p) => p.render(ctx));
    this.player.render(ctx);
    this.gameInfo.render(ctx);
    GameGlobal.databus.animations.forEach((ani) => {
      if (ani.isPlaying) ani.aniRender(ctx);
    });
  }

  update() {
    GameGlobal.databus.frame++;

    if (GameGlobal.databus.isGameOver) return;

    this.bg.update();
    this.player.update();
    this.pipeGenerate();
    GameGlobal.databus.pipes.forEach((p) => p.update());
    this.collisionDetection();
  }

  loop() {
    this.update();
    this.render();
    this.aniId = requestAnimationFrame(this.loop.bind(this));
  }
}