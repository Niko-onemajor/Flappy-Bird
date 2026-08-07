import Pool from './base/pool';

let instance;

/**
 * 全局状态管理器
 */
export default class DataBus {
  pipes = [];          /* 水管障碍物数组 */
  props = [];          /* 道具数组 */
  saws = [];           /* 圆锯障碍物数组 */
  rockets = [];        /* 火箭障碍物数组 */
  animations = [];     /* 动画数组 */
  frame = 0;           /* 当前帧数 */
  score = 0;           /* 当前分数 */
  isGameOver = false;  /* 游戏是否结束 */
  pool = new Pool();   /* 对象池 */

  /* 道具状态 */
  shieldActive = false;    /* 护盾是否激活 */
  shieldTimer = 0;         /* 护盾剩余时间 */
  scoreMultiplier = 1;     /* 分数倍率 */
  multiplierTimer = 0;     /* 倍率剩余时间 */

  /* 生命系统 */
  lives = 3;               /* 剩余生命 */
  invincibleTimer = 0;     /* 无敌时间（帧） */

  constructor() {
    if (instance) return instance;
    instance = this;
  }

  reset() {
    this.frame = 0;
    this.score = 0;
    this.pipes = [];
    this.props = [];
    this.saws = [];
    this.rockets = [];
    this.animations = [];
    this.isGameOver = false;
    this.shieldActive = false;
    this.shieldTimer = 0;
    this.scoreMultiplier = 1;
    this.multiplierTimer = 0;
    this.lives = 3;
    this.invincibleTimer = 0;
  }

  gameOver() {
    this.isGameOver = true;
  }

  removePipe(pipe) {
    const idx = this.pipes.indexOf(pipe);
    if (idx > -1) {
      this.pipes.splice(idx, 1);
      this.pool.recover('pipe', pipe);
    }
  }

  removeProp(prop) {
    const idx = this.props.indexOf(prop);
    if (idx > -1) {
      this.props.splice(idx, 1);
      this.pool.recover('prop', prop);
    }
  }

  removeSaw(saw) {
    const idx = this.saws.indexOf(saw);
    if (idx > -1) {
      this.saws.splice(idx, 1);
      this.pool.recover('saw', saw);
    }
  }

  removeRocket(rocket) {
    const idx = this.rockets.indexOf(rocket);
    if (idx > -1) {
      rocket.cleanup();
      this.rockets.splice(idx, 1);
      this.pool.recover('rocket', rocket);
    }
  }
}