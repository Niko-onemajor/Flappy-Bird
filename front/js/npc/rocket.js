import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import { GROUND, ROCKET as ROCKET_CFG } from '../config';

const ROCKET_W = ROCKET_CFG.WIDTH;
const ROCKET_H = ROCKET_CFG.HEIGHT;

/* 预加载火箭图片，使用 onload 回调确保加载状态可靠 */
let rocketImgLoaded = false;
const ROCKET_IMG = wx.createImage();
ROCKET_IMG.onload = () => { rocketImgLoaded = true; };
ROCKET_IMG.onerror = () => { rocketImgLoaded = false; };
ROCKET_IMG.src = 'images/rocket.png';

export default class Rocket extends Sprite {
  speed = 5;
  trailPhase = 0;
  angle = 0;           /* 飞行方向角度 */
  targetX = 0;         /* 锁定玩家X坐标 */
  targetY = 0;         /* 锁定玩家Y坐标 */

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
      /* 双管：火箭放在间隙内 */
      const safeTop = pipe.gapY + minClearance;
      const safeBottom = pipe.gapY + pipe.gap - minClearance;
      if (safeBottom - safeTop < ROCKET_H) {
        return safeTop;
      }
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
    /* 按锁定角度直线飞行 */
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
    /* 火箭头朝向飞行方向（图片默认朝右，旋转 angle 使其指向目标） */
    ctx.rotate(this.angle);

    /* 火焰尾迹（在火箭尾部，即图片右侧后方） */
    const trailLen = 20 + Math.sin(this.trailPhase) * 5;
    const trailGrad = ctx.createLinearGradient(this.width / 2, 0, this.width / 2 + trailLen, 0);
    trailGrad.addColorStop(0, 'rgba(255, 150, 30, 0.8)');
    trailGrad.addColorStop(0.5, 'rgba(255, 80, 10, 0.4)');
    trailGrad.addColorStop(1, 'rgba(255, 30, 0, 0)');
    ctx.fillStyle = trailGrad;
    ctx.fillRect(this.width / 2, -this.height / 2 + 4, trailLen, this.height - 8);

    /* 使用 onload 标志位判断图片是否加载完成 */
    if (rocketImgLoaded) {
      ctx.drawImage(ROCKET_IMG, -this.width / 2, -this.height / 2, this.width, this.height);
    } else {
      /* 图片未加载时的降级渲染：绘制火箭形状 */
      ctx.fillStyle = '#FF5722';
      ctx.strokeStyle = '#BF360C';
      ctx.lineWidth = 2;
      const rx = -this.width / 2 + 4;
      const ry = -this.height / 2 + 4;
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