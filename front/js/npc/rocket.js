import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import { GROUND, ROCKET as ROCKET_CFG } from '../config';

const ROCKET_W = ROCKET_CFG.WIDTH;
const ROCKET_H = ROCKET_CFG.HEIGHT;

/* 预加载火箭图片（与 pipe 同款模块级 IIFE，游戏启动时即加载） */
const ROCKET_IMG = (() => { const img = wx.createImage(); img.src = 'images/rocket.png'; return img; })();

export default class Rocket extends Sprite {
  speed = 5;
  trailPhase = 0;
  angle = 0;
  targetX = 0;
  targetY = 0;

  constructor() {
    super('', ROCKET_W, ROCKET_H);
  }

  init(pipeSpeed, pipe) {
    this.visible = true;
    this.isActive = true;
    this.speed = pipeSpeed * 1.2;
    this.trailPhase = 0;
    this.x = SCREEN_WIDTH + 40 + Math.random() * 60;

    this.y = this._calcY(pipe);

    const player = GameGlobal.databus.player;
    this.targetX = player.x;
    this.targetY = player.y;
    this.angle = Math.atan2(this.targetY - this.y, this.targetX - this.x);

    console.log(`[Rocket] 生成 x=${this.x.toFixed(1)} y=${this.y.toFixed(1)} target=(${this.targetX.toFixed(1)},${this.targetY.toFixed(1)}) angle=${(this.angle * 180 / Math.PI).toFixed(1)}° speed=${this.speed.toFixed(1)}`);
  }

  _calcY(pipe) {
    const availableH = SCREEN_HEIGHT - GROUND.HEIGHT;
    const safeTop = 30;
    const safeBottom = availableH - ROCKET_H - 10;
    const margin = 8;

    const hasTop = pipe.pipeType === 0 || pipe.pipeType === 1 || pipe.pipeType === 3;
    const hasBottom = pipe.pipeType === 0 || pipe.pipeType === 2 || pipe.pipeType === 3;

    if (hasTop && hasBottom) {
      /* 双管：火箭放在间隙上方或下方，不堵死通路 */
      if (Math.random() < 0.5) {
        const y = pipe.gapY - ROCKET_H - margin;
        return Math.max(safeTop, y);
      } else {
        const y = pipe.gapY + pipe.gap + margin;
        return Math.min(safeBottom, y);
      }
    }

    if (hasBottom) {
      /* 只有下管：唯一通路在上方，火箭放在下管上方 */
      const y = pipe.gapY - ROCKET_H - margin;
      return Math.max(safeTop, y);
    }

    if (hasTop) {
      /* 只有上管：唯一通路在下方，火箭放在上管下方 */
      const y = pipe.gapY + margin;
      return Math.min(safeBottom, y);
    }

    return availableH / 2;
  }

  update() {
    if (GameGlobal.databus.isGameOver) return;
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
    this.trailPhase += 0.15;
  }

  render(ctx) {
    if (!this.visible) return;

    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.angle);

    /* 火焰尾迹 */
    ctx.fillStyle = 'rgba(255, 120, 20, 0.5)';
    const trailLen = 16 + Math.sin(this.trailPhase) * 4;
    ctx.fillRect(this.width / 2, -this.height / 2 + 4, trailLen, this.height - 8);

    /* 火箭本体 */
    ctx.drawImage(ROCKET_IMG, -this.width / 2, -this.height / 2, this.width, this.height);

    ctx.restore();

    /* 碰撞箱可视化（黄色AABB） */
    if (GameGlobal.DEBUG_COLLISION) {
      const rx = this.x + 4;
      const ry = this.y + 2;
      const rw = this.width - 8;
      const rh = this.height - 4;
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx, ry, rw, rh);
      /* 方向指示线 */
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(this.angle) * 20, cy + Math.sin(this.angle) * 20);
      ctx.stroke();
    }
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