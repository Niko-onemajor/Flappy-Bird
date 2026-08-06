import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import { PROP, GROUND, PIPE } from '../config';

const PROP_SIZE = PROP.SIZE;
const PROP_TYPES = ['shield', 'multiplier'];
const PROP_DURATION = PROP.DURATION;
const FLOAT_AMP = PROP.FLOAT_AMP;
const FLOAT_SPEED = PROP.FLOAT_SPEED;
const PIPE_SAFE_MARGIN = PROP.SAFE_MARGIN;
const PIPE_WIDTH = PIPE.WIDTH;

/* 预加载道具图片 */
const SHIELD_IMG = (() => { const img = wx.createImage(); img.src = 'images/shield.png'; return img; })();

/* 道具外观配置 */
const PROP_STYLE = {
  shield: {
    color: '#FFD700',
    glow: '#FFA000',
    icon: '🛡',
    name: '护盾',
    img: SHIELD_IMG,
  },
  multiplier: {
    color: '#FF5252',
    glow: '#D32F2F',
    icon: 'x2',
    name: '双倍',
    img: null,
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

  /* 先生成水管，再基于水管精确计算道具坐标 */
  init(pipe) {
    this.type = PROP_TYPES[Math.floor(Math.random() * PROP_TYPES.length)];
    this.visible = true;
    this.isActive = true;
    this.collected = false;
    this.animPhase = Math.random() * Math.PI * 2;
    this.speed = pipe.speed;
    this._parentPipe = pipe;

    /* 第一步：先确定X —— 放在水管中央，加入随机偏移防止重叠 */
    this.x = pipe.x + PIPE_WIDTH / 2 - PROP_SIZE / 2 + (Math.random() - 0.5) * 20;

    /* 第二步：基于水管精确计算Y —— 确保在玩家必经之路上 */
    this.y = this._findSafeY(pipe);

    console.log(`[Prop] 生成 x=${this.x.toFixed(1)} y=${this.y.toFixed(1)} type=${this.type} pipeType=${pipe.pipeType} gapY=${pipe.gapY.toFixed(1)} gap=${pipe.gap}`);
  }

  /* 基于水管位置精确计算道具Y坐标，确保玩家可拾取且不堵死通路 */
  _findSafeY(pipe) {
    const safeTop = 50;
    const safeBottom = SCREEN_HEIGHT - GROUND.HEIGHT - 30;

    const hasTop = pipe.pipeType === 0 || pipe.pipeType === 1 || pipe.pipeType === 3;
    const hasBottom = pipe.pipeType === 0 || pipe.pipeType === 2 || pipe.pipeType === 3;

    if (hasTop && hasBottom) {
      /* 双管：放在间隙正中央，玩家必经之路 */
      const gapCenter = pipe.gapY + pipe.gap / 2;
      const y = Math.max(safeTop + PROP_SIZE, Math.min(gapCenter, safeBottom - PROP_SIZE));
      console.log(`[Prop] 双管间隙中心=${gapCenter.toFixed(1)}, 最终y=${y.toFixed(1)}`);
      return y;
    } else if (hasBottom) {
      /* 只有下管：放在下管上方安全区域，不堵死上方通路 */
      const y = Math.max(safeTop + PROP_SIZE, pipe.gapY - PIPE_SAFE_MARGIN - PROP_SIZE);
      console.log(`[Prop] 下管上方, y=${y.toFixed(1)}`);
      return y;
    } else if (hasTop) {
      /* 只有上管：放在上管下方安全区域，不堵死下方通路 */
      const y = Math.min(safeBottom - PROP_SIZE, pipe.gapY + PIPE_SAFE_MARGIN + PROP_SIZE);
      console.log(`[Prop] 上管下方, y=${y.toFixed(1)}`);
      return y;
    }

    /* 兜底：屏幕中央 */
    const y = (safeTop + safeBottom) / 2;
    console.log(`[Prop] 兜底中央, y=${y.toFixed(1)}`);
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

    if (style.img) {
      /* 使用图片素材 */
      ctx.shadowBlur = 10;
      const imgR = r * pulse * 1.2;
      ctx.drawImage(style.img, cx - imgR, cy - imgR, imgR * 2, imgR * 2);
    } else {
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
    }

    /* 名称标签 */
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(style.name, cx, cy + r + 10);

    ctx.restore();

    /* 碰撞箱可视化（蓝色圆形） */
    if (GameGlobal.DEBUG_COLLISION) {
      ctx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
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