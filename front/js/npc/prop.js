import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import { PROP, GROUND, PIPE } from '../config';

const PROP_SIZE = PROP.SIZE;
const PROP_TYPES = ['shield', 'multiplier'];
const PROP_DURATION = PROP.DURATION;
const FLOAT_AMP = PROP.FLOAT_AMP;
const FLOAT_SPEED = PROP.FLOAT_SPEED;
const PIPE_SAFE_MARGIN = PROP.SAFE_MARGIN;

/* 道具外观配置 */
const PROP_STYLE = {
  shield: {
    color: '#FFD700',
    glow: '#FFA000',
    icon: '🛡',
    name: '护盾',
  },
  multiplier: {
    color: '#FF5252',
    glow: '#D32F2F',
    icon: 'x2',
    name: '双倍',
  },
};

export default class Prop extends Sprite {
  type = 'shield';
  collected = false;
  animPhase = 0;
  speed = 3;            /* 与水管同步的移动速度 */

  constructor() {
    super('', PROP_SIZE, PROP_SIZE);
  }

  init(type, pipes, pipeSpeed = 3) {
    this.type = type || PROP_TYPES[Math.floor(Math.random() * PROP_TYPES.length)];
    this.visible = true;
    this.isActive = true;
    this.collected = false;
    this.animPhase = Math.random() * Math.PI * 2;
    this.speed = pipeSpeed;
    /* 固定X偏移，避免扎堆 */
    this.x = SCREEN_WIDTH + 30;

    /* 在水管间隙中找安全Y位置 */
    this.y = this._findSafeY(pipes || []);
  }

  /* 找到最近水管的间隙中心放置道具，确保玩家必经之路可拾取 */
  _findSafeY(pipes) {
    const safeTop = 50;
    const safeBottom = SCREEN_HEIGHT - GROUND.HEIGHT - 30;

    /* 找到距离道具最近的水管（该水管即是玩家即将通过的） */
    let bestPipe = null;
    let bestDist = Infinity;

    for (const pipe of pipes) {
      if (!pipe.visible) continue;
      const dist = Math.abs(pipe.x - this.x);
      if (dist < bestDist) {
        bestDist = dist;
        bestPipe = pipe;
      }
    }

    if (bestPipe) {
      const hasTop = bestPipe.pipeType === 0 || bestPipe.pipeType === 1 || bestPipe.pipeType === 3;
      const hasBottom = bestPipe.pipeType === 0 || bestPipe.pipeType === 2 || bestPipe.pipeType === 3;

      console.log(`[道具生成] 匹配水管 type=${bestPipe.pipeType} x=${bestPipe.x.toFixed(1)} dist=${bestDist.toFixed(1)} gapY=${bestPipe.gapY.toFixed(1)} gap=${bestPipe.gap}`);

      if (hasTop && hasBottom) {
        /* 双管：放在间隙正中央，玩家必经之路 */
        const gapCenter = bestPipe.gapY + bestPipe.gap / 2;
        const y = Math.max(safeTop + PROP_SIZE, Math.min(gapCenter, safeBottom - PROP_SIZE));
        console.log(`[道具生成] 双管间隙中心=${gapCenter.toFixed(1)}, 最终y=${y.toFixed(1)}`);
        return y;
      } else if (hasBottom) {
        /* 只有下管：放在下管上方安全区域 */
        const y = Math.max(safeTop + PROP_SIZE, bestPipe.gapY - PIPE_SAFE_MARGIN - PROP_SIZE);
        console.log(`[道具生成] 下管上方, y=${y.toFixed(1)}`);
        return y;
      } else if (hasTop) {
        /* 只有上管：放在上管下方安全区域 */
        const y = Math.min(safeBottom - PROP_SIZE, bestPipe.gapY + PIPE_SAFE_MARGIN + PROP_SIZE);
        console.log(`[道具生成] 上管下方, y=${y.toFixed(1)}`);
        return y;
      }
    }

    /* 兜底：无水管时放在屏幕中央 */
    const y = (safeTop + safeBottom) / 2;
    console.log(`[道具生成] 无匹配水管，兜底中央, y=${y.toFixed(1)}`);
    return y;
  }

  update() {
    if (GameGlobal.databus.isGameOver) return;

    this.x -= this.speed;
    this.animPhase += FLOAT_SPEED;

    if (this.x + this.width < -10) {
      GameGlobal.databus.removeProp(this);
    }
  }

  render(ctx) {
    if (!this.visible || this.collected) return;

    const style = PROP_STYLE[this.type] || PROP_STYLE.shield;
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2 + Math.sin(this.animPhase) * FLOAT_AMP;
    const r = this.width / 2;
    const pulse = 1 + Math.sin(this.animPhase * 1.5) * 0.1;

    ctx.save();

    /* 外发光 */
    ctx.shadowColor = style.glow;
    ctx.shadowBlur = 12 + Math.sin(this.animPhase * 2) * 4;

    /* 外圈 */
    const outerR = r * pulse;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 4, 0, Math.PI * 2);
    ctx.fill();

    /* 主体圆形 */
    const mainGrad = ctx.createRadialGradient(cx - 3, cy - 3, r * 0.1, cx, cy, r * pulse);
    mainGrad.addColorStop(0, '#ffffff');
    mainGrad.addColorStop(0.4, style.color);
    mainGrad.addColorStop(1, style.glow);
    ctx.fillStyle = mainGrad;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, r * pulse, 0, Math.PI * 2);
    ctx.fill();

    /* 边框 */
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r * pulse, 0, Math.PI * 2);
    ctx.stroke();

    /* 图标 */
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(style.icon, cx, cy);

    /* 名称标签 */
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 9px Arial';
    ctx.fillText(style.name, cx, cy + r + 10);

    ctx.restore();
  }

  collect() {
    if (this.collected) return;
    this.collected = true;
    this.visible = false;

    const db = GameGlobal.databus;
    switch (this.type) {
      case 'shield':
        db.shieldActive = true;
        db.shieldTimer = PROP_DURATION;
        break;
      case 'multiplier':
        db.scoreMultiplier = 2;
        db.multiplierTimer = PROP_DURATION;
        break;
    }
  }

  static getDuration() {
    return PROP_DURATION;
  }
}