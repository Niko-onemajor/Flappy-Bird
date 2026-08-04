import Pool from './base/pool';

let instance;

/**
 * 全局状态管理器
 */
export default class DataBus {
  pipes = [];          // 水管障碍物数组
  animations = [];     // 动画数组
  frame = 0;           // 当前帧数
  score = 0;           // 当前分数
  isGameOver = false;  // 游戏是否结束
  pool = new Pool();   // 对象池

  constructor() {
    if (instance) return instance;
    instance = this;
  }

  reset() {
    this.frame = 0;
    this.score = 0;
    this.pipes = [];
    this.animations = [];
    this.isGameOver = false;
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
}