import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';

const PIPE_WIDTH = 60;
const PIPE_GAP = 150;       // 上下水管之间的间隙
const PIPE_SPEED = 4;       // 水管向左移动速度
const GROUND_Y_OFFSET = 50; // 地面偏移

export default class Pipe extends Sprite {
  scored = false; // 是否已经计过分

  constructor() {
    super('', PIPE_WIDTH, 0);
    this.topImg = wx.createImage();
    this.bottomImg = wx.createImage();
    this.topImg.src = 'images/enemy.png';
    this.bottomImg.src = 'images/enemy.png';
  }

  init() {
    this.visible = true;
    this.isActive = true;
    this.scored = false;

    // 水管从屏幕右侧出现
    this.x = SCREEN_WIDTH;

    // 随机生成间隙的垂直位置
    const minY = 80;
    const maxY = SCREEN_HEIGHT - GROUND_Y_OFFSET - PIPE_GAP - 80;
    this.gapY = minY + Math.random() * (maxY - minY);
  }

  update() {
    if (GameGlobal.databus.isGameOver) return;
    this.x -= PIPE_SPEED;

    // 离开屏幕左侧时回收
    if (this.x + this.width < 0) {
      GameGlobal.databus.removePipe(this);
    }
  }

  render(ctx) {
    if (!this.visible) return;

    const availableHeight = SCREEN_HEIGHT - GROUND_Y_OFFSET;

    // 绘制上方水管（从顶部到gapY）
    const topHeight = this.gapY;
    ctx.drawImage(this.topImg, this.x, 0, this.width, topHeight);

    // 绘制下方水管（从gapY+PIPE_GAP到底部）
    const bottomY = this.gapY + PIPE_GAP;
    const bottomHeight = availableHeight - bottomY;
    if (bottomHeight > 0) {
      ctx.drawImage(this.bottomImg, this.x, bottomY, this.width, bottomHeight);
    }
  }

  // 碰撞检测：小鸟的矩形是否与上水管或下水管重叠
  isCollideWithBird(bird) {
    const bx = bird.x;
    const by = bird.y;
    const bw = bird.width;
    const bh = bird.height;

    // 上水管碰撞
    if (
      bx + bw > this.x &&
      bx < this.x + this.width &&
      by < this.gapY
    ) {
      return true;
    }

    // 下水管碰撞
    const bottomY = this.gapY + PIPE_GAP;
    if (
      bx + bw > this.x &&
      bx < this.x + this.width &&
      by + bh > bottomY
    ) {
      return true;
    }

    return false;
  }
}