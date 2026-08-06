import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import { GROUND, ROCKET as ROCKET_CFG } from '../config';

const ROCKET_W = ROCKET_CFG.WIDTH;
const ROCKET_H = ROCKET_CFG.HEIGHT;

export default class Rocket extends Sprite {
  speed = 5;
  trailPhase = 0;
  angle = 0;
  targetX = 0;
  targetY = 0;

  constructor() {
    super('images/rocket.png', ROCKET_W, ROCKET_H);
  }

  init(pipeSpeed, pipe) {
    this.visible = true;
    this.isActive = true;
    this.speed = pipeSpeed * 1.2;
    this.trailPhase = 0;
    this.x = SCREEN_WIDTH + 40 + Math.random() * 60;

    /* 计算Y坐标 */
    this.y = this._calcY(pipe);

    /* 锁定玩家刷新时的位置，计算飞行角度 */
    const player = GameGlobal.databus.player;
    this.targetX = player.x;
    this.targetY = player.y;
    this.angle = Math.atan2(this.targetY - this.y, this.targetX - this.x);
  }

  _calcY(pipe) {
    const availableH = SCREEN_HEIGHT - GROUND.HEIGHT;
    const birdH = 24;
    const minClearance = birdH * 2.5;

    const hasTop = pipe.pipeType === 0 || pipe.pipeType === 1 || pipe.pipeType === 3;
    const hasBottom = pipe.pipeType === 0 || pipe.pipeType === 2 || pipe.pipeType === 3;

    if (hasTop && hasBottom) {
      const safeTop = pipe.gapY + minClearance;
      const safeBottom = pipe.gapY + pipe.gap - minClearance;
      if (safeBottom - safeTop < ROCKET_H) return safeTop;
      return Math.random() < 0.5
        ? safeTop + 10
        : safeBottom - ROCKET_H - 10;
    }

    if (hasBottom) {
      const maxY = pipe.gapY - ROCKET_H - minClearance;
      if (maxY < 30) return Math.max(30, pipe.gapY - ROCKET_H - 4);
      return 30 + Math.random() * Math.max(0, maxY - 30);
    }

    if (hasTop) {
      const minY = pipe.gapY + minClearance;
      const maxY = availableH - ROCKET_H - 10;
      if (minY > maxY) return Math.min(maxY, pipe.gapY + 4);
      return minY + Math.random() * (maxY - minY);
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

    /* 火焰尾迹 - 用简单矩形避免渐变 bug */
    ctx.fillStyle = 'rgba(255, 120, 20, 0.5)';
    const trailLen = 16 + Math.sin(this.trailPhase) * 4;
    ctx.fillRect(this.width / 2, -this.height / 2 + 4, trailLen, this.height - 8);

    /* 火箭本体 */
    ctx.drawImage(this.img, -this.width / 2, -this.height / 2, this.width, this.height);

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