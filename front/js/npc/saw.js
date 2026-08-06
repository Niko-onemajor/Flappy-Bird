import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import { GROUND, SAW as SAW_CFG } from '../config';

const SAW_RADIUS = SAW_CFG.RADIUS;
const SAW_SIZE = SAW_RADIUS * 2;

/* 预加载圆锯图片，使用 onload 回调确保加载状态可靠 */
let sawImgLoaded = false;
const SAW_IMG = wx.createImage();
SAW_IMG.onload = () => { sawImgLoaded = true; };
SAW_IMG.onerror = () => { sawImgLoaded = false; };
SAW_IMG.src = 'images/circular saw.png';

export default class Saw extends Sprite {
  rotation = 0;
  speed = 3;
  _parentPipe = null;

  constructor() {
    super('', SAW_SIZE, SAW_SIZE);
  }

  init(speed, pipe) {
    this.visible = true;
    this.isActive = true;
    this.speed = speed;
    this.rotation = Math.random() * Math.PI * 2;
    this.x = SCREEN_WIDTH + 20 + Math.random() * 80;
    this._parentPipe = pipe;

    /* 根据水管位置计算锯片的Y坐标 */
    this.y = this._calcSawY(pipe);
  }

  _calcSawY(pipe) {
    const availableH = SCREEN_HEIGHT - GROUND.HEIGHT;
    const birdH = 24;
    const minClearance = birdH * 2.5;

    const hasTop = pipe.pipeType === 0 || pipe.pipeType === 1 || pipe.pipeType === 3;
    const hasBottom = pipe.pipeType === 0 || pipe.pipeType === 2 || pipe.pipeType === 3;

    if (hasTop && hasBottom) {
      /* 双管：锯片放在间隙中央偏上或偏下，迫使玩家调整位置 */
      const gapCenter = pipe.gapY + pipe.gap / 2;
      const safeTop = pipe.gapY + minClearance;
      const safeBottom = pipe.gapY + pipe.gap - minClearance;

      if (safeBottom - safeTop < SAW_SIZE + 10) {
        /* 间隙太小，不放间隙内，放上方或下方 */
        return Math.random() < 0.5
          ? Math.max(30, pipe.gapY - SAW_SIZE - 10)
          : Math.min(availableH - SAW_SIZE - 10, pipe.gapY + pipe.gap + 10);
      }
      /* 放在间隙内，偏向一侧 */
      return Math.random() < 0.5
        ? safeTop + 5
        : safeBottom - SAW_SIZE - 5;
    }

    if (hasBottom) {
      /* 只有下管：放在下管上方空间 */
      const maxY = pipe.gapY - SAW_SIZE - minClearance;
      if (maxY < 30) return Math.max(30, pipe.gapY - SAW_SIZE - 4);
      return 30 + Math.random() * Math.max(0, maxY - 30);
    }

    if (hasTop) {
      /* 只有上管：放在上管下方空间 */
      const minY = pipe.gapY + minClearance;
      const maxY = availableH - SAW_SIZE - 10;
      if (minY > maxY) return Math.min(maxY, pipe.gapY + 4);
      return minY + Math.random() * (maxY - minY);
    }

    return availableH / 2;
  }

  update() {
    if (GameGlobal.databus.isGameOver) return;
    this.x -= this.speed;
    this.rotation += 0.08;

    /* 跟随移动水管同步更新Y坐标 */
    if (this._parentPipe && this._parentPipe.pipeType === 3) {
      this.y = this._calcSawY(this._parentPipe);
    }
  }

  render(ctx) {
    if (!this.visible) return;

    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const r = this.width / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation);

    /* 使用 onload 标志位判断图片是否加载完成 */
    if (sawImgLoaded) {
      ctx.shadowColor = 'rgba(255, 60, 30, 0.6)';
      ctx.shadowBlur = 10;
      ctx.drawImage(SAW_IMG, -r, -r, this.width, this.height);
    } else {
      /* 图片未加载时的降级渲染：绘制红色圆锯 */
      ctx.shadowColor = 'rgba(255, 60, 30, 0.6)';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#D32F2F';
      ctx.strokeStyle = '#B71C1C';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      /* 锯齿纹理 */
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + this.rotation;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * (r - 6), Math.sin(angle) * (r - 6));
        ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        ctx.stroke();
      }
    }

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