import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import { PROP, GROUND, PIPE } from '../config';

const PROP_SIZE = PROP.SIZE;
const PROP_TYPES = ['shield', 'multiplier'];
const PROP_DURATION = PROP.DURATION;
const MULTIPLIER_DURATION = PROP.MULTIPLIER_DURATION;
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

  /** 对象池回收时清理残留状态 */
  reset() {
    this.type = 'shield';
    this.collected = false;
    this.animPhase = 0;
    this.speed = 3;
    this._parentPipe = null;
    this.visible = false;
    this.isActive = false;
    this.x = 0;
    this.y = 0;
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

    if (GameGlobal.DEBUG_LOG) console.log(`[Prop] 生成 x=${this.x.toFixed(1)} y=${this.y.toFixed(1)} type=${this.type} pipeType=${pipe.pipeType} gapY=${pipe.gapY.toFixed(1)} gap=${pipe.gap}`);
  }

  /* 基于水管位置精确计算道具Y坐标，确保玩家可拾取且不堵死通路 */
  _findSafeY(pipe) {
    const safeTop = 50;
    const safeBottom = SCREEN_HEIGHT - GROUND.HEIGHT - 30;

    const hasTop = pipe.hasTop;
    const hasBottom = pipe.hasBottom;

    if (hasTop && hasBottom) {
      /* 双管：放在间隙正中央（左上角偏移半高，使道具中心对齐间隙中心） */
      const gapCenter = pipe.gapY + pipe.gap / 2;
      const y = Math.max(safeTop, Math.min(gapCenter - PROP_SIZE / 2, safeBottom - PROP_SIZE));
      if (GameGlobal.DEBUG_LOG) console.log(`[Prop] 双管间隙中心=${gapCenter.toFixed(1)}, 道具左上角y=${y.toFixed(1)}, 道具中心y=${(y + PROP_SIZE / 2).toFixed(1)}`);
      return y;
    } else if (hasBottom) {
      /* 只有下管：放在下管上方与屏幕顶端之间的中间位置 */
      const passageMid = (0 + pipe.gapY) / 2;
      const y = Math.max(safeTop, Math.min(passageMid - PROP_SIZE / 2, safeBottom - PROP_SIZE));
      if (GameGlobal.DEBUG_LOG) console.log(`[Prop] 下管上方中间, 通道中心=${passageMid.toFixed(1)}, 道具左上角y=${y.toFixed(1)}`);
      return y;
    } else if (hasTop) {
      /* 只有上管：放在上管下方与地面之间的中间位置 */
      const passageMid = (pipe.gapY + safeBottom + PROP_SIZE) / 2;
      const y = Math.max(safeTop, Math.min(passageMid - PROP_SIZE / 2, safeBottom - PROP_SIZE));
      if (GameGlobal.DEBUG_LOG) console.log(`[Prop] 上管下方中间, 通道中心=${passageMid.toFixed(1)}, 道具左上角y=${y.toFixed(1)}`);
      return y;
    }

    /* 兜底：屏幕中央 */
    const y = (safeTop + safeBottom - PROP_SIZE) / 2;
    if (GameGlobal.DEBUG_LOG) console.log(`[Prop] 兜底中央, y=${y.toFixed(1)}`);
    return y;
  }

  /* 当水管移动时同步更新道具Y坐标（仅MOVING类型水管需要） */
  syncYWithMovingPipe() {
    const p = this._parentPipe;
    if (!p || p.pipeType !== 3) return;

    const gapCenter = p.gapY + p.gap / 2;
    const newY = gapCenter - PROP_SIZE / 2;
    const minY = p.gapY + PIPE_SAFE_MARGIN;
    const maxY = p.gapY + p.gap - PIPE_SAFE_MARGIN - PROP_SIZE;
    this.y = Math.max(minY, Math.min(maxY, newY));
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
        db.multiplierTimer = MULTIPLIER_DURATION;
        break;
    }
  }

  static getDuration() {
    return PROP_DURATION;
  }
}