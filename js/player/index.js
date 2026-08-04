import Animation from '../base/animation';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';

const BIRD_IMG_SRC = 'images/hero.png';
const BIRD_WIDTH = 40;
const BIRD_HEIGHT = 40;
const GRAVITY = 0.5;       // 重力加速度
const JUMP_VELOCITY = -8;  // 跳跃初速度
const GROUND_Y_OFFSET = 50; // 地面高度偏移

export default class Player extends Animation {
  vy = 0; // 垂直速度

  constructor() {
    super(BIRD_IMG_SRC, BIRD_WIDTH, BIRD_HEIGHT);
    this.init();
    this.initEvent();
  }

  init() {
    // 小鸟在屏幕左侧 1/4 处，垂直居中
    this.x = SCREEN_WIDTH / 4;
    this.y = SCREEN_HEIGHT / 2;
    this.vy = 0;
    this.isActive = true;
    this.visible = true;
    this.rotation = 0;
  }

  initEvent() {
    wx.onTouchStart(() => {
      if (GameGlobal.databus.isGameOver) return;
      this.vy = JUMP_VELOCITY;
    });
  }

  update() {
    if (GameGlobal.databus.isGameOver) return;

    // 重力影响速度
    this.vy += GRAVITY;
    this.y += this.vy;

    // 根据速度计算旋转角度
    this.rotation = Math.min(this.vy * 3, 45);

    // 撞到天花板
    if (this.y <= 0) {
      this.y = 0;
      this.vy = 0;
    }

    // 撞到地面 → 游戏结束
    const groundY = SCREEN_HEIGHT - GROUND_Y_OFFSET - this.height;
    if (this.y >= groundY) {
      this.y = groundY;
      this.destroy();
      GameGlobal.databus.gameOver();
    }
  }

  render(ctx) {
    if (!this.visible) return;
    ctx.save();
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.drawImage(this.img, -this.width / 2, -this.height / 2, this.width, this.height);
    ctx.restore();
  }

  destroy() {
    this.isActive = false;
    this.visible = false;
  }
}