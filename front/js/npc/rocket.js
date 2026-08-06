import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import { GROUND, ROCKET as ROCKET_CFG } from '../config';

const ROCKET_W = ROCKET_CFG.WIDTH;
const ROCKET_H = ROCKET_CFG.HEIGHT;

/* 预加载火箭图片 */
const ROCKET_IMG = (() => { const img = wx.createImage(); img.src = 'images/rocket.png'; return img; })();

export default class Rocket extends Sprite {
  speed = 5;
  trailPhase = 0;

  constructor() {
    super('', ROCKET_W, ROCKET_H);
  }

  init(pipeSpeed, pipe) {
    this.visible = true;
    this.isActive = true;
    this.speed = pipeSpeed * 1.2;  /* 比水管快一点 */
    this.trailPhase = 0;
    this.x = SCREEN_WIDTH + 40 + Math.random() * 60;

    /* 计算Y坐标，确保留出可通过空间 */
    this.y = this._calcY(pipe);
  }

  _calcY(pipe) {
    const availableH = SCREEN_HEIGHT - GROUND.HEIGHT;
    const birdH = 24;
    const minClearance = birdH * 2.5;

    const hasTop = pipe.pipeType === 0 || pipe.pipeType === 1 || pipe.pipeType === 3;
    const hasBottom = pipe.pipeType === 0 || pipe.pipeType === 2 || pipe.pipeType === 3;

    if (hasTop && hasBottom) {
      /* 双管：火箭放在间隙内，迫使玩家贴边通过 */
      const safeTop = pipe.gapY + minClearance;
      const safeBottom = pipe.gapY + pipe.gap - minClearance;
      if (safeBottom - safeTop < ROCKET_H) {
        return safeTop;
      }
      /* 偏向一侧，留出另一边给玩家 */
      return Math.random() < 0.5
        ? safeTop + 10
        : safeBottom - ROCKET_H - 10;
    }

    if (hasBottom) {
      const maxY = pipe.gapY - ROCKET_H - minClearance;
      if (maxY < 40) return Math.max(40, pipe.gapY - ROCKET_H - 4);
      return 40 + Math.random() * Math.max(0, maxY - 40);
    }

    if (hasTop) {
      const minY = pipe.gapY + minClearance;
      const maxY = availableH - ROCKET_H - 20;
      if (minY > maxY) return Math.min(maxY, pipe.gapY + ROCKET_H + 4);
      return minY + Math.random() * (maxY - minY);
    }

    return availableH / 2;
  }

  update() {
    if (GameGlobal.databus.isGameOver) return;
    this.x -= this.speed;
    this.trailPhase += 0.15;
  }

  render(ctx) {
    if (!this.visible) return;

    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;

    ctx.save();

    /* 火焰尾迹 */
    const trailLen = 20 + Math.sin(this.trailPhase) * 5;
    const trailGrad = ctx.createLinearGradient(this.x + this.width, cy, this.x + this.width + trailLen, cy);
    trailGrad.addColorStop(0, 'rgba(255, 150, 30, 0.8)');
    trailGrad.addColorStop(0.5, 'rgba(255, 80, 10, 0.4)');
    trailGrad.addColorStop(1, 'rgba(255, 30, 0, 0)');
    ctx.fillStyle = trailGrad;
    ctx.fillRect(this.x + this.width, this.y + 4, trailLen, this.height - 8);

    /* 防御性渲染：检查图片是否加载完成，避免真机 drawImage 抛异常导致整个渲染中断 */
    if (ROCKET_IMG && ROCKET_IMG.complete && ROCKET_IMG.width > 0) {
      ctx.drawImage(ROCKET_IMG, this.x, this.y, this.width, this.height);
    } else {
      /* 图片未加载时的降级渲染：绘制火箭形状 */
      ctx.fillStyle = '#FF5722';
      ctx.strokeStyle = '#BF360C';
      ctx.lineWidth = 2;
      const rx = this.x + 4;
      const ry = this.y + 4;
      const rw = this.width - 8;
      const rh = this.height - 8;
      ctx.beginPath();
      ctx.moveTo(rx, ry + rh / 2);
      ctx.lineTo(rx + rw * 0.6, ry);
      ctx.lineTo(rx + rw, ry + rh / 2);
      ctx.lineTo(rx + rw * 0.6, ry + rh);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  isCollideWithBird(bird) {
    if (!this.visible || !bird.visible || !bird.isActive) return false;

    const bx = bird.x + 4;
    const by = bird.y + 4;
    const bw = bird.width - 8;
    const bh = bird.height - 8;

    const rx = this.x + 4;
    const ry = this.y + 2;
    const rw = this.width - 8;
    const rh = this.height - 4;

    return bx + bw > rx && bx < rx + rw && by + bh > ry && by < ry + rh;
  }
}