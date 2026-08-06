import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import { GROUND, SAW as SAW_CFG } from '../config';

const SAW_RADIUS = SAW_CFG.RADIUS;
const SAW_SIZE = SAW_RADIUS * 2;

/* 预加载圆锯图片 */
const SAW_IMG = (() => { const img = wx.createImage(); img.src = 'images/circular saw.png'; return img; })();

export default class Saw extends Sprite {
  rotation = 0;
  speed = 3;

  constructor() {
    super('', SAW_SIZE, SAW_SIZE);
  }

  init(speed, pipe) {
    this.visible = true;
    this.isActive = true;
    this.speed = speed;
    this.rotation = Math.random() * Math.PI * 2;
    this.x = SCREEN_WIDTH + 20 + Math.random() * 80;

    /* 根据水管位置计算锯片的Y坐标，确保留出可通过的空间 */
    this.y = this._calcSawY(pipe);
  }

  _calcSawY(pipe) {
    const availableH = SCREEN_HEIGHT - GROUND.HEIGHT;
    const birdH = 24;
    const minClearance = birdH * 2.5;  /* 至少留出2.5倍鸟高的空间 */

    const hasTop = pipe.pipeType === 0 || pipe.pipeType === 1 || pipe.pipeType === 3;
    const hasBottom = pipe.pipeType === 0 || pipe.pipeType === 2 || pipe.pipeType === 3;

    if (hasTop && hasBottom) {
      /* 双管：锯片放在间隙上或下，迫使玩家调整位置 */
      const gapCenter = pipe.gapY + pipe.gap / 2;
      const safeTop = pipe.gapY + minClearance;
      const safeBottom = pipe.gapY + pipe.gap - minClearance;

      if (safeBottom - safeTop < SAW_SIZE) {
        /* 间隙太小，不放在间隙内，放在上方或下方 */
        return Math.random() < 0.5
          ? Math.max(40, pipe.gapY - SAW_SIZE - 20)
          : Math.min(availableH - SAW_SIZE, pipe.gapY + pipe.gap + 20);
      }
      /* 放在间隙内但偏移中心，迫使玩家选择上或下 */
      const offset = (safeBottom - safeTop - SAW_SIZE) * 0.35;
      return Math.random() < 0.5
        ? safeTop + offset
        : safeBottom - SAW_SIZE - offset;
    }

    if (hasBottom) {
      /* 只有下管：放在下管上方，留出可通过空间 */
      const maxY = pipe.gapY - SAW_SIZE - minClearance;
      if (maxY < 40) return Math.max(40, pipe.gapY - SAW_SIZE - 4);
      return 40 + Math.random() * Math.max(0, maxY - 40);
    }

    if (hasTop) {
      /* 只有上管：放在上管下方，留出可通过空间 */
      const minY = pipe.gapY + minClearance;
      const maxY = availableH - SAW_SIZE - 20;
      if (minY > maxY) return Math.min(maxY, pipe.gapY + SAW_SIZE + 4);
      return minY + Math.random() * (maxY - minY);
    }

    return availableH / 2;
  }

  update() {
    if (GameGlobal.databus.isGameOver) return;
    this.x -= this.speed;
    this.rotation += 0.08;
  }

  render(ctx) {
    if (!this.visible) return;

    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const r = this.width / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation);

    /* 外发光 */
    ctx.shadowColor = 'rgba(255, 60, 30, 0.6)';
    ctx.shadowBlur = 10;

    ctx.drawImage(SAW_IMG, -r, -r, this.width, this.height);

    ctx.restore();
  }

  isCollideWithBird(bird) {
    if (!this.visible || !bird.visible || !bird.isActive) return false;

    const pcx = bird.x + bird.width / 2;
    const pcy = bird.y + bird.height / 2;
    const scx = this.x + this.width / 2;
    const scy = this.y + this.height / 2;
    const dx = pcx - scx;
    const dy = pcy - scy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const hitR = this.width / 2 - 4;  /* 缩小碰撞半径，更友好 */

    return dist < (bird.width / 2 + hitR);
  }
}