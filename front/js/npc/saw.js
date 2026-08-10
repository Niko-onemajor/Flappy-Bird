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

  /** 对象池回收时清理残留状态 */
  reset() {
    this.rotation = 0;
    this.speed = 3;
    this._hostPipe = null;
    this.visible = false;
    this.isActive = false;
    this.x = 0;
    this.y = 0;
  }

  init(speed, pipe, prevPipe) {
    this.visible = true;
    this.isActive = true;
    this.speed = speed;
    this.rotation = Math.random() * Math.PI * 2;
    this._hostPipe = pipe;

    /* 水平位置：从屏幕右侧更远处进入，留出足够反应时间 */
    this.x = SCREEN_WIDTH + 180 + Math.random() * 120;

    /* 垂直位置：放在水管间隙上方或下方，不堵死玩家通路 */
    this.y = this._calcSawY(pipe);

    if (GameGlobal.DEBUG_LOG) console.log(`[Saw] 生成 x=${this.x.toFixed(1)} y=${this.y.toFixed(1)} pipe(x=${pipe.x.toFixed(1)},gapY=${pipe.gapY.toFixed(1)},gap=${pipe.gap},type=${pipe.pipeType})`);
  }

  /* 核心原则：锯片放在水管间隙上方或下方，永远不堵死玩家唯一通路 */
  _calcSawY(pipe) {
    const availableH = SCREEN_HEIGHT - GROUND.HEIGHT;
    const safeTop = 50;
    const safeBottom = availableH - SAW_SIZE - 10;
    const margin = 8;

    const hasTop = pipe.hasTop;
    const hasBottom = pipe.hasBottom;

    if (hasTop && hasBottom) {
      /* 双管：锯片放在间隙上方或下方，永远不堵间隙 */
      const aboveY = pipe.gapY - SAW_SIZE - margin;
      const belowY = pipe.gapY + pipe.gap + margin;

      /* 优先放在上方（间隙上方 margin 像素） */
      if (aboveY >= safeTop) {
        return aboveY;
      }

      /* 上方被 safeTop 夹进间隙（间隙太靠上），改放在下方 */
      /* belowY = gapBottom + margin，永远在间隙底部下方，不堵间隙 */
      const clampedBelow = Math.min(safeBottom, belowY);
      if (clampedBelow >= pipe.gapY + pipe.gap) {
        return clampedBelow;
      }

      /* 下方也被夹（间隙太靠下），回退到 safeTop */
      return safeTop;
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
    const hitR = this.width / 2 - 4;
    const threshold = bird.width / 2 + hitR;

    return dx * dx + dy * dy < threshold * threshold;
  }
}