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

  init(speed, prevPipe, nextPipe) {
    this.visible = true;
    this.isActive = true;
    this.speed = speed;
    this.rotation = Math.random() * Math.PI * 2;
    this.x = prevPipe.x + (nextPipe ? (nextPipe.x - prevPipe.x) / 2 : 0) + prevPipe.width / 2;

    /* 放在两根水管之间的垂直空间 */
    this.y = this._calcBetweenPipes(prevPipe, nextPipe);

    console.log(`[Saw] 生成 x=${this.x.toFixed(1)} y=${this.y.toFixed(1)} prevPipe(x=${prevPipe.x.toFixed(1)},gapY=${prevPipe.gapY}) nextPipe=${nextPipe ? '有' : '无'}`);
  }

  _calcBetweenPipes(prevPipe, nextPipe) {
    const availableH = SCREEN_HEIGHT - GROUND.HEIGHT;
    const safeTop = 50;
    const safeBottom = availableH - SAW_SIZE - 10;

    const gapY1 = prevPipe.gapY;
    const gap1 = prevPipe.gap;
    const gapY2 = nextPipe ? nextPipe.gapY : prevPipe.gapY;
    const gap2 = nextPipe ? nextPipe.gap : prevPipe.gap;

    const midY = (gapY1 + gap1 / 2 + gapY2 + gap2 / 2) / 2;
    const y = Math.max(safeTop, Math.min(safeBottom, midY - SAW_SIZE / 2));

    return y;
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