import Pool from './base/pool';

let instance;

/**
 * 全局状态管理器
 */
export default class DataBus {
  pipes = [];          /* 水管障碍物数组 */
  props = [];          /* 道具数组 */
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

  constructor() {
    if (instance) return instance;
    instance = this;
  }

  reset() {
    this.frame = 0;
    this.score = 0;
    this.pipes = [];
    this.props = [];
    this.animations = [];
    this.isGameOver = false;
    this.shieldActive = false;
    this.shieldTimer = 0;
    this.scoreMultiplier = 1;
    this.multiplierTimer = 0;
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
}