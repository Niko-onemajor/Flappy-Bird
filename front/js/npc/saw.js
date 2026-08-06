import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import { GROUND, SAW as SAW_CFG } from '../config';

const SAW_RADIUS = SAW_CFG.RADIUS;
const SAW_SIZE = SAW_RADIUS * 2;

/* 预加载圆锯图片（与 pipe 同款模块级 IIFE，游戏启动时即加载，避免运行时创建导致 drawImage 崩溃） */
const SAW_IMG = (() => { const img = wx.createImage(); img.src = 'images/circular-saw.png'; return img; })();

export default class Saw extends Sprite {
  rotation = 0;
  speed = 3;

  constructor() {
    super('', SAW_SIZE, SAW_SIZE);
  }

  init(speed, pipe, prevPipe) {
    this.visible = true;
    this.isActive = true;
    this.speed = speed;
    this.rotation = Math.random() * Math.PI * 2;
    this._hostPipe = pipe;

    /* 水平位置：从屏幕右侧进入，放在两根水管之间的空白区域 */
    /* 距离水管至少 80px，放在 prevPipe 右边缘到 SCREEN_WIDTH 之间 */
    const prevRight = prevPipe ? Math.max(prevPipe.x + prevPipe.width, 0) : 0;
    const gapSpace = SCREEN_WIDTH - prevRight;
    const margin = Math.min(80, gapSpace * 0.2);
    const usableSpace = gapSpace - margin * 2;

    if (usableSpace > 80) {
      this.x = prevRight + margin + Math.random() * usableSpace;
    } else {
      /* 第一根水管或空间不足，从右侧进入 */
      this.x = SCREEN_WIDTH + 40 + Math.random() * 60;
    }

    /* 垂直位置：放在水管间隙上方或下方，不堵死玩家通路 */
    this.y = this._calcSawY(pipe);

    console.log(`[Saw] 生成 x=${this.x.toFixed(1)} y=${this.y.toFixed(1)} prevRight=${prevRight.toFixed(1)} gapSpace=${gapSpace.toFixed(1)} pipe(x=${pipe.x.toFixed(1)},gapY=${pipe.gapY.toFixed(1)},gap=${pipe.gap},type=${pipe.pipeType})`);
  }

  /* 核心原则：锯片放在水管间隙上方或下方，永远不堵死玩家唯一通路 */
  _calcSawY(pipe) {
    const availableH = SCREEN_HEIGHT - GROUND.HEIGHT;
    const safeTop = 50;
    const safeBottom = availableH - SAW_SIZE - 10;
    const margin = 8;

    const hasTop = pipe.pipeType === 0 || pipe.pipeType === 1 || pipe.pipeType === 3;
    const hasBottom = pipe.pipeType === 0 || pipe.pipeType === 2 || pipe.pipeType === 3;

    if (hasTop && hasBottom) {
      /* 双管：锯片放在间隙上方（靠近上管底）或下方（靠近下管顶），不堵间隙 */
      if (Math.random() < 0.5) {
        const y = pipe.gapY - SAW_SIZE - margin;
        return Math.max(safeTop, y);
      } else {
        const y = pipe.gapY + pipe.gap + margin;
        return Math.min(safeBottom, y);
      }
    }

    if (hasBottom) {
      /* 只有下管：唯一通路在上方，锯片放在下管上方 */
      const y = pipe.gapY - SAW_SIZE - margin;
      return Math.max(safeTop, y);
    }

    if (hasTop) {
      /* 只有上管：唯一通路在下方，锯片放在上管下方 */
      const y = pipe.gapY + margin;
      return Math.min(safeBottom, y);
    }

    return (safeTop + safeBottom) / 2;
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

    ctx.shadowColor = 'rgba(255, 60, 30, 0.6)';
    ctx.shadowBlur = 10;
    ctx.drawImage(SAW_IMG, -r, -r, this.width, this.height);

    ctx.restore();

    /* 碰撞箱可视化（橙色圆形） */
    if (GameGlobal.DEBUG_COLLISION) {
      const hitR = r - 4;
      ctx.strokeStyle = 'rgba(255, 165, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, hitR, 0, Math.PI * 2);
      ctx.stroke();
      /* 圆心十字 */
      ctx.strokeStyle = 'rgba(255, 165, 0, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy); ctx.lineTo(cx + 6, cy);
      ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 6);
      ctx.stroke();
    }
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
    const hitR = this.width / 2 - 4;

    return dist < (bird.width / 2 + hitR);
  }
}