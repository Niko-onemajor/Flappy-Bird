import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';

const BG_IMG_SRC = 'images/bg.jpg';
const BG_WIDTH = 512;
const BG_HEIGHT = 512;
const BG_SPEED = 2;

/**
 * 横版横向滚动背景
 */
export default class BackGround extends Sprite {
  constructor() {
    super(BG_IMG_SRC, BG_WIDTH, BG_HEIGHT);
    this.left = 0;
  }

  update() {
    if (GameGlobal.databus.isGameOver) return;
    this.left += BG_SPEED;
    if (this.left >= SCREEN_WIDTH) {
      this.left = 0;
    }
  }

  render(ctx) {
    // 绘制两张图片实现横向无缝滚动
    ctx.drawImage(
      this.img,
      0, 0, this.width, this.height,
      -this.left, 0, SCREEN_WIDTH, SCREEN_HEIGHT
    );
    ctx.drawImage(
      this.img,
      0, 0, this.width, this.height,
      SCREEN_WIDTH - this.left, 0, SCREEN_WIDTH, SCREEN_HEIGHT
    );
  }
}